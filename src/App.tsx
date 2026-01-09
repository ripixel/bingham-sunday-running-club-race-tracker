import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useGitHub } from './hooks/useGitHub';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

function App() {
  const { token, isAuthenticated, isLoading: isAuthLoading, signIn, signOut } = useAuth();
  const { loadRunners } = useGitHub(token);

  useEffect(() => {
    if (isAuthenticated) {
      loadRunners();
    }
  }, [isAuthenticated, loadRunners]);

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

  if (!isAuthenticated) {
    return <LoginPage onSignIn={signIn} isLoading={isAuthLoading} />;
  }

  return (
    <DashboardPage onSignOut={signOut}>
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Welcome to Race Director Dashboard!</h2>
        <p className="text-gray-400 mb-8">
          Use the navigation above to manage runners or start tracking a live run.
        </p>
        <div className="max-w-2xl mx-auto text-left text-gray-300 space-y-4">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-orange mb-2">📋 Manage Runners</h3>
            <p>View all registered runners and add new members to the club.</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-green mb-2">🏃 Live Run Tracker</h3>
            <p>Track loops, times, and distances during Sunday runs in real-time.</p>
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}

export default App;
