import { useState, useEffect } from 'react';
import { authenticateWithGitHub, getStoredToken, storeToken, clearToken } from '../lib/auth';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = getStoredToken();
    if (storedToken) {
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  const signIn = async () => {
    try {
      setIsLoading(true);
      const newToken = await authenticateWithGitHub();
      storeToken(newToken);
      setToken(newToken);
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    clearToken();
    setToken(null);
  };

  return {
    token,
    isAuthenticated: !!token,
    isLoading,
    signIn,
    signOut,
  };
}
