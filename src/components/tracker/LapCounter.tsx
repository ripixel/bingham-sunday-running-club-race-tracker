import { Button } from '../ui/Button';
import { LOOP_DISTANCES } from '../../types/result';
import type { LiveParticipant } from '../../types/result';

interface LapCounterProps {
  participant: LiveParticipant;
  globalElapsedTime: number;
  onUpdateLoops: (runnerId: string, loopType: 'small' | 'medium' | 'long', delta: number) => void;
  onFinish: (runnerId: string) => void;
  onUnfinish: (runnerId: string) => void;
}

export function LapCounter({
  participant,
  globalElapsedTime,
  onUpdateLoops,
  onFinish,
  onUnfinish,
}: LapCounterProps) {
  const { runnerId, runnerName, smallLoops, mediumLoops, longLoops, finished, finishTime } = participant;

  // Calculate distance (loops only, no approach)
  const distance =
    smallLoops * LOOP_DISTANCES.small +
    mediumLoops * LOOP_DISTANCES.medium +
    longLoops * LOOP_DISTANCES.long;

  // Format elapsed time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const elapsedTime = finished && finishTime ? finishTime : globalElapsedTime;

  return (
    <div
      className={`
        rounded-lg p-4 border-2 transition-all
        ${finished
          ? 'bg-green/10 border-green'
          : 'bg-gray-800 border-gray-700'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg">{runnerName}</h3>
          <p className="text-sm text-gray-400">{runnerId}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold">
            {distance.toFixed(1)} km
          </div>
          <div className="text-sm text-gray-400">
            {formatTime(elapsedTime)}
          </div>
        </div>
      </div>

      {/* Loop Counters */}
      {!finished && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {/* Small Loop */}
          <div className="text-center">
            <div className="text-xs text-pink mb-1">Small ({LOOP_DISTANCES.small}km)</div>
            <div className="flex items-center justify-center gap-1">
              <Button
                onClick={() => onUpdateLoops(runnerId, 'small', -1)}
                variant="secondary"
                size="sm"
                disabled={smallLoops === 0}
                className="w-10 h-10"
              >
                −
              </Button>
              <span className="text-xl font-bold w-8 text-center">{smallLoops}</span>
              <Button
                onClick={() => onUpdateLoops(runnerId, 'small', 1)}
                variant="danger"
                size="sm"
                className="w-10 h-10"
              >
                +
              </Button>
            </div>
          </div>

          {/* Medium Loop */}
          <div className="text-center">
            <div className="text-xs text-green mb-1">Medium ({LOOP_DISTANCES.medium}km)</div>
            <div className="flex items-center justify-center gap-1">
              <Button
                onClick={() => onUpdateLoops(runnerId, 'medium', -1)}
                variant="secondary"
                size="sm"
                disabled={mediumLoops === 0}
                className="w-10 h-10"
              >
                −
              </Button>
              <span className="text-xl font-bold w-8 text-center">{mediumLoops}</span>
              <Button
                onClick={() => onUpdateLoops(runnerId, 'medium', 1)}
                variant="success"
                size="sm"
                className="w-10 h-10"
              >
                +
              </Button>
            </div>
          </div>

          {/* Long Loop */}
          <div className="text-center">
            <div className="text-xs text-blue mb-1">Long ({LOOP_DISTANCES.long}km)</div>
            <div className="flex items-center justify-center gap-1">
              <Button
                onClick={() => onUpdateLoops(runnerId, 'long', -1)}
                variant="secondary"
                size="sm"
                disabled={longLoops === 0}
                className="w-10 h-10"
              >
                −
              </Button>
              <span className="text-xl font-bold w-8 text-center">{longLoops}</span>
              <Button
                onClick={() => onUpdateLoops(runnerId, 'long', 1)}
                variant="primary"
                size="sm"
                className="w-10 h-10 bg-blue hover:bg-blue/90"
              >
                +
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Finish Button */}
      <div className="mt-4">
        {finished ? (
          <Button
            onClick={() => onUnfinish(runnerId)}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            ↩ Undo Finish
          </Button>
        ) : (
          <Button
            onClick={() => onFinish(runnerId)}
            variant="success"
            size="lg"
            className="w-full"
          >
            🏁 Finish
          </Button>
        )}
      </div>
    </div>
  );
}
