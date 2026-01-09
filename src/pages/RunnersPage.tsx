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
  const [showForm, setShowForm] = useState(false);
  const [editingRunner, setEditingRunner] = useState<Runner | null>(null);

  const loadRunners = async () => {
    try {
      setIsLoading(true);
      const data = await fetchRunners(octokit);
      // Sort alphabetically by name
      const sortedData = data.sort((a, b) => a.name.localeCompare(b.name));
      setRunners(sortedData);
    } catch (error) {
      console.error('Failed to load runners:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRunners();
  }, [octokit]);

  const handleSaveRunner = async (runner: Runner, photo: File | null) => {
    await createRunner(octokit, runner, photo);
    setShowForm(false);
    setEditingRunner(null);
    await loadRunners(); // Refresh the list
  };

  const handleEdit = (runner: Runner) => {
    setEditingRunner(runner);
    setShowForm(true);
  };

  const handleAddNew = () => {
      setEditingRunner(null);
      setShowForm(true);
  };

  const handleCancel = () => {
      setShowForm(false);
      setEditingRunner(null);
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
        {!showForm && (
          <Button onClick={handleAddNew} variant="success">
            + Add Runner
          </Button>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <AddRunnerForm
            onSubmit={handleSaveRunner}
            onCancel={handleCancel}
            initialData={editingRunner}
          />
        </div>
      )}

      <RunnerList runners={runners} isLoading={isLoading} onEdit={handleEdit} />
    </div>
  );
}
