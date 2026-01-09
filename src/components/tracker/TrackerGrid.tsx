import { LapCounter } from './LapCounter';
import type { LiveParticipant } from '../../types/result';

interface TrackerGridProps {
  participants: LiveParticipant[];
  globalElapsedTime: number;
  onUpdateLoops: (runnerId: string, loopType: 'small' | 'medium' | 'long', delta: number) => void;
  onFinish: (runnerId: string) => void;
  onUnfinish: (runnerId: string) => void;
}

export function TrackerGrid({
  participants,
  globalElapsedTime,
  onUpdateLoops,
  onFinish,
  onUnfinish,
}: TrackerGridProps) {
  // Sort: active runners first, then finished runners
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.finished && !b.finished) return 1;
    if (!a.finished && b.finished) return -1;
    return 0;
  });

  const activeCount = participants.filter((p) => !p.finished).length;
  const finishedCount = participants.filter((p) => p.finished).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-sm">
          <span className="text-gray-400">
            Active: <span className="text-white font-semibold">{activeCount}</span>
          </span>
          <span className="text-gray-400">
            Finished: <span className="text-green font-semibold">{finishedCount}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedParticipants.map((participant) => (
          <LapCounter
            key={participant.runnerId}
            participant={participant}
            globalElapsedTime={globalElapsedTime}
            onUpdateLoops={onUpdateLoops}
            onFinish={onFinish}
            onUnfinish={onUnfinish}
          />
        ))}
      </div>
    </div>
  );
}
