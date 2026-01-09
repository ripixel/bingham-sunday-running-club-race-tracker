import { useTimer } from '../../hooks/useTimer';
import { Button } from './Button';

interface TimerProps {
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
}

export function Timer({ onStart, onPause, onReset }: TimerProps) {
  const { formattedTime, isRunning, start, pause, reset } = useTimer();

  const handleStart = () => {
    start();
    onStart?.();
  };

  const handlePause = () => {
    pause();
    onPause?.();
  };

  const handleReset = () => {
    reset();
    onReset?.();
  };

  return (
    <div className="bg-gray-800 rounded-lg p-8 border-4 border-orange">
      <div className="text-center">
        <div className="text-6xl font-bold font-mono mb-6 text-orange">
          {formattedTime}
        </div>
        <div className="flex gap-4 justify-center">
          {!isRunning ? (
            <Button onClick={handleStart} size="lg" variant="success">
              Start Timer
            </Button>
          ) : (
            <Button onClick={handlePause} size="lg" variant="danger">
              Pause
            </Button>
          )}
          <Button onClick={handleReset} size="lg" variant="secondary">
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
