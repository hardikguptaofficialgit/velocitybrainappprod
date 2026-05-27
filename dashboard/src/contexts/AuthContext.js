import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { signOut, onAuthStateChanged, signInWithRedirect, signInWithPopup, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider, githubProvider, authPersistenceReady } from '../lib/firebase';
import { getErrorMessage, isBackendUnavailable } from '../lib/network';
import { apiBaseUrl, resolveApiUrl } from '../lib/api';

// Configure axios defaults
axios.defaults.baseURL = apiBaseUrl || '';

const AuthContext = createContext();

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
  const isMobileBrowser = useCallback(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }, []);

  const isLocalhostHost = useCallback(() => {
    try {
      if (typeof window === 'undefined') return false;
      const host = window.location.hostname;
      return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch {
      return false;
    }
  }, []);

  // In production, prefer redirect flow to avoid COOP/COEP popup issues that can
  // block popup window polling and cause some browsers to appear "stuck".
  const shouldUseOAuthPopup = useCallback(() => !isMobileBrowser() && isLocalhostHost(), [
    isLocalhostHost,
    isMobileBrowser
  ]);

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

  const syncFirebaseUser = useCallback(async (firebaseUser) => {
    if (!firebaseUser?.uid) {
      return {
        success: false,
        error: 'Missing Firebase user information.'
      };
    }

    if (syncedUidRef.current === firebaseUser.uid && user?.id === firebaseUser.uid) {
      console.info('[Auth] Firebase user already synced in this session', {
        uid: firebaseUser.uid
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

        const { user: syncedUser, token } = response.data;
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
        console.error('[Auth] Backend session sync failed', {
          code: backendErr?.code,
          status: backendErr?.response?.status,
          message: backendErr?.message,
          response: backendErr?.response?.data
        });
        if (!isBackendUnavailable(backendErr)) {
          console.error('Backend sync error:', backendErr?.response?.data || backendErr.message);
        }
        syncedUidRef.current = null;
        clearAuthState();
        return {
          success: false,
          error: getErrorMessage(backendErr, 'Unable to complete sign-in right now.')
        };
      } finally {
        syncInFlightRef.current.delete(firebaseUser.uid);
      }
    })();

    syncInFlightRef.current.set(firebaseUser.uid, syncPromise);
    return syncPromise;
  }, [clearAuthState, setAuthState, user]);

  // Configure axios defaults on mount
  useEffect(() => {
    const token = localStorage.getItem('velocitybrain_token');
      console.info('[Auth] Bootstrapping axios auth header', {
        apiBaseUrl: axios.defaults.baseURL || '(relative /api)',
        hasStoredToken: Boolean(token)
    });
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!authBootstrapRef.current) {
      authBootstrapRef.current = (async () => {
        try {
          await authPersistenceReady;
          const redirectResult = await getRedirectResult(auth);

          if (redirectResult?.user) {
            console.info('[Auth] OAuth redirect result found', {
              email: redirectResult.user.email,
              providerId: redirectResult.providerId
            });
            setFirebaseUser(redirectResult.user);
            await syncFirebaseUser(redirectResult.user);
          }
        } catch (err) {
          console.error('[Auth] OAuth redirect result error', err);
          if (isMounted) {
            setError(err.message || 'OAuth sign-in failed');
          }
        }

        await auth.authStateReady();
      })();
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextFirebaseUser) => {
      if (!isMounted) return;

      try {
        await authBootstrapRef.current;

        if (nextFirebaseUser) {
          console.info('[Auth] Firebase auth state changed: signed in', {
            email: nextFirebaseUser.email,
            uid: nextFirebaseUser.uid
          });
          setFirebaseUser(nextFirebaseUser);
          const result = await syncFirebaseUser(nextFirebaseUser);
          if (!result.success && isMounted) {
            setError(result.error || 'Unable to complete sign-in right now.');
          }
          return;
        }

        console.info('[Auth] Firebase auth state changed: signed out');
        clearAuthState();
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
  }, [clearAuthState, setAuthState, syncFirebaseUser]);

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

      return { success: true };
    } catch (err) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        try {
          console.warn('[Auth] GitHub popup blocked, falling back to redirect');
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
  }, [shouldUseOAuthPopup, syncFirebaseUser]);

  const loginWithGoogle = useCallback(async () => {
    try {
      console.info('[Auth] Starting Google OAuth redirect');
      setLoading(true);
      setError(null);

      await authPersistenceReady;

      if (!shouldUseOAuthPopup()) {
        console.info('[Auth] Using Google redirect flow');
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

      return { success: true };
    } catch (err) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        try {
          console.warn('[Auth] Google popup blocked, falling back to redirect');
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
  }, [shouldUseOAuthPopup, syncFirebaseUser]);

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
