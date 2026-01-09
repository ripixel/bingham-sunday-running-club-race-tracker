import type { Runner } from '../../types/runner';

interface RunnerCardProps {
  runner: Runner;
  onEdit?: (runner: Runner) => void;
}

export function RunnerCard({ runner, onEdit }: RunnerCardProps) {
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
            <span className="text-gray-400 flex items-center gap-2">
              Anonymous Runner
              <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300 font-normal">Hidden</span>
            </span>
          ) : (
            runner.name
          )}
        </h3>
        <p className="text-sm text-gray-400">
          ID: <code className="text-pink">{runner.id}</code>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {onEdit && (
          <button
            onClick={() => onEdit(runner)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
            title="Edit Runner"
          >
            ✏️
          </button>
        )}
      </div>
    </div>
  );
}
