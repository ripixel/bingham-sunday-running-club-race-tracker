import { OAUTH_AUTH_URL } from './config';

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
}

/**
 * Trigger GitHub OAuth flow using the existing Firebase function
 * Opens popup window and listens for postMessage callback
 */
export async function authenticateWithGitHub(): Promise<string> {
  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      OAUTH_AUTH_URL,
      'GitHub OAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      reject(new Error('Failed to open popup window'));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      // Security: verify origin if needed
      const message = event.data;

      if (typeof message === 'string') {
        // Handshake: Popup is ready and asking for acknowledgment
        if (message === 'authorizing:github') {
          // Send acknowledgment back to popup to trigger the success message
          if (popup && !popup.closed) {
            popup.postMessage('acknowledge', event.origin);
          }
          return;
        }

        // Format: "authorization:github:success:{"token":"...","provider":"github"}"
        if (message.startsWith('authorization:github:success:')) {
          const jsonStr = message.replace('authorization:github:success:', '');
          try {
            const data = JSON.parse(jsonStr);
            window.removeEventListener('message', handleMessage);
            popup.close();
            resolve(data.token);
          } catch (error) {
            reject(new Error('Failed to parse OAuth response'));
          }
        } else if (message.startsWith('authorization:github:error:')) {
          const errorStr = message.replace('authorization:github:error:', '');
          window.removeEventListener('message', handleMessage);
          popup.close();
          reject(new Error(`OAuth error: ${errorStr}`));
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if popup was closed manually
    const popupInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupInterval);
        window.removeEventListener('message', handleMessage);
        reject(new Error('OAuth popup was closed'));
      }
    }, 500);
  });
}

/**
 * Get stored auth token from localStorage
 */
export function getStoredToken(): string | null {
  return localStorage.getItem('github_access_token');
}

/**
 * Store auth token in localStorage
 */
export function storeToken(token: string): void {
  localStorage.setItem('github_access_token', token);
}

/**
 * Clear stored auth token
 */
export function clearToken(): void {
  localStorage.removeItem('github_access_token');
}
