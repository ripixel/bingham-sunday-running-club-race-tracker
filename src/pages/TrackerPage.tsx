import { useState, useEffect, useCallback } from 'react';
import type { Octokit } from 'octokit';
import { Button } from '../components/ui/Button';
import { Timer } from '../components/ui/Timer';
import { RunnerSelector } from '../components/tracker/RunnerSelector';
import { TrackerGrid } from '../components/tracker/TrackerGrid';
import { fetchRunners, createRunResult, fetchLatestRunTimes } from '../lib/github';
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
  const [seedTimes, setSeedTimes] = useState<Record<string, number>>({});

  // Timer state
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Late runner state
  const [showAddLateRunner, setShowAddLateRunner] = useState(false);
  const [lateRunnerName, setLateRunnerName] = useState('');
  const [selectedLateRunner, setSelectedLateRunner] = useState<string>('');

  // Race photo state
  const [racePhoto, setRacePhoto] = useState<File | null>(null);

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

    const loadSeedTimes = async () => {
       try {
         const times = await fetchLatestRunTimes(octokit);
         setSeedTimes(times);
       } catch (e) {
         // ignore
       }
    };

    load();
    loadSeedTimes();
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
    // Sort by seed times (quickest first), with unseeded runners at the end alphabetically
    const sortedRunners = [...selectedRunners].sort((a, b) => {
      const timeA = seedTimes[a.id];
      const timeB = seedTimes[b.id];

      // If both have times, sort ascending (faster first)
      if (timeA !== undefined && timeB !== undefined) return timeA - timeB;

      // If only A has time, A comes first
      if (timeA !== undefined) return -1;

      // If only B has time, B comes first
      if (timeB !== undefined) return 1;

      // Neither has time, sort alphabetical
      return (a.nickname || a.name).localeCompare(b.nickname || b.name);
    });

    const liveParticipants: LiveParticipant[] = sortedRunners.map((runner) => ({
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

  // Add a late runner (they start NOW, not at race start time)
  const handleAddLateRunner = useCallback(() => {
    const now = Date.now();

    if (selectedLateRunner) {
      // Adding an existing registered runner
      const runner = runners.find((r) => r.id === selectedLateRunner);
      if (runner && !participants.some((p) => p.runnerId === runner.id)) {
        const newParticipant: LiveParticipant = {
          runnerId: runner.id,
          repoId: runner.id,
          runnerName: runner.name,
          smallLoops: 0,
          mediumLoops: 0,
          longLoops: 0,
          startTime: now,
          status: 'running',
        };
        setParticipants((prev) => [...prev, newParticipant]);
      }
    } else if (lateRunnerName.trim()) {
      // Adding a guest with a name
      const guestId = `guest-${now}-${Math.random().toString(36).substring(2, 7)}`;
      const newParticipant: LiveParticipant = {
        runnerId: guestId,
        repoId: 'guest',
        runnerName: lateRunnerName.trim(),
        smallLoops: 0,
        mediumLoops: 0,
        longLoops: 0,
        startTime: now,
        status: 'running',
      };
      setParticipants((prev) => [...prev, newParticipant]);
    }

    // Reset modal state
    setShowAddLateRunner(false);
    setLateRunnerName('');
    setSelectedLateRunner('');
  }, [runners, participants, selectedLateRunner, lateRunnerName]);

  // End run and go to review
  const handleEndRun = () => {
    setIsRunning(false);
    setState('review');
  };

  // Save results to GitHub
  const handleSaveResults = async () => {
    try {
      const now = new Date();

      if (!racePhoto) {
        alert('Please take/upload a race photo first!');
        return;
      }

      await createRunResult(octokit, {
        date: now,
        photoBlob: racePhoto,
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
      setRacePhoto(null);
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

        {/* Add Late Runner Button */}
        <div className="mt-6 text-center">
          <Button
            onClick={() => setShowAddLateRunner(true)}
            variant="secondary"
            size="sm"
          >
            ➕ Add Late Runner
          </Button>
        </div>

        {/* Late Runner Modal */}
        {showAddLateRunner && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-600 shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-orange">Add Late Runner</h3>

              {/* Select existing runner */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  Select Registered Runner
                </label>
                <select
                  value={selectedLateRunner}
                  onChange={(e) => {
                    setSelectedLateRunner(e.target.value);
                    if (e.target.value) setLateRunnerName('');
                  }}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-base"
                >
                  <option value="">-- Select --</option>
                  {runners
                    .filter((r) => !participants.some((p) => p.runnerId === r.id))
                    .map((runner) => (
                      <option key={runner.id} value={runner.id}>
                        {runner.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="text-center text-gray-500 text-sm my-3">— OR —</div>

              {/* Add guest */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  Add Guest (Name)
                </label>
                <input
                  type="text"
                  value={lateRunnerName}
                  onChange={(e) => {
                    setLateRunnerName(e.target.value);
                    if (e.target.value) setSelectedLateRunner('');
                  }}
                  placeholder="e.g. Sarah"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-base placeholder:text-gray-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowAddLateRunner(false);
                    setLateRunnerName('');
                    setSelectedLateRunner('');
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLateRunner}
                  variant="success"
                  disabled={!selectedLateRunner && !lateRunnerName.trim()}
                  className="flex-1"
                >
                  Add Runner
                </Button>
              </div>
            </div>
          </div>
        )}
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


        {/* Photo Upload */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <h3 className="font-semibold mb-4">Race Photo 📸</h3>
          <p className="text-gray-400 text-sm mb-4">
             Take a photo of the group or the finishing moment. This is required for the website.
          </p>
          <input
            type="file"
            accept="image/*"
            capture="environment" // Prefer rear camera on mobile
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setRacePhoto(e.target.files[0]);
              }
            }}
            className="block w-full text-sm text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-orange file:text-white
              hover:file:bg-orange/90"
          />
          {racePhoto && (
            <div className="mt-4">
               <p className="text-green text-sm mb-2">✅ Photo Selected: {racePhoto.name}</p>
               <img
                 src={URL.createObjectURL(racePhoto)}
                 alt="Preview"
                 className="w-full h-48 object-cover rounded-lg border border-gray-600"
               />
            </div>
          )}
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
