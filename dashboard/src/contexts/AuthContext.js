import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { signOut, onAuthStateChanged, signInWithRedirect, signInWithPopup, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider, githubProvider, authPersistenceReady } from '../lib/firebase';
import { getErrorMessage, isBackendUnavailable } from '../lib/network';
import { apiBaseUrl, resolveApiUrl } from '../lib/api';

// Configure axios defaults
axios.defaults.baseURL = apiBaseUrl || '';

const AuthContext = createContext();
const OAUTH_REDIRECT_PENDING_KEY = 'velocitybrain_oauth_redirect_pending';
const OAUTH_REDIRECT_PROVIDER_KEY = 'velocitybrain_oauth_redirect_provider';
const AUTH_BOOTSTRAP_TIMEOUT_MS = 10000;

const withTimeout = (promise, timeoutMs, label) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(new Error(`${label} timed out`));
  }, timeoutMs);

  promise
    .then((value) => {
      clearTimeout(timer);
      resolve(value);
    })
    .catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
});

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
  const authBootstrapRef = useRef(null);
  const syncInFlightRef = useRef(new Map());
  const syncedUidRef = useRef(null);
  const axiosAuthInterceptorIdRef = useRef(null);
  const isMobileBrowser = useCallback(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }, []);

  // Use popup for desktop browsers so Firebase can complete the OAuth handshake
  // without relying on redirect storage state after the full page reload.
  const shouldUseOAuthPopup = useCallback(() => {
    return !isMobileBrowser();
  }, [isMobileBrowser]);

  const setAuthState = useCallback((userData, token) => {
    console.info('[Auth] Setting auth state', {
      userId: userData?.id,
      email: userData?.email,
      hasToken: Boolean(token)
    });

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

  const rememberOAuthRedirect = useCallback((provider) => {
    sessionStorage.setItem(OAUTH_REDIRECT_PENDING_KEY, '1');
    sessionStorage.setItem(OAUTH_REDIRECT_PROVIDER_KEY, provider);
  }, []);

  const clearOAuthRedirect = useCallback(() => {
    sessionStorage.removeItem(OAUTH_REDIRECT_PENDING_KEY);
    sessionStorage.removeItem(OAUTH_REDIRECT_PROVIDER_KEY);
  }, []);

  const buildOAuthReturnError = useCallback((provider) => (
    `${provider || 'OAuth'} sign-in returned to VelocityBrain, but no Firebase session was created. ` +
    'Please make sure this domain is authorized in Firebase Authentication and try again.'
  ), []);

  const clearAuthState = useCallback(() => {
    console.info('[Auth] Clearing auth state');
    localStorage.removeItem('velocitybrain_token');
    localStorage.removeItem('velocitybrain_user');
    delete axios.defaults.headers.common.Authorization;
    syncedUidRef.current = null;
    syncInFlightRef.current.clear();
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const restoreSessionFromStorage = useCallback(async () => {
    const storedToken = localStorage.getItem('velocitybrain_token');
    const storedUserRaw = localStorage.getItem('velocitybrain_user');

    if (!storedToken || !storedUserRaw) {
      return { success: false };
    }

    try {
      const storedUser = JSON.parse(storedUserRaw);
      axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
      const response = await axios.get(resolveApiUrl('/api/auth/me'));
      const restoredUser = response.data?.user || storedUser;
      setError(null);
      setAuthState(restoredUser, storedToken);
      console.info('[Auth] Restored session from stored token', {
        userId: restoredUser?.id,
        email: restoredUser?.email
      });
      return { success: true, user: restoredUser };
    } catch (restoreErr) {
      console.warn('[Auth] Stored session is no longer valid', {
        status: restoreErr?.response?.status,
        message: restoreErr?.message
      });
      return { success: false };
    }
  }, [setAuthState]);

  const syncFirebaseUser = useCallback(async (firebaseUser) => {
    if (!firebaseUser?.uid) {
      return {
        success: false,
        error: 'Missing Firebase user information.'
      };
    }

    if (syncedUidRef.current === firebaseUser.uid && user) {
      console.info('[Auth] Firebase user already synced in this session', {
        uid: firebaseUser.uid,
        userId: user.id
      });
      return { success: true, user };
    }

    if (syncInFlightRef.current.has(firebaseUser.uid)) {
      console.info('[Auth] Reusing in-flight backend session sync', {
        uid: firebaseUser.uid
      });
      return syncInFlightRef.current.get(firebaseUser.uid);
    }

    console.info('[Auth] Syncing Firebase user with backend', {
      uid: firebaseUser?.uid,
          email: firebaseUser?.email,
          apiBaseUrl: axios.defaults.baseURL || '(relative /api)'
        });

    const syncPromise = (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const response = await axios.post(resolveApiUrl('/api/auth/firebase-session'), {
          idToken
        });

        if (response.data?.requiresTwoFactor) {
          const twoFactorMessage =
            response.data?.message ||
            'Two-factor authentication is required. Complete 2FA from Settings after signing in with email and password.';
          setError(twoFactorMessage);
          return { success: false, error: twoFactorMessage };
        }

        const { user: syncedUser, token } = response.data;
        if (!syncedUser?.id || !token) {
          const missingSessionMessage = 'Sign-in succeeded with Google, but the server did not return a session. Please try again.';
          setError(missingSessionMessage);
          return { success: false, error: missingSessionMessage };
        }

        console.info('[Auth] Backend session sync succeeded', {
          userId: syncedUser?.id,
          email: syncedUser?.email,
          hasToken: Boolean(token)
        });
        syncedUidRef.current = firebaseUser.uid;
        setError(null);
        setAuthState(syncedUser, token);
        return { success: true, user: syncedUser };
      } catch (backendErr) {
        const status = backendErr?.response?.status;
        console.error('[Auth] Backend session sync failed', {
          code: backendErr?.code,
          status,
          message: backendErr?.message,
          response: backendErr?.response?.data
        });
        if (!isBackendUnavailable(backendErr)) {
          console.error('Backend sync error:', backendErr?.response?.data || backendErr.message);
        }

        syncedUidRef.current = null;

        const errorMessage = getErrorMessage(backendErr, 'Unable to complete sign-in right now.');

        // Keep the Firebase session for transient/server errors so the user can retry
        // without getting stuck in a "picked Gmail then back to login" loop.
        if (isBackendUnavailable(backendErr) || status === 503 || status >= 500) {
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }

        if (status === 401) {
          try {
            await signOut(auth);
          } catch (signOutErr) {
            console.warn('[Auth] Firebase sign-out after failed sync', signOutErr);
          }
          clearAuthState();
          return { success: false, error: errorMessage };
        }

        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        syncInFlightRef.current.delete(firebaseUser.uid);
      }
    })();

    syncInFlightRef.current.set(firebaseUser.uid, syncPromise);
    return syncPromise;
  }, [clearAuthState, setAuthState, user]);

  const resyncBackendSession = useCallback(async () => {
    if (!firebaseUser) return { success: false, error: 'Missing Firebase user information.' };
    return syncFirebaseUser(firebaseUser);
  }, [firebaseUser, syncFirebaseUser]);

  // Configure axios defaults on mount and restore a valid stored session immediately.
  useEffect(() => {
    let cancelled = false;

    const bootstrapStoredSession = async () => {
      const token = localStorage.getItem('velocitybrain_token');
      console.info('[Auth] Bootstrapping axios auth header', {
        apiBaseUrl: axios.defaults.baseURL || '(relative /api)',
        hasStoredToken: Boolean(token)
      });
      if (!token) {
        return;
      }

      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      const restored = await restoreSessionFromStorage();
      if (!cancelled && restored.success) {
        setLoading(false);
      }
    };

    bootstrapStoredSession();

    return () => {
      cancelled = true;
    };
  }, [restoreSessionFromStorage]);

  useEffect(() => {
    if (axiosAuthInterceptorIdRef.current != null) {
      return;
    }

    axiosAuthInterceptorIdRef.current = axios.interceptors.response.use(
      (response) => response,
      async (axiosError) => {
        const status = axiosError?.response?.status;
        const originalRequest = axiosError?.config;

        if (!originalRequest || status !== 401) {
          return Promise.reject(axiosError);
        }

        if (originalRequest.__velocitybrainRetriedAuth) {
          return Promise.reject(axiosError);
        }

        if (isBackendUnavailable(axiosError)) {
          return Promise.reject(axiosError);
        }

        originalRequest.__velocitybrainRetriedAuth = true;

        try {
          const syncResult = await resyncBackendSession();
          if (!syncResult?.success) {
            return Promise.reject(axiosError);
          }

          const refreshedToken = localStorage.getItem('velocitybrain_token');
          if (refreshedToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          }

          return axios(originalRequest);
        } catch (refreshErr) {
          return Promise.reject(axiosError);
        }
      }
    );
  }, [resyncBackendSession]);

  useEffect(() => {
    let isMounted = true;

    if (!authBootstrapRef.current) {
      authBootstrapRef.current = (async () => {
        try {
          await authPersistenceReady;
          const redirectResult = await withTimeout(
            getRedirectResult(auth),
            AUTH_BOOTSTRAP_TIMEOUT_MS,
            'OAuth redirect result'
          );

          if (redirectResult?.user) {
            console.info('[Auth] OAuth redirect result found', {
              email: redirectResult.user.email,
              providerId: redirectResult.providerId
            });
            setFirebaseUser(redirectResult.user);
            const syncResult = await syncFirebaseUser(redirectResult.user);
            if (syncResult.success) {
              clearOAuthRedirect();
            } else if (isMounted) {
              setError(syncResult.error || 'Unable to complete sign-in right now.');
            }
          }

          await withTimeout(
            auth.authStateReady(),
            AUTH_BOOTSTRAP_TIMEOUT_MS,
            'Firebase auth state'
          );

          if (!redirectResult?.user && sessionStorage.getItem(OAUTH_REDIRECT_PENDING_KEY) && !auth.currentUser) {
            const provider = sessionStorage.getItem(OAUTH_REDIRECT_PROVIDER_KEY);
            console.warn('[Auth] OAuth redirect returned without a Firebase user', {
              provider
            });
            clearOAuthRedirect();
            if (isMounted) {
              setError(buildOAuthReturnError(provider));
            }
          }
        } catch (err) {
          console.error('[Auth] OAuth redirect result error', err);
          if (isMounted) {
            const hasPendingRedirect = sessionStorage.getItem(OAUTH_REDIRECT_PENDING_KEY);
            if (hasPendingRedirect && !auth.currentUser) {
              clearOAuthRedirect();
              setError(err.message || 'OAuth sign-in failed');
            }
          }
        }
      })();
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextFirebaseUser) => {
      if (!isMounted) return;

      try {
        if (nextFirebaseUser) {
          console.info('[Auth] Firebase auth state changed: signed in', {
            email: nextFirebaseUser.email,
            uid: nextFirebaseUser.uid
          });
          setFirebaseUser(nextFirebaseUser);
          const result = await syncFirebaseUser(nextFirebaseUser);
          if (result.success) {
            clearOAuthRedirect();
          } else if (isMounted) {
            setError(result.error || 'Unable to complete sign-in right now.');
          }
          return;
        }

        console.info('[Auth] Firebase auth state changed: signed out');
        const restored = await restoreSessionFromStorage();
        if (!restored.success) {
          clearAuthState();
        }
      } catch (err) {
        console.error('[Auth] Auth state listener error', err);
        clearAuthState();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [buildOAuthReturnError, clearAuthState, clearOAuthRedirect, restoreSessionFromStorage, setAuthState, syncFirebaseUser]);

  const logout = useCallback(async () => {
    try {
      console.info('[Auth] Logging out current user');
      await signOut(auth);
    } catch (err) {
      console.error('[Auth] Firebase logout error', err);
    }
    
    clearAuthState();
    setError(null);
  }, [clearAuthState]);

  const updateUser = useCallback((userData) => {
    setAuthState(userData, localStorage.getItem('velocitybrain_token'));
  }, [setAuthState]);

  const completeAuth = useCallback((userData, token) => {
    setError(null);
    setAuthState(userData, token);
  }, [setAuthState]);

  const loginWithGithub = useCallback(async () => {
    try {
      console.info('[Auth] Starting GitHub OAuth redirect');
      setLoading(true);
      setError(null);

      await authPersistenceReady;

      if (!shouldUseOAuthPopup()) {
        console.info('[Auth] Using GitHub redirect flow');
        rememberOAuthRedirect('GitHub');
        await signInWithRedirect(auth, githubProvider);
        return { success: true };
      }

      console.info('[Auth] Using GitHub popup flow');
      const result = await signInWithPopup(auth, githubProvider);
      setFirebaseUser(result.user);
      const syncResult = await syncFirebaseUser(result.user);
      setLoading(false);
      if (!syncResult.success) {
        setError(syncResult.error || 'Unable to complete sign-in right now.');
        return { success: false, error: syncResult.error };
      }

      return { success: true, user: syncResult.user };
    } catch (err) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        try {
          console.warn('[Auth] GitHub popup blocked, falling back to redirect');
          rememberOAuthRedirect('GitHub');
          await signInWithRedirect(auth, githubProvider);
          return { success: true };
        } catch (redirectErr) {
          const errorMessage = redirectErr.message || 'GitHub login failed';
          setError(errorMessage);
          setLoading(false);
          return { success: false, error: errorMessage };
        }
      }

      const errorMessage = err.message || 'GitHub login failed';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [rememberOAuthRedirect, shouldUseOAuthPopup, syncFirebaseUser]);

  const loginWithGoogle = useCallback(async () => {
    try {
      console.info('[Auth] Starting Google OAuth redirect');
      setLoading(true);
      setError(null);

      await authPersistenceReady;

      if (!shouldUseOAuthPopup()) {
        console.info('[Auth] Using Google redirect flow');
        rememberOAuthRedirect('Google');
        await signInWithRedirect(auth, googleProvider);
        return { success: true };
      }

      console.info('[Auth] Using Google popup flow');
      const result = await signInWithPopup(auth, googleProvider);
      setFirebaseUser(result.user);
      const syncResult = await syncFirebaseUser(result.user);
      setLoading(false);
      if (!syncResult.success) {
        setError(syncResult.error || 'Unable to complete sign-in right now.');
        return { success: false, error: syncResult.error };
      }

      return { success: true, user: syncResult.user };
    } catch (err) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        try {
          console.warn('[Auth] Google popup blocked, falling back to redirect');
          rememberOAuthRedirect('Google');
          await signInWithRedirect(auth, googleProvider);
          return { success: true };
        } catch (redirectErr) {
          const errorMessage = redirectErr.message || 'Google login failed';
          setError(errorMessage);
          setLoading(false);
          return { success: false, error: errorMessage };
        }
      }

      const errorMessage = err.message || 'Google login failed';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [rememberOAuthRedirect, shouldUseOAuthPopup, syncFirebaseUser]);

  const value = {
    user,
    firebaseUser,
    loading,
    error,
    logout,
    loginWithGithub,
    loginWithGoogle,
    updateUser,
    completeAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
