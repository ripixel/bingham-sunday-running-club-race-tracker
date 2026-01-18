import { LapCounter } from './LapCounter';
import type { LiveParticipant } from '../../types/result';

interface TrackerGridProps {
  participants: LiveParticipant[];
  globalElapsedTime: number;
  onUpdateLoops: (runnerId: string, type: 'small' | 'medium' | 'long', delta: number) => void;
  onUpdateTime?: (runnerId: string, newTimeMs: number) => void;
  onFinish: (runnerId: string) => void;
  onComplete: (runnerId: string) => void;
  onUndoComplete: (runnerId: string) => void;
  onResume: (runnerId: string) => void;
}

export function TrackerGrid({
  participants,
  globalElapsedTime,
  onUpdateLoops,
  onUpdateTime,
  onFinish,
  onComplete,
  onUndoComplete,
  onResume,
}: TrackerGridProps) {
  const activeParticipants = participants.filter((p) => p.status === 'running');
  const finishedParticipants = participants.filter((p) => p.status === 'finished');
  const completedParticipants = participants.filter((p) => p.status === 'completed');

  return (
    <div className="space-y-8">
      {/* 1. Active Runners (Running) */}
      <div>
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          🏃 Active Runners
          <span className="bg-gray-700 text-sm px-2 py-1 rounded-full">{activeParticipants.length}</span>
        </h3>

        {activeParticipants.length === 0 && finishedParticipants.length === 0 && completedParticipants.length === 0 ? (
           <div className="text-gray-500 italic p-4 text-center border border-gray-800 rounded-lg">
            Ready to start...
          </div>
        ) : activeParticipants.length === 0 ? (
          <div className="text-gray-500 italic p-4 text-center border border-gray-800 rounded-lg">
            No active runners
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {activeParticipants.map((participant) => (
              <LapCounter
                key={participant.runnerId}
                participant={participant}
                globalElapsedTime={globalElapsedTime}
                onUpdateLoops={onUpdateLoops}
                onUpdateTime={onUpdateTime}
                onFinish={onFinish}
                onComplete={onComplete}
                onUndoComplete={onUndoComplete}
                onResume={onResume}
              />
            ))}
          </div>
        )}
      </div>

      {/* 2. Finished Runners (Stopped, entering info) */}
      {finishedParticipants.length > 0 && (
        <div className="bg-orange/5 p-4 rounded-xl border border-orange/20">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-orange">
            ⏱️ Timer Stopped — Enter Loops
            <span className="bg-orange/20 text-orange text-sm px-2 py-1 rounded-full">{finishedParticipants.length}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {finishedParticipants.map((participant) => (
              <LapCounter
                key={participant.runnerId}
                participant={participant}
                globalElapsedTime={globalElapsedTime}
                onUpdateLoops={onUpdateLoops}
                onUpdateTime={onUpdateTime}
                onFinish={onFinish}
                onComplete={onComplete}
                onUndoComplete={onUndoComplete}
                onResume={onResume}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Completed Runners (Done) */}
      {completedParticipants.length > 0 && (
        <div className="opacity-75">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green">
            🏁 Finished & Completed
            <span className="bg-green/20 text-green text-sm px-2 py-1 rounded-full">{completedParticipants.length}</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
             {completedParticipants.map((participant) => (
              <LapCounter
                key={participant.runnerId}
                participant={participant}
                globalElapsedTime={globalElapsedTime}
                onUpdateLoops={onUpdateLoops}
                onUpdateTime={onUpdateTime}
                onFinish={onFinish}
                onComplete={onComplete}
                onUndoComplete={onUndoComplete}
                onResume={onResume}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
