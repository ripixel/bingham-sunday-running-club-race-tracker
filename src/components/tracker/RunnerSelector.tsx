import { useState } from 'react';
import type { Runner, TrackedRunner } from '../../types/runner';
import { Button } from '../ui/Button';

interface RunnerSelectorProps {
  runners: Runner[];
  onStartRun: (selectedRunners: TrackedRunner[], guestCount: number) => void;
}

export function RunnerSelector({ runners, onStartRun }: RunnerSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [guestCount, setGuestCount] = useState(0);

  const toggleRunner = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleStart = () => {
    const selectedRunners: TrackedRunner[] = runners
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({ ...r }));

    // Add guest runners
    for (let i = 0; i < guestCount; i++) {
      selectedRunners.push({
        id: `guest-${i + 1}`,
        name: 'Guest',
        anonymous: true,
        nickname: `Guest ${i + 1}`,
      });
    }

    onStartRun(selectedRunners, guestCount);
  };

  // Filter out the special "guest" runner from the list
  const regularRunners = runners.filter((r) => r.id !== 'guest');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Select Today's Runners</h2>
        <p className="text-gray-400">
          Choose who's running today, then start the tracker.
        </p>
      </div>

      {/* Runner Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
        {regularRunners.map((runner) => (
          <button
            key={runner.id}
            onClick={() => toggleRunner(runner.id)}
            className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${selectedIds.has(runner.id)
                ? 'border-green bg-green/20 ring-2 ring-green/50'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {runner.photo ? (
                  <img
                    src={runner.photo.startsWith('http') ? runner.photo : `https://binghamsundayrunningclub.co.uk${runner.photo}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg text-gray-400">
                    {runner.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="font-semibold truncate">
                {runner.anonymous ? 'Anonymous' : runner.name}
              </span>
            </div>
            {selectedIds.has(runner.id) && (
              <div className="mt-2 text-green text-sm">✓ Selected</div>
            )}
          </button>
        ))}
      </div>

      {/* Guest Count */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
        <h3 className="font-semibold mb-3">Guest Runners</h3>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setGuestCount(Math.max(0, guestCount - 1))}
            variant="secondary"
            size="lg"
            disabled={guestCount === 0}
          >
            −
          </Button>
          <span className="text-3xl font-bold w-16 text-center">{guestCount}</span>
          <Button
            onClick={() => setGuestCount(guestCount + 1)}
            variant="secondary"
            size="lg"
          >
            +
          </Button>
          <span className="text-gray-400 ml-4">
            {guestCount === 0 ? 'No guests' : `${guestCount} guest${guestCount > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Start Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleStart}
          variant="success"
          size="lg"
          disabled={selectedIds.size === 0 && guestCount === 0}
          className="px-12"
        >
          Start Run ({selectedIds.size + guestCount} runner{selectedIds.size + guestCount !== 1 ? 's' : ''})
        </Button>
      </div>
    </div>
  );
}
