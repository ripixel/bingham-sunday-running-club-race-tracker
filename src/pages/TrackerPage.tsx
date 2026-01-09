import { useState, useEffect, useCallback } from 'react';
import type { Octokit } from 'octokit';
import { Button } from '../components/ui/Button';
import { Timer } from '../components/ui/Timer';
import { RunnerSelector } from '../components/tracker/RunnerSelector';
import { TrackerGrid } from '../components/tracker/TrackerGrid';
import { fetchRunners, createRunResult } from '../lib/github';
import type { Runner, TrackedRunner } from '../types/runner';
import type { LiveParticipant } from '../types/result';

interface TrackerPageProps {
  octokit: Octokit;
}

type TrackerState = 'setup' | 'running' | 'review';

export function TrackerPage({ octokit }: TrackerPageProps) {
  const [state, setState] = useState<TrackerState>('setup');
  const [runners, setRunners] = useState<Runner[]>([]);
  const [isLoadingRunners, setIsLoadingRunners] = useState(true);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);

  // Timer state
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Load runners on mount
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoadingRunners(true);
        const data = await fetchRunners(octokit);
        setRunners(data);
      } catch (error) {
        console.error('Failed to load runners:', error);
      } finally {
        setIsLoadingRunners(false);
      }
    };
    load();
  }, [octokit]);

  // Timer effect
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // Format time display
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle starting the run
  const handleStartRun = (selectedRunners: TrackedRunner[]) => {
    const now = Date.now();
    setStartTime(now);
    setIsRunning(true);
    setState('running');

    // Create live participants from selected runners
    const liveParticipants: LiveParticipant[] = selectedRunners.map((runner) => ({
      runnerId: runner.id, // ID is now guaranteed unique (regular ID or guest-timestamp)
      // For guests, we write "guest" to the repo later, but keep unique ID for tracking state
      repoId: runner.id.startsWith('guest-') ? 'guest' : runner.id,
      runnerName: runner.nickname || runner.name,
      smallLoops: 0,
      mediumLoops: 0,
      longLoops: 0,
      startTime: now,
      status: 'running',
    }));

    setParticipants(liveParticipants);
  };

  // Update loop counts
  const handleUpdateLoops = useCallback((runnerId: string, loopType: 'small' | 'medium' | 'long', delta: number) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.runnerId === runnerId) {
          const key = `${loopType}Loops` as 'smallLoops' | 'mediumLoops' | 'longLoops';
          return {
            ...p,
            [key]: Math.max(0, p[key] + delta),
          };
        }
        return p;
      })
    );
  }, []);

  // Mark runner as finished (STOP TIMER only)
  const handleFinish = useCallback((runnerId: string) => {
    const now = Date.now();
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.runnerId === runnerId) {
          return {
            ...p,
            status: 'finished', // Pending info entry
            finishTime: now - startTime,
          };
        }
        return p;
      })
    );
  }, [startTime]);

  // Mark runner as completed (Info gathered, move to bottom)
  const handleComplete = useCallback((runnerId: string) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.runnerId === runnerId) {
          return {
            ...p,
            status: 'completed',
          };
        }
        return p;
      })
    );
  }, []);

  // Resume runner (Undo Finish)
  const handleResume = useCallback((runnerId: string) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.runnerId === runnerId) {
          return {
            ...p,
            status: 'running',
            finishTime: undefined,
          };
        }
        return p;
      })
    );
  }, []);

  // Undo complete (Move back to finished/pending info)
  const handleUndoComplete = useCallback((runnerId: string) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.runnerId === runnerId) {
          return {
            ...p,
            status: 'finished',
          };
        }
        return p;
      })
    );
  }, []);

  // End run and go to review
  const handleEndRun = () => {
    setIsRunning(false);
    setState('review');
  };

  // Save results to GitHub
  const handleSaveResults = async () => {
    try {
      const now = new Date();

      await createRunResult(octokit, {
        date: now,
        title: 'Sunday Run',
        eventTitle: '☕ Sunday Run & Breakfast',
        location: 'Bingham Market Place',
        mainPhoto: '/images/placeholder.jpg',
        isSpecialEvent: false,
        participants: participants.map((p) => ({
          runnerId: p.repoId || (p.runnerId.startsWith('guest-') ? 'guest' : p.runnerId),
          smallLoops: p.smallLoops,
          mediumLoops: p.mediumLoops,
          longLoops: p.longLoops,
          startTime: p.startTime,
          endTime: p.startTime + (p.finishTime || elapsedTime),
        })),
      });

      alert('Results saved successfully!');

      // Reset state
      setState('setup');
      setParticipants([]);
      setElapsedTime(0);
    } catch (error) {
      console.error('Failed to save results:', error);
      alert('Failed to save results. Please try again.');
    }
  };

  // Loading state
  if (isLoadingRunners) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green"></div>
        <span className="ml-3 text-gray-400">Loading runners...</span>
      </div>
    );
  }

  // Setup state - select runners
  if (state === 'setup') {
    return <RunnerSelector runners={runners} onStartRun={handleStartRun} />;
  }

  // Running state - track loops
  if (state === 'running') {
    const allCompleted = participants.every((p) => p.status === 'completed');

    return (

      <div>
        <Timer
          elapsedTime={elapsedTime}
          isRunning={isRunning}
          onPause={() => setIsRunning(false)}
          onResume={() => setIsRunning(true)}
          onEnd={handleEndRun}
          canEnd={allCompleted}
        />

        {!allCompleted && (
          <p className="text-center text-sm text-gray-400 mb-6">
             ℹ️  All runners must be marked as <b>Completed</b> (Green) before you can end the run.
          </p>
        )}

        {/* Tracker Grid */}
        <TrackerGrid
          participants={participants}
          globalElapsedTime={elapsedTime}
          onUpdateLoops={handleUpdateLoops}
          onFinish={handleFinish}
          onComplete={handleComplete}
          onUndoComplete={handleUndoComplete}
          onResume={handleResume}
        />
      </div>
    );
  }

  // Review state - confirm and save
  if (state === 'review') {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Review Results</h2>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <h3 className="font-semibold mb-4">Run Summary</h3>
          <div className="space-y-3">
            {participants.map((p) => (
              <div key={p.runnerId + p.runnerName} className="flex justify-between items-center">
                <span>{p.runnerName}</span>
                <span className="text-gray-400">
                  {p.smallLoops + p.mediumLoops + p.longLoops} loops • {formatTime(p.finishTime || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <Button onClick={handleSaveResults} variant="success" size="lg">
            💾 Save to GitHub
          </Button>
          <Button onClick={() => setState('running')} variant="secondary">
            ← Back to Tracking
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
