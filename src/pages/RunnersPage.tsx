import { useState, useEffect } from 'react';
import type { Octokit } from 'octokit';
import { Button } from '../components/ui/Button';
import { RunnerList } from '../components/runners/RunnerList';
import { AddRunnerForm } from '../components/runners/AddRunnerForm';
import { fetchRunners, createRunner } from '../lib/github';
import type { Runner } from '../types/runner';

interface RunnersPageProps {
  octokit: Octokit;
}

export function RunnersPage({ octokit }: RunnersPageProps) {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadRunners = async () => {
    try {
      setIsLoading(true);
      const data = await fetchRunners(octokit);
      setRunners(data);
    } catch (error) {
      console.error('Failed to load runners:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRunners();
  }, [octokit]);

  const handleAddRunner = async (runner: Runner) => {
    await createRunner(octokit, runner);
    setShowAddForm(false);
    await loadRunners(); // Refresh the list
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Manage Runners</h2>
          <p className="text-gray-400 text-sm mt-1">
            {runners.length} runner{runners.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} variant="success">
            + Add Runner
          </Button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-6">
          <AddRunnerForm
            onSubmit={handleAddRunner}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      <RunnerList runners={runners} isLoading={isLoading} />
    </div>
  );
}
