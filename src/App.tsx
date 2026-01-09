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

  useEffect(() => {
    if (token) {
      setOctokit(createGitHubClient(token));
    } else {
      setOctokit(null);
    }
  }, [token]);

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
      {/* Header */}
      <header className="bg-gray-800 border-b-4 border-orange shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">
                <span className="text-orange">Race Director</span>
              </h1>
              <div className="flex h-8 gap-1">
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

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentPage('runners')}
              className={`
                px-4 py-3 font-semibold transition-colors
                ${currentPage === 'runners'
                  ? 'text-orange border-b-2 border-orange'
                  : 'text-gray-400 hover:text-gray-200'
                }
              `}
            >
              Manage Runners
            </button>
            <button
              onClick={() => setCurrentPage('tracker')}
              className={`
                px-4 py-3 font-semibold transition-colors
                ${currentPage === 'tracker'
                  ? 'text-green border-b-2 border-green'
                  : 'text-gray-400 hover:text-gray-200'
                }
              `}
            >
              Live Run Tracker
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {currentPage === 'runners' && <RunnersPage octokit={octokit} />}
          {currentPage === 'tracker' && <TrackerPage octokit={octokit} />}
        </div>
      </main>
    </div>
  );
}

export default App;
