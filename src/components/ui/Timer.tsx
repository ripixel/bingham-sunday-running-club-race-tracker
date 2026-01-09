import { Button } from './Button';

interface TimerProps {
  elapsedTime: number;
  isRunning: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  canEnd?: boolean;
}

export function Timer({
  elapsedTime,
  isRunning,
  onPause,
  onResume,
  onEnd,
  canEnd
}: TimerProps) {

  // Format formattedTime from elapsedTime
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6 border-4 border-orange flex items-center justify-between">
      <div className="text-center flex-1">
        <div className="text-5xl font-bold font-mono text-orange">
          {formatTime(elapsedTime)}
        </div>
        <p className="text-gray-400 text-sm mt-1">Global Timer</p>
      </div>

      <div className="flex gap-2">
        {isRunning ? (
          <Button onClick={onPause} variant="secondary" size="sm">
            Pause
          </Button>
        ) : (
          <Button onClick={onResume} variant="success" size="sm">
            Resume
          </Button>
        )}
        <Button
          onClick={onEnd}
          variant="danger"
          size="sm"
          disabled={canEnd === false}
          title={canEnd === false ? "All runners must be 'Completed' before ending" : ""}
        >
          End Run
        </Button>
      </div>
    </div>
  );
}
