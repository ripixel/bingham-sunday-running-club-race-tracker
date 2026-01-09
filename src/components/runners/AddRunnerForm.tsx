import { useState } from 'react';
import { Button } from '../ui/Button';
import type { Runner } from '../../types/runner';

interface AddRunnerFormProps {
  onSubmit: (runner: Runner) => Promise<void>;
  onCancel: () => void;
}

export function AddRunnerForm({ onSubmit, onCancel }: AddRunnerFormProps) {
  const [name, setName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateId = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const id = generateId(name);
    if (!id) {
      setError('Invalid name - must contain letters or numbers');
      return;
    }

    const runner: Runner = {
      id,
      name: name.trim(),
      anonymous: isAnonymous,
      joinedDate: new Date().toISOString().split('T')[0],
    };

    try {
      setIsSubmitting(true);
      await onSubmit(runner);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create runner');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-bold mb-4 text-green">Add New Runner</h3>

      {error && (
        <div className="bg-pink/20 border border-pink text-pink px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
            Name (First name only)
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. James"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange"
            disabled={isSubmitting}
          />
          {name && (
            <p className="text-sm text-gray-400 mt-1">
              ID will be: <code className="text-pink">{generateId(name) || '...'}</code>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="anonymous"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange focus:ring-orange"
            disabled={isSubmitting}
          />
          <label htmlFor="anonymous" className="text-gray-300">
            Anonymous (shown as "Runner #X" in results)
          </label>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button type="submit" variant="success" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Runner'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
