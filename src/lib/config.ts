// Firebase configuration
// These should match your existing Firebase project for the -website
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// OAuth endpoint from the existing -website Firebase function
export const OAUTH_AUTH_URL = import.meta.env.VITE_OAUTH_AUTH_URL || 'https://binghamsundayrunningclub.co.uk/api/auth';

// GitHub repository details
export const GITHUB_OWNER = 'ripixel';
export const GITHUB_REPO = 'bingham-sunday-running-club-website';
export const GITHUB_BRANCH = 'main';
