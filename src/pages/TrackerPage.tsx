import { useState, useEffect, useCallback, useRef } from 'react';
import type { Octokit } from 'octokit';
import { Button } from '../components/ui/Button';
import { Timer } from '../components/ui/Timer';
import { RunnerSelector } from '../components/tracker/RunnerSelector';
import { TrackerGrid } from '../components/tracker/TrackerGrid';
import { fetchRunners, createRunResult, fetchLatestRunTimes, fetchStagedRuns } from '../lib/github';
import type { Runner, TrackedRunner } from '../types/runner';
import type { StagedRun } from '../lib/github';
import type { LiveParticipant } from '../types/result';

interface TrackerPageProps {
  octokit: Octokit;
  setImmersiveMode?: (value: boolean) => void;
}

type TrackerState = 'setup' | 'running' | 'review';

export function TrackerPage({ octokit, setImmersiveMode }: TrackerPageProps) {
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

  // Remove runner state (mid-race)
  const [showRemoveRunner, setShowRemoveRunner] = useState(false);

  // Cancel race state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Add runner state (review screen)
  const [showAddRunnerReview, setShowAddRunnerReview] = useState(false);
  const [reviewRunnerName, setReviewRunnerName] = useState('');
  const [selectedReviewRunner, setSelectedReviewRunner] = useState<string>('');

  // Ref to track if we've restored from localStorage (to force timer effect to kick in)
  const hasRestoredRef = useRef(false);

  // Race photo state
  const [racePhoto, setRacePhoto] = useState<File | null>(null);

  // Custom Run Details
  const [runTitle, setRunTitle] = useState('');
  const [runDescription, setRunDescription] = useState('');

  // Re-upload staged run state
  const [showReUploadModal, setShowReUploadModal] = useState(false);
  const [stagedRuns, setStagedRuns] = useState<StagedRun[]>([]);
  const [isLoadingStagedRuns, setIsLoadingStagedRuns] = useState(false);
  const [reUploadDate, setReUploadDate] = useState<string | null>(null); // Track if we're re-uploading
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null); // Preserve photo from staged run

  // Save loading state
  const [isSaving, setIsSaving] = useState(false);

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

  // Restore state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('current_run_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Only restore if valid start time
        if (parsed.startTime && parsed.participants && parsed.participants.length > 0) {
           const now = Date.now();
           const restoredIsRunning = parsed.isRunning !== false; // Default to true if missing

           setParticipants(parsed.participants);

           if (restoredIsRunning) {
             // Calculate how much time has passed since we last saved
             // If we have savedAt, use that to calculate additional elapsed time
             const savedAt = parsed.savedAt || parsed.startTime;
             const savedElapsed = parsed.elapsedTime || 0;
             const additionalElapsed = now - savedAt;
             const totalElapsed = savedElapsed + additionalElapsed;

             // Set startTime to now minus total elapsed so timer math works
             setStartTime(now - totalElapsed);
             setElapsedTime(totalElapsed);
             setState('running');
             setImmersiveMode?.(true);
             hasRestoredRef.current = true;
             setIsRunning(true);
           } else {
             // If was paused/review
             if (parsed.state === 'review') {
                setState('review');
                setStartTime(parsed.startTime);
                setElapsedTime(parsed.finishTime || parsed.elapsedTime || 0);
             } else {
                // Paused but not in review - rare case
                const savedAt = parsed.savedAt || parsed.startTime;
                const savedElapsed = parsed.elapsedTime || 0;
                const additionalElapsed = now - savedAt;
                const totalElapsed = savedElapsed + additionalElapsed;

                setStartTime(now - totalElapsed);
                setElapsedTime(totalElapsed);
                setState('running');
                setImmersiveMode?.(true);
                hasRestoredRef.current = true;
                setIsRunning(true);
             }
           }
        }
      } catch (e) {
        console.error("Failed to restore state", e);
      }
    }
  }, []);

  // Persist state
  useEffect(() => {
    if (state === 'running' || state === 'review') {
      const stateToSave = {
        startTime,
        elapsedTime,  // Store current elapsed time
        savedAt: Date.now(),  // Store when we saved so we can calculate drift
        participants,
        isRunning,
        state,
        finishTime: state === 'review' ? elapsedTime : undefined
      };
      localStorage.setItem('current_run_state', JSON.stringify(stateToSave));
    } else if (state === 'setup') {
      // Clear storage if back to setup (manually cancelled or finished)
      // BUT be careful not to clear on initial mount before restore.
      // We can rely on handleEndRun to clear it.
    }
  }, [startTime, participants, isRunning, state, elapsedTime]);

  // Wake Lock
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if (isRunning && 'wakeLock' in navigator) {
        try {
          // @ts-ignore
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.error(err);
        }
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [isRunning]);

  // Timer effect
  useEffect(() => {
    if (!isRunning) return;
    if (startTime === 0) return; // Don't start timer if startTime not set yet

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);



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
      nickname: runner.nickname, // Preserve for guests
      smallLoops: 0,
      mediumLoops: 0,
      longLoops: 0,
      startTime: now,
      status: 'running',
    }));

    setParticipants(liveParticipants);

    // Enable Immersive Mode
    setImmersiveMode?.(true);
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

  // Update finish time directly (for time adjustments)
  const handleUpdateTime = useCallback((runnerId: string, newTimeMs: number) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.runnerId === runnerId) {
          return {
            ...p,
            finishTime: newTimeMs,
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
        nickname: lateRunnerName.trim(), // Preserve nickname for guests
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

  // Remove runner from race
  const handleRemoveRunner = useCallback((runnerId: string) => {
    setParticipants((prev) => prev.filter((p) => p.runnerId !== runnerId));
  }, []);

  // Add runner on review screen
  const handleAddRunnerReview = useCallback(() => {
    const now = Date.now();

    if (selectedReviewRunner) {
      // Adding an existing registered runner
      const runner = runners.find((r) => r.id === selectedReviewRunner);
      if (runner && !participants.some((p) => p.runnerId === runner.id)) {
        const newParticipant: LiveParticipant = {
          runnerId: runner.id,
          repoId: runner.id,
          runnerName: runner.name,
          smallLoops: 0,
          mediumLoops: 0,
          longLoops: 0,
          startTime: now,
          finishTime: 0, // Will need to be edited
          status: 'completed',
        };
        setParticipants((prev) => [...prev, newParticipant]);
      }
    } else if (reviewRunnerName.trim()) {
      // Adding a guest with a name
      const guestId = `guest-${now}-${Math.random().toString(36).substring(2, 7)}`;
      const newParticipant: LiveParticipant = {
        runnerId: guestId,
        repoId: 'guest',
        runnerName: reviewRunnerName.trim(),
        nickname: reviewRunnerName.trim(),
        smallLoops: 0,
        mediumLoops: 0,
        longLoops: 0,
        startTime: now,
        finishTime: 0, // Will need to be edited
        status: 'completed',
      };
      setParticipants((prev) => [...prev, newParticipant]);
    }

    // Reset modal state
    setShowAddRunnerReview(false);
    setReviewRunnerName('');
    setSelectedReviewRunner('');
  }, [runners, participants, selectedReviewRunner, reviewRunnerName]);

  // End run and go to review
  const handleEndRun = () => {
    setIsRunning(false);
    setState('review');
    // Keep immersive mode or disable? Keep it for review, maybe?
    // User probably wants to see header to navigate away if needed?
    // Let's keep it immersive for review to prevent accidental navigation.
  };

  // Cancel race - reset everything
  const handleCancelRace = () => {
    setIsRunning(false);
    setState('setup');
    setParticipants([]);
    setStartTime(0);
    setElapsedTime(0);
    setShowCancelConfirm(false);
    setImmersiveMode?.(false);
    localStorage.removeItem('current_run_state');
  };

  // Save results to GitHub
  const handleSaveResults = async () => {
    setIsSaving(true);
    try {
      // Use the original date if re-uploading, otherwise current date
      const dateToUse = reUploadDate ? new Date(reUploadDate) : new Date();

      await createRunResult(octokit, {
        date: dateToUse,
        photoBlob: racePhoto || undefined,
        existingPhotoUrl: existingPhotoUrl || undefined,
        participants: participants.map((p) => ({
          runnerId: p.runnerId, // Use full runnerId for conversion logic
          nickname: p.nickname,
          convertToRunner: p.convertToRunner,
          runnerNameOverride: p.runnerNameOverride,
          smallLoops: p.smallLoops,
          mediumLoops: p.mediumLoops,
          longLoops: p.longLoops,
          startTime: p.startTime!,
          endTime: p.startTime! + (p.finishTime || 0),
        })),
        title: runTitle,
        description: runDescription
      });

      alert('Results saved successfully!');

      // Reset state
      setState('setup');
      setParticipants([]);
      setElapsedTime(0);
      setRacePhoto(null);
      setRunTitle('');
      setRunDescription('');
      setReUploadDate(null);
      setExistingPhotoUrl(null);
      setImmersiveMode?.(false);
      localStorage.removeItem('current_run_state');
    } catch (error) {
      console.error('Failed to save results:', error);
      alert('Failed to save results. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Open re-upload modal and fetch staged runs
  const handleOpenReUpload = async () => {
    setShowReUploadModal(true);
    setIsLoadingStagedRuns(true);
    try {
      const runs = await fetchStagedRuns(octokit);
      setStagedRuns(runs);
    } catch (error) {
      console.error('Failed to fetch staged runs:', error);
      alert('Failed to load staged runs.');
    } finally {
      setIsLoadingStagedRuns(false);
    }
  };

  // Parse time string (MM:SS or HH:MM:SS) to milliseconds
  const parseTimeToMs = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      // HH:MM:SS
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    // MM:SS
    return (parts[0] * 60 + parts[1]) * 1000;
  };

  // Load a staged run into review state
  const handleLoadStagedRun = (run: StagedRun) => {
    // Convert staged run participants to LiveParticipant format
    const now = Date.now();
    const loadedParticipants: LiveParticipant[] = run.participants.map((p, index) => {
      const timeMs = parseTimeToMs(p.time);
      const isGuest = p.runner === 'guest';

      return {
        runnerId: isGuest ? `guest-reupload-${index}` : p.runner,
        repoId: p.runner,
        runnerName: p.guestName || runners.find(r => r.id === p.runner)?.name || p.runner,
        nickname: isGuest ? p.guestName : undefined,
        smallLoops: p.smallLoops,
        mediumLoops: p.mediumLoops,
        longLoops: p.longLoops,
        startTime: now - timeMs, // Fake start time so finishTime calculation works
        finishTime: timeMs,
        status: 'completed',
      };
    });

    setParticipants(loadedParticipants);
    setRunTitle(run.title || '');
    setRunDescription(run.body || '');
    // Use the full dateTime to preserve original time, not just the date
    setReUploadDate(run.dateTime);
    // Preserve the existing photo URL so we don't lose it if no new photo is uploaded
    setExistingPhotoUrl(run.mainPhoto || null);
    setShowReUploadModal(false);
    setState('review');
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
    return (
      <div>
        <RunnerSelector runners={runners} onStartRun={handleStartRun} />

        {/* Re-Upload Section */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-3">Need to fix a previously uploaded run?</p>
            <Button onClick={handleOpenReUpload} variant="secondary" size="sm">
              📂 Re-Upload Staged Run
            </Button>
          </div>
        </div>

        {/* Re-Upload Modal */}
        {showReUploadModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-600 shadow-2xl max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-orange">Re-Upload Staged Run</h3>
              <p className="text-gray-400 text-sm mb-4">
                Select a previously staged run to re-upload with corrections.
              </p>

              {isLoadingStagedRuns ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange"></div>
                  <span className="ml-3 text-gray-400">Loading staged runs...</span>
                </div>
              ) : stagedRuns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No staged runs found.
                </div>
              ) : (
                <div className="space-y-3">
                  {stagedRuns.map((run) => (
                    <button
                      key={run.date}
                      onClick={() => handleLoadStagedRun(run)}
                      className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition-colors"
                    >
                      <div className="font-semibold text-white">{run.date}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        {run.participants.length} participants
                        {run.title && <span className="ml-2">• {run.title}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Cancel */}
              <div className="mt-6">
                <Button
                  onClick={() => setShowReUploadModal(false)}
                  variant="secondary"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
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
          onUpdateTime={handleUpdateTime}
          onFinish={handleFinish}
          onComplete={handleComplete}
          onUndoComplete={handleUndoComplete}
          onResume={handleResume}
        />

        {/* Add Late Runner Button */}
        <div className="mt-6 flex justify-center gap-4 flex-wrap">
          <Button
            onClick={() => setShowAddLateRunner(true)}
            variant="secondary"
            size="sm"
          >
            ➕ Add Late Runner
          </Button>
          <Button
            onClick={() => setShowRemoveRunner(true)}
            variant="secondary"
            size="sm"
          >
            ➖ Remove Runner
          </Button>
          <Button
            onClick={() => setShowCancelConfirm(true)}
            variant="danger"
            size="sm"
          >
            🚫 Cancel Race
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

        {/* Cancel Race Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-red-500 shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-red-400">⚠️ Cancel Race?</h3>
              <p className="text-gray-300 mb-6">
                This will <strong>permanently discard</strong> all current race data including times and lap counts. This action cannot be undone.
              </p>
              <p className="text-gray-400 text-sm mb-6">
                Use this if the race was started accidentally.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowCancelConfirm(false)}
                  variant="secondary"
                  className="flex-1"
                >
                  Keep Racing
                </Button>
                <Button
                  onClick={handleCancelRace}
                  variant="danger"
                  className="flex-1"
                >
                  Yes, Cancel Race
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Runner Modal */}
        {showRemoveRunner && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-600 shadow-2xl max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-orange">Remove Runner</h3>
              <p className="text-gray-400 text-sm mb-4">
                Select a runner to remove from this race. Their time and laps will be discarded.
              </p>

              {participants.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No runners in the race.
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {participants.map((p) => (
                    <button
                      key={p.runnerId}
                      onClick={() => {
                        if (confirm(`Remove ${p.runnerName} from the race?`)) {
                          handleRemoveRunner(p.runnerId);
                          setShowRemoveRunner(false);
                        }
                      }}
                      className="w-full text-left p-3 bg-gray-700 hover:bg-red-900/50 rounded-lg border border-gray-600 hover:border-red-500 transition-colors flex items-center justify-between"
                    >
                      <span className="text-white">{p.runnerName}</span>
                      <span className="text-red-400 text-sm">✕ Remove</span>
                    </button>
                  ))}
                </div>
              )}

              <Button
                onClick={() => setShowRemoveRunner(false)}
                variant="secondary"
                className="w-full"
              >
                Cancel
              </Button>
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
          <h3 className="font-semibold mb-4">Run Summary — Edit Participants</h3>
          <div className="space-y-4">
            {participants.map((p) => {
              const isGuest = p.runnerId.startsWith('guest-');
              const finishMinutes = Math.floor((p.finishTime || 0) / 60000);
              const finishSeconds = Math.floor(((p.finishTime || 0) % 60000) / 1000);

              return (
                <div key={p.runnerId + p.runnerName} className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  {/* Name Row */}
                  <div className="flex items-center justify-between mb-3">
                    {isGuest ? (
                      <div className="flex-1 mr-4">
                        <label className="block text-xs text-gray-400 mb-1">Guest Name</label>
                        <input
                          type="text"
                          value={p.nickname || p.runnerName || ''}
                          onChange={(e) => {
                            setParticipants(prev => prev.map(part =>
                              part.runnerId === p.runnerId
                                ? { ...part, nickname: e.target.value, runnerName: e.target.value }
                                : part
                            ));
                          }}
                          placeholder="Enter name"
                          className="w-full px-3 py-2 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:border-orange focus:outline-none"
                        />
                      </div>
                    ) : (
                      <span className="font-medium text-lg">{p.runnerName}</span>
                    )}
                    <div className="flex items-center gap-2">
                      {isGuest && <span className="text-sm text-gray-400">(Guest)</span>}
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${p.runnerName} from the results?`)) {
                            handleRemoveRunner(p.runnerId);
                          }
                        }}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>

                  {/* Time Edit */}
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">Finish Time</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={finishMinutes}
                        onChange={(e) => {
                          const mins = Math.max(0, parseInt(e.target.value) || 0);
                          const newTime = (mins * 60 + finishSeconds) * 1000;
                          setParticipants(prev => prev.map(part =>
                            part.runnerId === p.runnerId
                              ? { ...part, finishTime: newTime }
                              : part
                          ));
                        }}
                        className="w-16 px-2 py-2 text-center text-lg font-mono bg-gray-600 border border-gray-500 rounded text-white focus:border-orange focus:outline-none"
                      />
                      <span className="text-gray-400 text-lg">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={finishSeconds.toString().padStart(2, '0')}
                        onChange={(e) => {
                          const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                          const newTime = (finishMinutes * 60 + secs) * 1000;
                          setParticipants(prev => prev.map(part =>
                            part.runnerId === p.runnerId
                              ? { ...part, finishTime: newTime }
                              : part
                          ));
                        }}
                        className="w-16 px-2 py-2 text-center text-lg font-mono bg-gray-600 border border-gray-500 rounded text-white focus:border-orange focus:outline-none"
                      />
                      <span className="text-gray-500 text-sm ml-2">(mm:ss)</span>
                    </div>
                  </div>

                  {/* Loop Counts */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Small Loops */}
                    <div className="bg-gray-800/50 rounded p-2 text-center">
                      <div className="text-xs uppercase font-bold text-pink mb-1">Small</div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setParticipants(prev => prev.map(part =>
                            part.runnerId === p.runnerId
                              ? { ...part, smallLoops: Math.max(0, part.smallLoops - 1) }
                              : part
                          ))}
                          disabled={p.smallLoops === 0}
                          className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold"
                        >−</button>
                        <span className="font-mono font-bold w-8 text-center">{p.smallLoops}</span>
                        <button
                          onClick={() => setParticipants(prev => prev.map(part =>
                            part.runnerId === p.runnerId
                              ? { ...part, smallLoops: part.smallLoops + 1 }
                              : part
                          ))}
                          className="w-8 h-8 flex items-center justify-center rounded bg-pink hover:bg-pink/90 text-white font-bold"
                        >+</button>
                      </div>
                    </div>

                    {/* Medium Loops */}
                    <div className="bg-gray-800/50 rounded p-2 text-center">
                      <div className="text-xs uppercase font-bold text-green mb-1">Medium</div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setParticipants(prev => prev.map(part =>
                            part.runnerId === p.runnerId
                              ? { ...part, mediumLoops: Math.max(0, part.mediumLoops - 1) }
                              : part
                          ))}
                          disabled={p.mediumLoops === 0}
                          className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold"
                        >−</button>
                        <span className="font-mono font-bold w-8 text-center">{p.mediumLoops}</span>
                        <button
                          onClick={() => setParticipants(prev => prev.map(part =>
                            part.runnerId === p.runnerId
                              ? { ...part, mediumLoops: part.mediumLoops + 1 }
                              : part
                          ))}
                          className="w-8 h-8 flex items-center justify-center rounded bg-green hover:bg-green/90 text-white font-bold"
                        >+</button>
                      </div>
                    </div>

                    {/* Long Loops */}
                    <div className="bg-gray-800/50 rounded p-2 text-center">
                      <div className="text-xs uppercase font-bold text-blue mb-1">Long</div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setParticipants(prev => prev.map(part =>
                            part.runnerId === p.runnerId
                              ? { ...part, longLoops: Math.max(0, part.longLoops - 1) }
                              : part
                          ))}
                          disabled={p.longLoops === 0}
                          className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold"
                        >−</button>
                        <span className="font-mono font-bold w-8 text-center">{p.longLoops}</span>
                        <button
                          onClick={() => setParticipants(prev => prev.map(part =>
                            part.runnerId === p.runnerId
                              ? { ...part, longLoops: part.longLoops + 1 }
                              : part
                          ))}
                          className="w-8 h-8 flex items-center justify-center rounded bg-blue hover:bg-blue/90 text-white font-bold"
                        >+</button>
                      </div>
                    </div>
                  </div>

                  {/* Guest conversion checkbox */}
                  {isGuest && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={p.convertToRunner || false}
                          onChange={(e) => {
                            setParticipants(prev => prev.map(part =>
                              part.runnerId === p.runnerId
                                ? { ...part, convertToRunner: e.target.checked }
                                : part
                            ));
                          }}
                          className="w-4 h-4 rounded border-gray-500 text-green focus:ring-green"
                        />
                        <span className="text-sm text-green">Make Full Runner</span>
                      </label>
                      {p.convertToRunner && (
                        <div className="mt-2">
                          <input
                            type="text"
                            value={p.runnerNameOverride || p.nickname || ''}
                            onChange={(e) => {
                              setParticipants(prev => prev.map(part =>
                                part.runnerId === p.runnerId
                                  ? { ...part, runnerNameOverride: e.target.value }
                                  : part
                              ));
                            }}
                            placeholder="Runner name for profile"
                            className="w-full px-3 py-2 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:border-green focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Runner Button (Review) */}
        <div className="mb-6">
          <Button
            onClick={() => setShowAddRunnerReview(true)}
            variant="secondary"
            size="sm"
          >
            ➕ Add Runner
          </Button>
        </div>

        {/* Add Runner Modal (Review) */}
        {showAddRunnerReview && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-600 shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-orange">Add Runner</h3>

              {/* Select existing runner */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  Select Registered Runner
                </label>
                <select
                  value={selectedReviewRunner}
                  onChange={(e) => {
                    setSelectedReviewRunner(e.target.value);
                    if (e.target.value) setReviewRunnerName('');
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
                  value={reviewRunnerName}
                  onChange={(e) => {
                    setReviewRunnerName(e.target.value);
                    if (e.target.value) setSelectedReviewRunner('');
                  }}
                  placeholder="e.g. Sarah"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-base placeholder:text-gray-500"
                />
              </div>

              <p className="text-gray-400 text-sm mb-4">
                ⚠️ Added runners will have 0:00 time and 0 loops. Edit them after adding.
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowAddRunnerReview(false);
                    setReviewRunnerName('');
                    setSelectedReviewRunner('');
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddRunnerReview}
                  variant="success"
                  disabled={!selectedReviewRunner && !reviewRunnerName.trim()}
                  className="flex-1"
                >
                  Add Runner
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Re-Upload Banner */}
          {reUploadDate && (
            <div className="bg-orange/20 border border-orange rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-orange font-semibold">📂 Re-Uploading:</span>
                  <span className="ml-2 text-white">{reUploadDate}</span>
                </div>
                <Button
                  onClick={() => {
                    setState('setup');
                    setParticipants([]);
                    setReUploadDate(null);
                    setRunTitle('');
                    setRunDescription('');
                  }}
                  variant="secondary"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
              <p className="text-sm text-gray-300 mt-2">
                This will update the existing staged run. Photo is optional if you want to keep the original.
              </p>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
            <h2 className="text-2xl font-bold mb-4">{reUploadDate ? 'Confirm Re-Upload' : 'Run Complete! 🏁'}</h2>
            <div className="text-4xl font-mono font-bold text-green mb-2">
              {/* If we have an exact time from handleEndRun, we could use it, but elapsedTime is fine */}
              {/* Note: In review state, elapsedTime holds the final time */}
              {Math.floor(elapsedTime / 60000)}:
              {((elapsedTime % 60000) / 1000).toFixed(0).padStart(2, '0')}
            </div>
            <p className="text-gray-400">
              {participants.filter(p => p.status === 'completed').length} finishers
            </p>
          </div>

          {/* Custom Run Details */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6 space-y-4">
             <h3 className="font-semibold mb-2">Run Details (Optional)</h3>

             <div>
               <label className="block text-sm text-gray-400 mb-1">Title</label>
               <input
                 type="text"
                 value={runTitle}
                 onChange={(e) => setRunTitle(e.target.value)}
                 placeholder="e.g. Muddy Mayhem (Optional)"
                 className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-orange focus:outline-none"
               />
             </div>

             <div>
               <label className="block text-sm text-gray-400 mb-1">Description / Race Report</label>
               <textarea
                 value={runDescription}
                 onChange={(e) => setRunDescription(e.target.value)}
                 placeholder="How was the run? Any highlights?"
                 className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-orange focus:outline-none h-24 resize-none"
               />
             </div>
          </div>

        {/* Photo Upload */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <h3 className="font-semibold mb-4">Race Photo 📸</h3>
          <p className="text-gray-400 text-sm mb-4">
            {reUploadDate
              ? 'Upload the photo for this run. You can re-use the original photo or upload a new one.'
              : 'Take a photo of the group or the finishing moment. This is required for the website.'
            }
          </p>
          <input
            type="file"
            accept="image/*"
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

        </div>

        <div className="flex gap-4">
          <Button onClick={handleSaveResults} variant="success" size="lg" disabled={isSaving}>
            {isSaving ? (
              <>
                <span className="animate-spin inline-block mr-2">⏳</span>
                Saving...
              </>
            ) : (
              '💾 Save to GitHub'
            )}
          </Button>
          <Button onClick={() => setState('running')} variant="secondary" disabled={isSaving}>
            ← Back to Tracking
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
