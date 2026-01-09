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
    <div className="bg-gray-800 rounded-lg p-3 mb-4 border-2 border-orange flex items-center justify-between">
      <div className="text-3xl font-bold font-mono text-orange">
        {formatTime(elapsedTime)}
      </div>

      <div className="flex gap-2">

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
