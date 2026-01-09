import { useState, useEffect, useCallback } from 'react';
import { createGitHubClient, fetchRunners } from '../lib/github';
import type { Runner } from '../types/runner';
import type { Octokit } from 'octokit';

export function useGitHub(token: string | null) {
  const [octokit, setOctokit] = useState<Octokit | null>(null);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [isLoadingRunners, setIsLoadingRunners] = useState(false);

  useEffect(() => {
    if (token) {
      const client = createGitHubClient(token);
      setOctokit(client);
    } else {
      setOctokit(null);
      setRunners([]);
    }
  }, [token]);

  const loadRunners = useCallback(async () => {
    if (!octokit) return;

    try {
      setIsLoadingRunners(true);
      const fetchedRunners = await fetchRunners(octokit);
      setRunners(fetchedRunners);
    } catch (error) {
      console.error('Failed to load runners:', error);
      // Don't throw here to avoid crashing the UI loop, just log
    } finally {
      setIsLoadingRunners(false);
    }
  }, [octokit]);

  return {
    octokit,
    runners,
    isLoadingRunners,
    loadRunners,
    refreshRunners: loadRunners,
  };
}
