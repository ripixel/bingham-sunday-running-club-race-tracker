
import { useState } from 'react';
import type { Runner, TrackedRunner } from '../../types/runner';
import { Button } from '../ui/Button';

interface RunnerSelectorProps {
  runners: Runner[];
  onStartRun: (selectedRunners: TrackedRunner[]) => void;
}

export function RunnerSelector({ runners, onStartRun }: RunnerSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [guestName, setGuestName] = useState('');
  const [guests, setGuests] = useState<TrackedRunner[]>([]);

  const toggleRunner = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const addGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    const newGuest: TrackedRunner = {
      id: `guest-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: 'Guest',
      anonymous: true,
      nickname: guestName.trim(),
    };

    setGuests([...guests, newGuest]);
    setGuestName('');
  };

  const removeGuest = (guestId: string) => {
    setGuests(guests.filter(g => g.id !== guestId));
  };

  const handleStart = () => {
    const selectedRunners: TrackedRunner[] = runners
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({ ...r }));

    // Combine regular runners and named guests
    const allRunners = [...selectedRunners, ...guests];

    onStartRun(allRunners);
  };

  // Filter out the special "guest" runner from the list to avoid duplicate counting
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

      {/* Guest Management */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
        <h3 className="font-semibold mb-4 text-green">Guest Runners</h3>

        <form onSubmit={addGuest} className="flex gap-2 mb-4">
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Enter guest name (e.g. 'Dave friend of Sarah')"
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-orange"
          />
          <Button type="submit" variant="secondary" disabled={!guestName.trim()}>
            + Add Guest
          </Button>
        </form>

        {guests.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {guests.map((guest) => (
              <div key={guest.id} className="flex items-center justify-between p-3 bg-gray-700 rounded border border-gray-600">
                <span className="font-medium">{guest.nickname}</span>
                <button
                  onClick={() => removeGuest(guest.id)}
                  className="text-pink hover:text-white px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No guests added yet.</p>
        )}
      </div>

      {/* Start Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleStart}
          variant="success"
          size="lg"
          disabled={selectedIds.size === 0 && guests.length === 0}
          className="px-12"
        >
          Start Run ({selectedIds.size + guests.length} runner{selectedIds.size + guests.length !== 1 ? 's' : ''})
        </Button>
      </div>
    </div>
  );
}

