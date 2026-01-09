import { Button } from '../components/ui/Button';

interface LoginPageProps {
  onSignIn: () => Promise<void>;
  isLoading: boolean;
}

export function LoginPage({ onSignIn, isLoading }: LoginPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-orange">Bingham</span>{' '}
            <span className="text-white">Sunday Running Club</span>
          </h1>
          <div className="flex gap-2 justify-center my-4">
            <div className="w-12 h-1 bg-orange"></div>
            <div className="w-12 h-1 bg-pink"></div>
            <div className="w-12 h-1 bg-green"></div>
            <div className="w-12 h-1 bg-blue"></div>
          </div>
          <h2 className="text-2xl text-gray-300 mb-2">Race Director Dashboard</h2>
          <p className="text-gray-400 text-sm">
            Track live runs and manage runner data
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
          <p className="text-gray-300 mb-6 text-center">
            Sign in with GitHub to access the dashboard. You'll need write access to the website repository.
          </p>
          <Button
            onClick={onSignIn}
            disabled={isLoading}
            size="lg"
            className="w-full"
          >
            {isLoading ? 'Signing in...' : 'Sign in with GitHub'}
          </Button>
        </div>

        <p className="text-gray-500 text-xs text-center mt-6">
          This uses the same OAuth credentials as Decap CMS
        </p>
      </div>
    </div>
  );
}
