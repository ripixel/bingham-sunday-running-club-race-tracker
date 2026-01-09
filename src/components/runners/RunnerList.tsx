import type { Runner } from '../../types/runner';
import { RunnerCard } from './RunnerCard';

interface RunnerListProps {
  runners: Runner[];
  isLoading: boolean;
  onEdit?: (runner: Runner) => void;
}

export function RunnerList({ runners, isLoading, onEdit }: RunnerListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange"></div>
        <span className="ml-3 text-gray-400">Loading runners...</span>
      </div>
    );
  }

  if (runners.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">No runners found</p>
        <p className="text-sm mt-2">Add your first runner to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runners.map((runner) => (
        <RunnerCard key={runner.id} runner={runner} onEdit={onEdit} />
      ))}
    </div>
  );
}
