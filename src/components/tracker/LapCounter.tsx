import { Button } from '../ui/Button';
import { APPROACH_DISTANCE, LOOP_DISTANCES } from '../../types/result';
import type { LiveParticipant } from '../../types/result';

interface LapCounterProps {
  participant: LiveParticipant;
  globalElapsedTime: number;
  onUpdateLoops: (runnerId: string, type: 'small' | 'medium' | 'long', delta: number) => void;
  onUpdateTime?: (runnerId: string, newTimeMs: number) => void;
  onFinish: (runnerId: string) => void;
  onComplete: (runnerId: string) => void;
  onUndoComplete: (runnerId: string) => void;
  onResume: (runnerId: string) => void;
}

// Helper function for distance calculation
// Includes the approach distance (to/from start) when there are any loops
const calculateDistance = (smallLoops: number, mediumLoops: number, longLoops: number): number => {
  const totalLoops = smallLoops + mediumLoops + longLoops;
  const loopDistance =
    smallLoops * LOOP_DISTANCES.small +
    mediumLoops * LOOP_DISTANCES.medium +
    longLoops * LOOP_DISTANCES.long;
  // Only add approach distance if there are any loops
  return totalLoops > 0 ? APPROACH_DISTANCE + loopDistance : 0;
};

export function LapCounter({
  participant,
  globalElapsedTime,
  onUpdateLoops,
  onUpdateTime,
  onFinish,
  onComplete,
  onUndoComplete,
  onResume,
}: LapCounterProps) {
  const {
    runnerId,
    runnerName,
    smallLoops,
    mediumLoops,
    longLoops,
    finishTime,
    status
  } = participant;

  // If status is not set (legacy), derive from finished boolean if it exists, or default to running
  const currentStatus = status || ((participant as any).finished ? 'completed' : 'running');

  // Calculate elapsed time for this runner
  // If finished/completed, use fixed finishTime
  // If running, use global elapsed time
  const elapsedTime = (currentStatus === 'finished' || currentStatus === 'completed') && finishTime !== undefined
    ? finishTime
    : globalElapsedTime;

  const distance = calculateDistance(smallLoops, mediumLoops, longLoops);

  // Format elapsed time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Status-based styles
  const containerClasses = {
    running: 'bg-gray-800 border-gray-700',
    finished: 'bg-orange/10 border-orange ring-1 ring-orange/50', // Highlighted state for data entry
    completed: 'bg-green/5 border-green/30 opacity-75',
  };

  return (
    <div
      className={`
        rounded-lg p-2 border shadow-sm transition-all relative
        ${containerClasses[currentStatus]}
      `}
    >
      {/* Header - Compact single row */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-sm truncate flex-1 mr-2">{runnerName}</h3>
        <div className="text-right text-xs">
          <span className="font-mono font-bold">{distance.toFixed(1)}km</span>
          {/* Time display with edit controls for finished/completed */}
          {(currentStatus === 'finished' || currentStatus === 'completed') && onUpdateTime && finishTime !== undefined ? (
            <span className="ml-1 inline-flex items-center gap-1">
              <button
                onClick={() => onUpdateTime(runnerId, Math.max(0, finishTime - 5000))}
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold"
                title="Subtract 5 seconds"
              >−</button>
              <span className="font-mono text-orange">{formatTime(finishTime)}</span>
              <button
                onClick={() => onUpdateTime(runnerId, finishTime + 5000)}
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold"
                title="Add 5 seconds"
              >+</button>
            </span>
          ) : (
            <span className="text-gray-400 ml-1">{formatTime(elapsedTime)}</span>
          )}
        </div>
      </div>

      {/* Inline loop counts for running state */}
      {currentStatus === 'running' && (
        <div className="flex justify-center gap-3 text-xs text-gray-400 mb-1">
          <span className="text-pink">S:{smallLoops}</span>
          <span className="text-green">M:{mediumLoops}</span>
          <span className="text-blue">L:{longLoops}</span>
        </div>
      )}

      {/* Loop Counters - Only visible for Finished (Timer Stopped) state */}
      {currentStatus === 'finished' && (
        <div className="flex justify-between gap-1 mb-2">
          {/* Small Loop */}
          <div className="flex-1 shrink-0 min-w-fit bg-gray-900/50 rounded p-1 text-center">
            <div className="text-[10px] uppercase font-bold text-pink mb-1">Small</div>
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => onUpdateLoops(runnerId, 'small', -1)}
                disabled={smallLoops === 0}
                className="btn-compact w-8 h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-base font-bold no-select"
              >
                −
              </button>
              <span className="font-mono font-bold w-6 text-center text-sm">{smallLoops}</span>
              <button
                onClick={() => onUpdateLoops(runnerId, 'small', 1)}
                className="btn-compact w-8 h-8 flex items-center justify-center rounded bg-pink hover:bg-pink/90 text-white text-base font-bold shadow-sm no-select"
              >
                +
              </button>
            </div>
          </div>

          {/* Medium Loop */}
          <div className="flex-1 shrink-0 min-w-fit bg-gray-900/50 rounded p-1 text-center">
            <div className="text-[10px] uppercase font-bold text-green mb-1">Med</div>
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => onUpdateLoops(runnerId, 'medium', -1)}
                disabled={mediumLoops === 0}
                className="btn-compact w-8 h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-base font-bold no-select"
              >
                −
              </button>
              <span className="font-mono font-bold w-6 text-center text-sm">{mediumLoops}</span>
              <button
                onClick={() => onUpdateLoops(runnerId, 'medium', 1)}
                className="btn-compact w-8 h-8 flex items-center justify-center rounded bg-green hover:bg-green/90 text-white text-base font-bold shadow-sm no-select"
              >
                +
              </button>
            </div>
          </div>

          {/* Long Loop */}
          <div className="flex-1 shrink-0 min-w-fit bg-gray-900/50 rounded p-1 text-center">
            <div className="text-[10px] uppercase font-bold text-blue mb-1">Long</div>
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => onUpdateLoops(runnerId, 'long', -1)}
                disabled={longLoops === 0}
                className="btn-compact w-8 h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-base font-bold no-select"
              >
                −
              </button>
              <span className="font-mono font-bold w-6 text-center text-sm">{longLoops}</span>
              <button
                onClick={() => onUpdateLoops(runnerId, 'long', 1)}
                className="btn-compact w-8 h-8 flex items-center justify-center rounded bg-blue hover:bg-blue/90 text-white text-base font-bold shadow-sm no-select"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Read-only loop summary for Completed */}
      {currentStatus === 'completed' && (
        <div className="flex justify-center gap-3 text-xs text-gray-400 mb-1">
          <span>S:{smallLoops}</span>
          <span>M:{mediumLoops}</span>
          <span>L:{longLoops}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div>
        {currentStatus === 'running' && (
          <Button
            onClick={() => onFinish(runnerId)}
            variant="danger" // Red for STOP
            size="sm"
            className="w-full py-1 h-8 min-h-0 text-sm font-bold shadow-sm animate-pulse-slow"
          >
            ⏹ Stop Timer
          </Button>
        )}

        {currentStatus === 'finished' && (
          <div className="flex gap-2">
            <Button
              onClick={() => onResume(runnerId)}
              variant="secondary"
              size="sm"
              className="flex-1 py-1 h-8 min-h-0 text-xs"
            >
              ↩ Resume
            </Button>
            <Button
              onClick={() => onComplete(runnerId)}
              variant="success"
              size="sm"
              className="flex-[2] py-1 h-8 min-h-0 text-sm font-bold shadow-sm"
            >
              ✓ Complete
            </Button>
          </div>
        )}

        {currentStatus === 'completed' && (
          <Button
             onClick={() => onUndoComplete(runnerId)}
             variant="secondary"
             size="sm"
             className="w-full text-xs py-1 h-8 min-h-0 opacity-50 hover:opacity-100"
          >
            ↩ Edit (Undo)
          </Button>
        )}
      </div>
    </div>
  );
}
