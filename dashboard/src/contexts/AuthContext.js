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

const POPUP_BLOCKED_CODES = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request'
]);

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

  const syncInFlightRef = useRef(new Map());
  const syncedUidRef = useRef(null);
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
  }, []);

  const clearOAuthPending = useCallback(() => {
    localStorage.removeItem(OAUTH_PENDING_KEY);
    localStorage.removeItem(OAUTH_PROVIDER_KEY);
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

      const response = await axios.get(resolveApiUrl('/api/auth/me'));
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

  const hasActiveBackendSession = useCallback((nextFirebaseUser) => {
    if (!nextFirebaseUser?.uid) {
      return false;
    }

    const storedToken = localStorage.getItem('velocitybrain_token');
    const storedUserRaw = localStorage.getItem('velocitybrain_user');
    if (!storedToken || !storedUserRaw) {
      return false;
    }

    try {
      const storedUser = JSON.parse(storedUserRaw);
      return (
        syncedUidRef.current === nextFirebaseUser.uid ||
        storedUser?.id === nextFirebaseUser.uid ||
        (storedUser?.email && storedUser.email === nextFirebaseUser.email)
      );
    } catch {
      return false;
    }
  }, []);

  const syncFirebaseUser = useCallback(async (nextFirebaseUser, { force = false } = {}) => {
    if (!nextFirebaseUser?.uid) {
      return { success: false, error: 'Missing Firebase user information.' };
    }

    if (!force && hasActiveBackendSession(nextFirebaseUser)) {
      const storedUserRaw = localStorage.getItem('velocitybrain_user');
      const storedToken = localStorage.getItem('velocitybrain_token');
      if (storedUserRaw && storedToken) {
        const storedUser = JSON.parse(storedUserRaw);
        syncedUidRef.current = nextFirebaseUser.uid;
        setAuthState(storedUser, storedToken);
        return { success: true, user: storedUser };
      }
    }

    if (syncedUidRef.current === nextFirebaseUser.uid && user) {
      return { success: true, user };
    }

    if (syncInFlightRef.current.has(nextFirebaseUser.uid)) {
      return syncInFlightRef.current.get(nextFirebaseUser.uid);
    }

    const syncPromise = (async () => {
      try {
        const idToken = await nextFirebaseUser.getIdToken();
        const response = await axios.post(resolveApiUrl('/api/auth/firebase-session'), { idToken });

        if (response.data?.requiresTwoFactor) {
          const message =
            response.data?.message ||
            'Two-factor authentication is required. Sign in with email and password to complete 2FA.';
          setError(message);
          return { success: false, error: message };
        }

        const { user: syncedUser, token } = response.data;
        if (!syncedUser?.id || !token) {
          const message = 'Sign-in succeeded, but the server did not return a session. Please try again.';
          setError(message);
          return { success: false, error: message };
        }

        syncedUidRef.current = nextFirebaseUser.uid;
        sessionStorage.setItem(SESSION_VALIDATED_AT_KEY, String(Date.now()));
        setError(null);
        setAuthState(syncedUser, token);
        clearOAuthPending();
        return { success: true, user: syncedUser };
      } catch (backendErr) {
        syncedUidRef.current = null;
        const status = backendErr?.response?.status;
        const errorMessage = getErrorMessage(backendErr, 'Unable to complete sign-in right now.');

        if (isBackendUnavailable(backendErr) || status === 503 || status >= 500) {
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }

        if (status === 401) {
          try {
            await signOut(auth);
          } catch {
            // ignore sign-out errors
          }
          clearAuthState();
        }

        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        syncInFlightRef.current.delete(nextFirebaseUser.uid);
      }
    })();

    syncInFlightRef.current.set(nextFirebaseUser.uid, syncPromise);
    return syncPromise;
  }, [clearAuthState, clearOAuthPending, hasActiveBackendSession, setAuthState, user]);

  const handleFirebaseUser = useCallback(async (nextFirebaseUser, options = {}) => {
    if (!nextFirebaseUser) {
      return { success: false };
    }

    setFirebaseUser(nextFirebaseUser);
    return syncFirebaseUser(nextFirebaseUser, options);
  }, [syncFirebaseUser]);

  const completeOAuthRedirect = useCallback(async () => {
    if (redirectHandledRef.current) {
      return null;
    }
    redirectHandledRef.current = true;

    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        console.info('[Auth] OAuth redirect completed', {
          email: result.user.email,
          providerId: result.providerId
        });
        return result.user;
      }
    } catch (redirectErr) {
      console.error('[Auth] OAuth redirect result failed', redirectErr);
      if (isOAuthPending()) {
        const provider = localStorage.getItem(OAUTH_PROVIDER_KEY) || 'OAuth';
        setError(redirectErr.message || `${provider} sign-in failed. Please try again.`);
      }
      clearOAuthPending();
    }

    return null;
  }, [clearOAuthPending, isOAuthPending]);

  const signInWithProvider = useCallback(async (provider, providerLabel) => {
    setLoading(true);
    setError(null);

    try {
      console.info(`[Auth] Starting ${providerLabel} popup sign-in`);
      const result = await signInWithPopup(auth, provider);
      const syncResult = await handleFirebaseUser(result.user, { force: true });
      setLoading(false);

      if (!syncResult.success) {
        return { success: false, error: syncResult.error };
      }

      return { success: true, user: syncResult.user };
    } catch (popupErr) {
      if (!POPUP_BLOCKED_CODES.has(popupErr?.code)) {
        const message = popupErr.message || `${providerLabel} sign-in failed.`;
        setError(message);
        setLoading(false);
        return { success: false, error: message };
      }

      try {
        console.info(`[Auth] ${providerLabel} popup blocked, using redirect`);
        markOAuthPending(providerLabel);
        redirectHandledRef.current = false;
        await signInWithRedirect(auth, provider);
        return { success: true, pendingRedirect: true };
      } catch (redirectErr) {
        clearOAuthPending();
        const message = redirectErr.message || `${providerLabel} sign-in failed.`;
        setError(message);
        setLoading(false);
        return { success: false, error: message };
      }
    }
  }, [clearOAuthPending, handleFirebaseUser, markOAuthPending]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const storedToken = localStorage.getItem('velocitybrain_token');
      if (storedToken) {
        axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
        const restored = await restoreSessionFromStorage();
        if (restored.success && active) {
          setLoading(false);
        }
      }

      await auth.authStateReady();

      const redirectUser = await completeOAuthRedirect();
      if (redirectUser && active) {
        await handleFirebaseUser(redirectUser, { force: true });
      } else if (isOAuthPending() && !auth.currentUser && active) {
        const provider = localStorage.getItem(OAUTH_PROVIDER_KEY) || 'OAuth';
        clearOAuthPending();
        setError(
          `${provider} sign-in returned without a session. Confirm this domain is authorized in Firebase ` +
          'and listed under Google Cloud → Credentials → Authorised JavaScript origins.'
        );
      }
    };

    bootstrap().finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (nextFirebaseUser) => {
      if (!active) return;

      if (nextFirebaseUser) {
        await handleFirebaseUser(nextFirebaseUser);
        setLoading(false);
        return;
      }

      if (isOAuthPending()) {
        return;
      }

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
    handleFirebaseUser,
    isOAuthPending,
    restoreSessionFromStorage
  ]);

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

        const syncResult = await syncFirebaseUser(auth.currentUser);
        if (!syncResult.success) {
          return Promise.reject(axiosError);
        }

        const refreshedToken = localStorage.getItem('velocitybrain_token');
        if (refreshedToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        }

        return axios(originalRequest);
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
