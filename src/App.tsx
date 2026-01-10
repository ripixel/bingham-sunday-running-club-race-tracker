import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { createGitHubClient } from './lib/github';
import { LoginPage } from './pages/LoginPage';
import { RunnersPage } from './pages/RunnersPage';
import { TrackerPage } from './pages/TrackerPage';
import { Button } from './components/ui/Button';
import type { Octokit } from 'octokit';

type Page = 'runners' | 'tracker';

function App() {
  const { token, isAuthenticated, isLoading: isAuthLoading, signIn, signOut } = useAuth();
  const [octokit, setOctokit] = useState<Octokit | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('runners');
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      setOctokit(createGitHubClient(token));
    } else {
      setOctokit(null);
    }
  }, [token]);

  // Check for active race on mount and auto-redirect
  useEffect(() => {
    const savedState = localStorage.getItem('current_run_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // If there's an active race (running state with participants)
        if (parsed.state === 'running' && parsed.participants?.length > 0) {
          setCurrentPage('tracker');
          setToast('🏃 Race in progress - resuming...');
          setTimeout(() => setToast(null), 3000);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !octokit) {
    return <LoginPage onSignIn={signIn} isLoading={isAuthLoading} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Compact (Hidden in immersive mode) */}
      {!immersiveMode && (
        <header className="bg-gray-800 border-b-2 border-orange shadow-lg safe-area-top">
          <div className="max-w-7xl mx-auto px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">
                  <span className="text-orange">Race Director</span>
                </h1>
                <div className="flex h-5 gap-0.5">
                  <div className="w-1 bg-orange"></div>
                  <div className="w-1 bg-pink"></div>
                  <div className="w-1 bg-green"></div>
                  <div className="w-1 bg-blue"></div>
                </div>
              </div>
              <Button onClick={signOut} variant="secondary" size="sm">
                Sign Out
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* Navigation - Compact tabs (Hidden in immersive mode) */}
      {!immersiveMode && (
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-3">
            <div className="flex">
              <button
                onClick={() => setCurrentPage('runners')}
                className={`
                  px-3 py-2 font-semibold text-sm transition-colors min-h-[40px]
                  ${currentPage === 'runners'
                    ? 'text-orange border-b-2 border-orange'
                    : 'text-gray-400 hover:text-gray-200'
                  }
                `}
              >
                Runners
              </button>
              <button
                onClick={() => setCurrentPage('tracker')}
                className={`
                  px-3 py-2 font-semibold text-sm transition-colors min-h-[40px]
                  ${currentPage === 'tracker'
                    ? 'text-green border-b-2 border-green'
                    : 'text-gray-400 hover:text-gray-200'
                  }
                `}
              >
                Live Tracker
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content - Compact padding */}
      <main className="flex-1 bg-gray-900 safe-area-bottom">
        <div className={`max-w-7xl mx-auto px-3 ${immersiveMode ? 'py-1' : 'py-3'}`}>
          {currentPage === 'runners' && <RunnersPage octokit={octokit} />}
          {currentPage === 'tracker' && (
            <TrackerPage
              octokit={octokit}
              setImmersiveMode={setImmersiveMode}
            />
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
