import { useState } from 'react';
import { Button } from '../ui/Button';
import type { Runner } from '../../types/runner';

interface AddRunnerFormProps {
  onSubmit: (runner: Runner, photo: File | null) => Promise<void>;
  onCancel: () => void;
  initialData?: Runner | null;
}

export function AddRunnerForm({ onSubmit, onCancel, initialData }: AddRunnerFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [isAnonymous, setIsAnonymous] = useState(initialData?.anonymous || false);
  const [photo, setPhoto] = useState<File | null>(null);
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

    // Only generate ID for new runners; use existing ID for updates
    const id = initialData ? initialData.id : generateId(name);

    if (!id) {
      setError('Invalid name - must contain letters or numbers');
      return;
    }

    const runner: Runner = {
      id,
      name: name.trim(),
      anonymous: isAnonymous,
      joinedDate: initialData?.joinedDate || new Date().toISOString().split('T')[0],
      photo: initialData?.photo // Keep existing photo URL if no new one
    };

    try {
      setIsSubmitting(true);
      await onSubmit(runner, photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create runner');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-bold mb-4 text-green">
        {initialData ? 'Edit Runner' : 'Add New Runner'}
      </h3>

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
              ID: <code className="text-pink">{initialData ? initialData.id : (generateId(name) || '...')}</code> {initialData && '(cannot change)'}
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

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Profile Photo (Optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setPhoto(e.target.files[0]);
              }
            }}
            className="block w-full text-sm text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-green file:text-white
              hover:file:bg-green/90"
            disabled={isSubmitting}
          />
          {photo && (
            <p className="text-sm text-green mt-1">✅ {photo.name}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button type="submit" variant="success" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (initialData ? 'Update Runner' : 'Create Runner')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
