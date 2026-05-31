import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'dummy-api-key',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'dummy-auth-domain.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'dummy-project-id',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'dummy-bucket.appspot.com',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:123456789012:web:abcdef1234567890',
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-ABCDEF1234'
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.warn('[Firebase] Frontend Firebase configuration is incomplete. OAuth and analytics may be unavailable.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const authPersistenceReady =
  typeof window !== 'undefined'
    ? setPersistence(auth, browserLocalPersistence)
        .then(() => {
          console.info('[Firebase] Auth persistence set to local');
        })
        .catch((error) => {
          console.error('[Firebase] Failed to set auth persistence', error);
        })
    : Promise.resolve();

// Initialize Analytics (only in browser environment)
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('Analytics initialization failed:', error);
  }
}

// Initialize OAuth providers
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// Configure OAuth providers
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

githubProvider.setCustomParameters({
  prompt: 'select_account'
});

// Set redirect URL for OAuth providers
googleProvider.addScope('email');
googleProvider.addScope('profile');

githubProvider.addScope('user:email');
githubProvider.addScope('read:user');

// Ping function to verify Firebase connection
export async function pingFirebase() {
  try {
    // Try to get current auth state as connection test
    await auth.authStateReady();
    return { success: true, message: 'Firebase connection verified' };
  } catch (error) {
    console.error('Firebase ping failed:', error);
    return { success: false, message: error.message || 'Connection failed', error };
  }
}

export { app, auth, db, analytics, googleProvider, githubProvider, authPersistenceReady };
