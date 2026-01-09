import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../components/ui/Button';

interface DashboardPageProps {
  onSignOut: () => void;
  children?: ReactNode;
}

type Page = 'runners' | 'tracker';

export function DashboardPage({ onSignOut, children }: DashboardPageProps) {
  const [currentPage, setCurrentPage] = useState<Page>('runners');

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
            <Button onClick={onSignOut} variant="secondary" size="sm">
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
          {children || (
            <div className="text-center text-gray-400 py-12">
              Select a page from the navigation
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
