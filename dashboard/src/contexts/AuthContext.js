import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '../lib/firebase';
import { getErrorMessage, isBackendUnavailable } from '../lib/network';
import { apiBaseUrl, resolveApiUrl } from '../lib/api';

axios.defaults.baseURL = apiBaseUrl || '';

const AuthContext = createContext();

const OAUTH_PENDING_KEY = 'velocitybrain_oauth_pending';
const OAUTH_PROVIDER_KEY = 'velocitybrain_oauth_provider';
const SESSION_VALIDATED_AT_KEY = 'velocitybrain_session_validated_at';
const SESSION_VALIDATE_MS = 5 * 60 * 1000;
const BACKEND_SYNC_TIMEOUT_MS = 30_000;

const POPUP_BLOCKED_CODES = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request'
]);

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s. Please try again.`)),
        ms
      )
    )
  ]);

const safeErrorMessage = (raw, fallback = 'Something went wrong. Please try again.') => {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw?.message && typeof raw.message === 'string' && raw.message.trim()) return raw.message.trim();
  return fallback;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [oauthPending, setOauthPending] = useState(() => localStorage.getItem(OAUTH_PENDING_KEY) === '1');

  // Tracks in-flight backend sync promises keyed by Firebase uid
  const syncInFlightRef = useRef(new Map());
  // Tracks the uid that was last successfully synced to prevent redundant re-syncs
  const syncedUidRef = useRef(null);
  // Set to true while signInWithPopup/Redirect is actively in progress;
  // onAuthStateChanged defers backend sync to the popup flow while this is set.
  const popupInProgressRef = useRef(false);
  // Ensures getRedirectResult is only called once per page load
  const redirectHandledRef = useRef(false);

  const setAuthState = useCallback((userData, token) => {
    localStorage.setItem('velocitybrain_user', JSON.stringify(userData));
    if (token) {
      localStorage.setItem('velocitybrain_token', token);
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      localStorage.removeItem('velocitybrain_token');
      delete axios.defaults.headers.common.Authorization;
    }
    setUser(userData);
  }, []);

  const clearAuthState = useCallback(() => {
    localStorage.removeItem('velocitybrain_token');
    localStorage.removeItem('velocitybrain_user');
    delete axios.defaults.headers.common.Authorization;
    syncedUidRef.current = null;
    syncInFlightRef.current.clear();
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const markOAuthPending = useCallback((provider) => {
    localStorage.setItem(OAUTH_PENDING_KEY, '1');
    localStorage.setItem(OAUTH_PROVIDER_KEY, provider);
    setOauthPending(true);
  }, []);

  const clearOAuthPending = useCallback(() => {
    localStorage.removeItem(OAUTH_PENDING_KEY);
    localStorage.removeItem(OAUTH_PROVIDER_KEY);
    setOauthPending(false);
  }, []);

  const isOAuthPending = useCallback(
    () => localStorage.getItem(OAUTH_PENDING_KEY) === '1',
    []
  );

  const restoreSessionFromStorage = useCallback(async ({ forceValidate = false } = {}) => {
    const storedToken = localStorage.getItem('velocitybrain_token');
    const storedUserRaw = localStorage.getItem('velocitybrain_user');

    if (!storedToken || !storedUserRaw) {
      return { success: false };
    }

    try {
      const storedUser = JSON.parse(storedUserRaw);
      axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;

      const validatedAt = Number(sessionStorage.getItem(SESSION_VALIDATED_AT_KEY) || 0);
      const recentlyValidated = !forceValidate && validatedAt && Date.now() - validatedAt < SESSION_VALIDATE_MS;

      if (recentlyValidated) {
        setError(null);
        setAuthState(storedUser, storedToken);
        return { success: true, user: storedUser, fromCache: true };
      }

      const response = await withTimeout(
        axios.get(resolveApiUrl('/api/auth/me')),
        BACKEND_SYNC_TIMEOUT_MS,
        '/api/auth/me'
      );
      const restoredUser = response.data?.user || storedUser;
      sessionStorage.setItem(SESSION_VALIDATED_AT_KEY, String(Date.now()));
      setError(null);
      setAuthState(restoredUser, storedToken);
      return { success: true, user: restoredUser };
    } catch (err) {
      if (err?.response?.status === 429) {
        try {
          const storedUser = JSON.parse(storedUserRaw);
          setAuthState(storedUser, storedToken);
          return { success: true, user: storedUser, fromCache: true };
        } catch {
          return { success: false };
        }
      }
      return { success: false };
    }
  }, [setAuthState]);

  /**
   * Exchange a Firebase ID token for a backend JWT.
   * When force=true, cancels any existing in-flight sync for this uid so a fresh
   * call is always made (important after a new OAuth sign-in).
   */
  const syncFirebaseUser = useCallback(async (nextFirebaseUser, { force = false } = {}) => {
    if (!nextFirebaseUser?.uid) {
      return { success: false, error: 'Missing Firebase user information.' };
    }

    const uid = nextFirebaseUser.uid;

    // On forced calls (post-popup), cancel any stale in-flight promise so the
    // new sign-in always hits the backend fresh.
    if (force) {
      syncInFlightRef.current.delete(uid);
      syncedUidRef.current = null;
    }

    // Avoid redundant syncs when the session is already established for this uid.
    if (!force && syncedUidRef.current === uid && user) {
      return { success: true, user };
    }

    // Deduplicate concurrent sync calls for the same uid.
    if (syncInFlightRef.current.has(uid)) {
      return syncInFlightRef.current.get(uid);
    }

    const syncPromise = (async () => {
      try {
        console.info(`[Auth] syncFirebaseUser start uid=${uid} force=${force} ts=${Date.now()}`);
        const idToken = await nextFirebaseUser.getIdToken(force);

        const response = await withTimeout(
          axios.post(resolveApiUrl('/api/auth/firebase-session'), { idToken }),
          BACKEND_SYNC_TIMEOUT_MS,
          'POST /api/auth/firebase-session'
        );

        if (response.data?.requiresTwoFactor) {
          const message = safeErrorMessage(
            response.data?.message,
            'Two-factor authentication is required. Sign in with email and password to complete 2FA.'
          );
          setError(message);
          return { success: false, error: message, requiresTwoFactor: true };
        }

        const { user: syncedUser, token } = response.data;
        if (!syncedUser?.id || !token) {
          const message = 'Sign-in succeeded but the server did not return a session. Please try again.';
          setError(message);
          return { success: false, error: message };
        }

        syncedUidRef.current = uid;
        sessionStorage.setItem(SESSION_VALIDATED_AT_KEY, String(Date.now()));
        setError(null);
        setAuthState(syncedUser, token);
        clearOAuthPending();
        console.info(`[Auth] syncFirebaseUser success uid=${uid} ts=${Date.now()}`);
        return { success: true, user: syncedUser };
      } catch (backendErr) {
        syncedUidRef.current = null;
        const status = backendErr?.response?.status;
        const errorMessage = safeErrorMessage(
          getErrorMessage(backendErr, null),
          'Unable to complete sign-in right now. Please try again.'
        );

        console.error(`[Auth] syncFirebaseUser failed uid=${uid} status=${status} ts=${Date.now()}`, backendErr?.message || backendErr);

        if (isBackendUnavailable(backendErr) || status === 503 || (status >= 500 && status < 600)) {
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }

        if (status === 401) {
          try {
            await signOut(auth);
          } catch {
            // ignore
          }
          clearAuthState();
        }

        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        syncInFlightRef.current.delete(uid);
      }
    })();

    syncInFlightRef.current.set(uid, syncPromise);
    return syncPromise;
  }, [clearAuthState, clearOAuthPending, setAuthState, user]);

  const completeOAuthRedirect = useCallback(async () => {
    if (redirectHandledRef.current) return null;
    redirectHandledRef.current = true;

    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        console.info('[Auth] OAuth redirect completed', {
          email: result.user.email,
          providerId: result.providerId,
          ts: Date.now()
        });
        return result.user;
      }
    } catch (redirectErr) {
      console.error('[Auth] OAuth redirect result failed', redirectErr);
      if (isOAuthPending()) {
        const provider = localStorage.getItem(OAUTH_PROVIDER_KEY) || 'OAuth';
        setError(safeErrorMessage(
          redirectErr.message,
          `${provider} sign-in failed. Please try again.`
        ));
      }
      clearOAuthPending();
    }

    return null;
  }, [clearOAuthPending, isOAuthPending]);

  /**
   * Initiates OAuth sign-in with popup, falling back to redirect if popups are blocked.
   */
  const signInWithProvider = useCallback(async (provider, providerLabel) => {
    setLoading(true);
    setError(null);
    popupInProgressRef.current = true;

    try {
      console.info(`[Auth] Starting ${providerLabel} popup sign-in ts=${Date.now()}`);
      let firebaseResult;

      try {
        firebaseResult = await signInWithPopup(auth, provider);
      } catch (popupErr) {
        if (!POPUP_BLOCKED_CODES.has(popupErr?.code)) {
          const message = safeErrorMessage(popupErr?.message, `${providerLabel} sign-in failed. Please try again.`);
          setError(message);
          return { success: false, error: message };
        }

        // Popup was blocked — fall back to redirect
        console.info(`[Auth] ${providerLabel} popup blocked, using redirect ts=${Date.now()}`);
        try {
          markOAuthPending(providerLabel);
          redirectHandledRef.current = false;
          popupInProgressRef.current = false;
          await signInWithRedirect(auth, provider);
          // Page will navigate away; loading resets on next page load via bootstrap
          return { success: true, pendingRedirect: true };
        } catch (redirectErr) {
          clearOAuthPending();
          const message = safeErrorMessage(redirectErr?.message, `${providerLabel} sign-in failed. Please try again.`);
          setError(message);
          return { success: false, error: message };
        }
      }

      // Popup succeeded — force a fresh backend sync (bypasses stale in-flight promises)
      setFirebaseUser(firebaseResult.user);
      const syncResult = await syncFirebaseUser(firebaseResult.user, { force: true });

      if (!syncResult.success) {
        return { success: false, error: syncResult.error };
      }

      return { success: true, user: syncResult.user };
    } finally {
      popupInProgressRef.current = false;
      setLoading(false);
    }
  }, [clearOAuthPending, markOAuthPending, syncFirebaseUser]);

  // Bootstrap: restore existing session then set up Firebase auth state listener
  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      // Restore existing backend session from localStorage immediately so the
      // app doesn't flash the login page on every refresh.
      const storedToken = localStorage.getItem('velocitybrain_token');
      if (storedToken) {
        axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
        const restored = await restoreSessionFromStorage();
        if (restored.success && active) {
          // Session restored from storage — set loading false so the app
          // renders. onAuthStateChanged will re-validate asynchronously.
          setLoading(false);
        }
      }

      await auth.authStateReady();

      // Handle pending OAuth redirect (popup-was-blocked flow)
      const redirectUser = await completeOAuthRedirect();
      if (redirectUser && active) {
        await syncFirebaseUser(redirectUser, { force: true });
      } else if (isOAuthPending() && !auth.currentUser && active) {
        const provider = localStorage.getItem(OAUTH_PROVIDER_KEY) || 'OAuth';
        clearOAuthPending();
        setError(
          `${provider} sign-in returned without a session. ` +
          'Ensure this domain is authorized in Firebase Console → Authentication → Settings → Authorized Domains.'
        );
      }
    };

    bootstrap().finally(() => {
      if (active) setLoading(false);
    });

    const unsubscribe = onAuthStateChanged(auth, async (nextFirebaseUser) => {
      if (!active) return;

      if (nextFirebaseUser) {
        // When a popup flow is in progress, signInWithProvider handles the
        // backend sync with force=true. Skip here to avoid a stale non-forced
        // sync winning the in-flight deduplication race.
        if (popupInProgressRef.current) {
          setFirebaseUser(nextFirebaseUser);
          return;
        }

        setFirebaseUser(nextFirebaseUser);

        // Only re-sync with the backend if we don't already have a live session
        // for this specific uid (avoids hammering the backend on every render).
        const existingToken = localStorage.getItem('velocitybrain_token');
        const existingUserRaw = localStorage.getItem('velocitybrain_user');
        let alreadyHasSession = false;
        if (existingToken && existingUserRaw && syncedUidRef.current === nextFirebaseUser.uid) {
          alreadyHasSession = true;
        }

        if (!alreadyHasSession) {
          await syncFirebaseUser(nextFirebaseUser);
        }

        setLoading(false);
        return;
      }

      // Firebase says no user — respect pending OAuth redirect state
      if (isOAuthPending()) return;

      const restored = await restoreSessionFromStorage();
      if (!restored.success) {
        clearAuthState();
      }
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    clearAuthState,
    clearOAuthPending,
    completeOAuthRedirect,
    isOAuthPending,
    restoreSessionFromStorage,
    syncFirebaseUser
  ]);

  // Axios interceptor: on 401, refresh Firebase token and retry once
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (axiosError) => {
        const status = axiosError?.response?.status;
        const originalRequest = axiosError?.config;

        if (!originalRequest || status !== 401 || originalRequest.__velocitybrainRetriedAuth) {
          return Promise.reject(axiosError);
        }

        if (isBackendUnavailable(axiosError) || !auth.currentUser) {
          return Promise.reject(axiosError);
        }

        originalRequest.__velocitybrainRetriedAuth = true;

        try {
          const syncResult = await syncFirebaseUser(auth.currentUser, { force: true });
          if (!syncResult.success) {
            return Promise.reject(axiosError);
          }

          const refreshedToken = localStorage.getItem('velocitybrain_token');
          if (refreshedToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          }

          return axios(originalRequest);
        } catch {
          return Promise.reject(axiosError);
        }
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, [syncFirebaseUser]);

  const logout = useCallback(async () => {
    clearAuthState();
    setError(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('[Auth] Logout failed', err);
    }
  }, [clearAuthState]);

  const updateUser = useCallback((userData) => {
    setAuthState(userData, localStorage.getItem('velocitybrain_token'));
  }, [setAuthState]);

  const completeAuth = useCallback((userData, token) => {
    setError(null);
    setAuthState(userData, token);
  }, [setAuthState]);

  const loginWithGoogle = useCallback(
    () => signInWithProvider(googleProvider, 'Google'),
    [signInWithProvider]
  );

  const loginWithGithub = useCallback(
    () => signInWithProvider(githubProvider, 'GitHub'),
    [signInWithProvider]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        oauthPending,
        error,
        logout,
        loginWithGithub,
        loginWithGoogle,
        updateUser,
        completeAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
