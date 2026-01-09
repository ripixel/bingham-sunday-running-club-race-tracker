import type { Runner } from '../../types/runner';

interface RunnerCardProps {
  runner: Runner;
}

export function RunnerCard({ runner }: RunnerCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center gap-4">
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
        {runner.photo ? (
          <img
            src={runner.photo.startsWith('http') ? runner.photo : `https://binghamsundayrunningclub.co.uk${runner.photo}`}
            alt={runner.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xl text-gray-400">
            {runner.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-lg truncate">
          {runner.anonymous ? (
            <span className="text-gray-400">Anonymous Runner</span>
          ) : (
            runner.name
          )}
        </h3>
        <p className="text-sm text-gray-400">
          ID: <code className="text-pink">{runner.id}</code>
        </p>
      </div>

      {/* Badges */}
      <div className="flex gap-2 flex-shrink-0">
        {runner.anonymous && (
          <span className="px-2 py-1 text-xs bg-gray-700 rounded text-gray-300">
            Anonymous
          </span>
        )}
        {runner.id === 'guest' && (
          <span className="px-2 py-1 text-xs bg-orange/20 text-orange rounded">
            Guest
          </span>
        )}
      </div>
    </div>
  );
}
