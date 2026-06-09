import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { account, ID, OAuthProvider } from '../lib/appwrite';
import { getErrorMessage } from '../lib/network';
import { apiBaseUrl, resolveApiUrl } from '../lib/api';

axios.defaults.baseURL = apiBaseUrl || '';

const AuthContext = createContext();

const MAGIC_URL_PENDING_KEY = 'velocitybrain_magic_url_pending';
const MAGIC_URL_PENDING_STARTED_AT_KEY = 'velocitybrain_magic_url_pending_started_at';
const MAGIC_URL_PENDING_MAX_AGE_MS = 10 * 60 * 1000;

const OAUTH_PENDING_KEY = 'velocitybrain_oauth_pending';
const OAUTH_PROVIDER_KEY = 'velocitybrain_oauth_provider';
const OAUTH_PENDING_STARTED_AT_KEY = 'velocitybrain_oauth_pending_started_at';
const SESSION_VALIDATED_AT_KEY = 'velocitybrain_session_validated_at';
const SESSION_VALIDATE_MS = 5 * 60 * 1000;
const BACKEND_SYNC_TIMEOUT_MS = 20_000;
const SESSION_RESTORE_TIMEOUT_MS = 8_000;
const OAUTH_PENDING_MAX_AGE_MS = 2 * 60 * 1000;

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

const getStoredOAuthPendingAge = () => {
  const startedAt = Number(localStorage.getItem(OAUTH_PENDING_STARTED_AT_KEY) || 0);
  return startedAt ? Date.now() - startedAt : Number.POSITIVE_INFINITY;
};

const hasFreshOAuthPendingFlag = () => (
  localStorage.getItem(OAUTH_PENDING_KEY) === '1' &&
  getStoredOAuthPendingAge() < OAUTH_PENDING_MAX_AGE_MS
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [appwriteUser, setAppwriteUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [oauthPending, setOauthPending] = useState(() => hasFreshOAuthPendingFlag());
  const [magicUrlPending, setMagicUrlPending] = useState(() => {
    const startedAt = Number(localStorage.getItem(MAGIC_URL_PENDING_STARTED_AT_KEY) || 0);
    return startedAt && (Date.now() - startedAt) < MAGIC_URL_PENDING_MAX_AGE_MS;
  });

  const setAuthState = useCallback((userData, token, nextAppwriteUser = null) => {
    localStorage.setItem('velocitybrain_user', JSON.stringify(userData));
    if (token) {
      localStorage.setItem('velocitybrain_token', token);
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      localStorage.removeItem('velocitybrain_token');
      delete axios.defaults.headers.common.Authorization;
    }
    setUser(userData);
    if (nextAppwriteUser) {
      setAppwriteUser(nextAppwriteUser);
    }
  }, []);

  const clearOAuthPending = useCallback(() => {
    localStorage.removeItem(OAUTH_PENDING_KEY);
    localStorage.removeItem(OAUTH_PROVIDER_KEY);
    localStorage.removeItem(OAUTH_PENDING_STARTED_AT_KEY);
    setOauthPending(false);
  }, []);

  const markOAuthPending = useCallback((provider) => {
    localStorage.setItem(OAUTH_PENDING_KEY, '1');
    localStorage.setItem(OAUTH_PROVIDER_KEY, provider);
    localStorage.setItem(OAUTH_PENDING_STARTED_AT_KEY, String(Date.now()));
    setOauthPending(true);
  }, []);

  const clearAuthState = useCallback(() => {
    localStorage.removeItem('velocitybrain_token');
    localStorage.removeItem('velocitybrain_user');
    sessionStorage.removeItem(SESSION_VALIDATED_AT_KEY);
    clearOAuthPending();
    delete axios.defaults.headers.common.Authorization;
    setUser(null);
    setAppwriteUser(null);
  }, [clearOAuthPending]);

  const clearBackendSession = useCallback(() => {
    localStorage.removeItem('velocitybrain_token');
    localStorage.removeItem('velocitybrain_user');
    sessionStorage.removeItem(SESSION_VALIDATED_AT_KEY);
    delete axios.defaults.headers.common.Authorization;
    setUser(null);
  }, []);

  const createBackendSession = useCallback(async (nextAppwriteUser, { forceValidate = true } = {}) => {
    const jwtResult = await account.createJWT();
    const token = jwtResult.jwt;
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;

    const response = await withTimeout(
      axios.get(resolveApiUrl('/api/auth/me')),
      forceValidate ? BACKEND_SYNC_TIMEOUT_MS : SESSION_RESTORE_TIMEOUT_MS,
      '/api/auth/me'
    );

    const syncedUser = response.data?.user;
    if (!syncedUser?.id) {
      throw new Error('Appwrite sign-in succeeded but the backend did not return a profile.');
    }

    sessionStorage.setItem(SESSION_VALIDATED_AT_KEY, String(Date.now()));
    setAuthState(syncedUser, token, nextAppwriteUser);
    clearOAuthPending();
    setError(null);
    return { success: true, user: syncedUser };
  }, [clearOAuthPending, setAuthState]);

  const restoreSessionFromStorage = useCallback(async ({ forceValidate = false } = {}) => {
    const storedToken = localStorage.getItem('velocitybrain_token');
    const storedUserRaw = localStorage.getItem('velocitybrain_user');

    if (storedToken && storedUserRaw) {
      try {
        const storedUser = JSON.parse(storedUserRaw);
        axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
        const validatedAt = Number(sessionStorage.getItem(SESSION_VALIDATED_AT_KEY) || 0);
        const recentlyValidated = !forceValidate && validatedAt && Date.now() - validatedAt < SESSION_VALIDATE_MS;
        if (recentlyValidated) {
          setAuthState(storedUser, storedToken);
          return { success: true, user: storedUser, fromCache: true };
        }
      } catch {
        clearBackendSession();
      }
    }

    try {
      const currentAppwriteUser = await withTimeout(account.get(), SESSION_RESTORE_TIMEOUT_MS, 'Appwrite session check');
      setAppwriteUser(currentAppwriteUser);
      return await createBackendSession(currentAppwriteUser, { forceValidate });
    } catch (err) {
      if (err?.code === 401 || err?.response?.status === 401) {
        clearBackendSession();
      }
      return { success: false, error: err };
    }
  }, [clearBackendSession, createBackendSession, setAuthState]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const storedToken = localStorage.getItem('velocitybrain_token');
      const storedUserRaw = localStorage.getItem('velocitybrain_user');
      if (storedToken && storedUserRaw) {
        try {
          const storedUser = JSON.parse(storedUserRaw);
          axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
          setAuthState(storedUser, storedToken);
          if (active) setLoading(false);
        } catch {
          clearBackendSession();
        }
      }

      const restored = await restoreSessionFromStorage({
        forceValidate: hasFreshOAuthPendingFlag()
      });
      if (restored.success) {
        clearOAuthPending();
      } else if (hasFreshOAuthPendingFlag()) {
        const provider = localStorage.getItem(OAUTH_PROVIDER_KEY) || 'OAuth';
        setError(`${provider} sign-in could not be completed. Make sure this domain is added as an Appwrite Web platform.`);
        clearOAuthPending();
      }

      if (active) setLoading(false);
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, [clearBackendSession, clearOAuthPending, restoreSessionFromStorage, setAuthState]);

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (axiosError) => {
        const status = axiosError?.response?.status;
        const originalRequest = axiosError?.config;

        if (!originalRequest || status !== 401 || originalRequest.__velocitybrainRetriedAuth) {
          return Promise.reject(axiosError);
        }

        originalRequest.__velocitybrainRetriedAuth = true;

        try {
          const currentAppwriteUser = await account.get();
          const jwtResult = await account.createJWT();
          const refreshedToken = jwtResult.jwt;
          axios.defaults.headers.common.Authorization = `Bearer ${refreshedToken}`;
          localStorage.setItem('velocitybrain_token', refreshedToken);
          setAppwriteUser(currentAppwriteUser);

          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          return axios(originalRequest);
        } catch {
          clearAuthState();
          return Promise.reject(axiosError);
        }
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, [clearAuthState]);

  const logout = useCallback(async () => {
    clearAuthState();
    setError(null);
    try {
      await account.deleteSession({ sessionId: 'current' });
    } catch {
      // Session may already be gone.
    }
  }, [clearAuthState]);

  const updateUser = useCallback((userData) => {
    setAuthState(userData, localStorage.getItem('velocitybrain_token'), appwriteUser);
  }, [appwriteUser, setAuthState]);

  const completeAuth = useCallback((userData, token) => {
    setError(null);
    setAuthState(userData, token, appwriteUser);
  }, [appwriteUser, setAuthState]);

  const createAppwriteTokenSession = useCallback(async (userId, secret) => {
    if (typeof account.createSession === 'function') {
      await account.createSession({ userId, secret });
      return;
    }
    await account.updateMagicURLSession({ userId, secret });
  }, []);

  const loginWithPassword = useCallback(async ({ email, password }) => {
    setLoading(true);
    setError(null);

    try {
      await account.createEmailPasswordSession({ email, password });
      const currentAppwriteUser = await account.get();
      return await createBackendSession(currentAppwriteUser);
    } catch (err) {
      const message = safeErrorMessage(
        getErrorMessage(err, null),
        'Unable to sign in right now. Please try again.'
      );
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [createBackendSession]);

  const registerWithPassword = useCallback(async ({ name, email, password }) => {
    setLoading(true);
    setError(null);

    try {
      await account.create({
        userId: ID.unique(),
        email,
        password,
        name
      });
      await account.createEmailPasswordSession({ email, password });
      const currentAppwriteUser = await account.get();
      return await createBackendSession(currentAppwriteUser);
    } catch (err) {
      const message = safeErrorMessage(
        getErrorMessage(err, null),
        'Unable to create your account right now. Please try again.'
      );
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [createBackendSession]);

  const completeTwoFactor = useCallback(async ({ challengeToken, token }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await withTimeout(
        axios.post(resolveApiUrl('/api/auth/2fa/complete'), { challengeToken, token }),
        BACKEND_SYNC_TIMEOUT_MS,
        'POST /api/auth/2fa/complete'
      );

      const { user: signedInUser, token: sessionToken } = response.data;
      if (!signedInUser?.id || !sessionToken) {
        const message = 'Two-factor verification succeeded but the server did not return a session.';
        setError(message);
        return { success: false, error: message };
      }

      setAuthState(signedInUser, sessionToken, appwriteUser);
      return { success: true, user: signedInUser };
    } catch (err) {
      const message = safeErrorMessage(
        getErrorMessage(err, null),
        'Unable to verify that code. Please try again.'
      );
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [appwriteUser, setAuthState]);

  const sendMagicUrl = useCallback(async (email) => {
    setError(null);

    try {
      const origin = window.location.origin;
      await account.createMagicURLToken({
        userId: ID.unique(),
        email: email.trim(),
        url: `${origin}/login`
      });
      return { success: true };
    } catch (err) {
      localStorage.removeItem(MAGIC_URL_PENDING_KEY);
      localStorage.removeItem(MAGIC_URL_PENDING_STARTED_AT_KEY);
      setMagicUrlPending(false);
      const message = safeErrorMessage(
        getErrorMessage(err, null),
        'Could not send magic link. Please try again.'
      );
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const verifyMagicUrl = useCallback(async (userId, secret) => {
    setLoading(true);
    setError(null);
    setMagicUrlPending(true);
    localStorage.setItem(MAGIC_URL_PENDING_KEY, '1');
    localStorage.setItem(MAGIC_URL_PENDING_STARTED_AT_KEY, String(Date.now()));

    try {
      await createAppwriteTokenSession(userId, secret);
      const currentAppwriteUser = await account.get();
      localStorage.removeItem(MAGIC_URL_PENDING_KEY);
      localStorage.removeItem(MAGIC_URL_PENDING_STARTED_AT_KEY);
      setMagicUrlPending(false);
      return await createBackendSession(currentAppwriteUser);
    } catch (err) {
      localStorage.removeItem(MAGIC_URL_PENDING_KEY);
      localStorage.removeItem(MAGIC_URL_PENDING_STARTED_AT_KEY);
      setMagicUrlPending(false);
      const message = safeErrorMessage(
        getErrorMessage(err, null),
        'Magic link verification failed. Please request a new one.'
      );
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [createAppwriteTokenSession, createBackendSession]);

  const verifyOAuthToken = useCallback(async (userId, secret) => {
    setLoading(true);
    setError(null);

    try {
      await createAppwriteTokenSession(userId, secret);
      const currentAppwriteUser = await account.get();
      clearOAuthPending();
      return await createBackendSession(currentAppwriteUser);
    } catch (err) {
      clearOAuthPending();
      const message = safeErrorMessage(
        getErrorMessage(err, null),
        'OAuth sign-in could not be completed. Please try again.'
      );
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [clearOAuthPending, createAppwriteTokenSession, createBackendSession]);

  const signInWithProvider = useCallback(async (provider, providerLabel) => {
    setLoading(true);
    setError(null);
    markOAuthPending(providerLabel);

    try {
      const origin = window.location.origin;
      const redirect = (typeof account.createOAuth2Token === 'function'
        ? account.createOAuth2Token
        : account.createOAuth2Session
      ).call(account, {
        provider,
        success: `${origin}/oauth-callback`,
        failure: `${origin}/login?error=${providerLabel.toLowerCase()}_failed`
      });
      if (typeof redirect === 'string') {
        window.location.href = redirect;
      }
      return { success: true, pendingRedirect: true };
    } catch (err) {
      clearOAuthPending();
      const message = safeErrorMessage(err?.message, `${providerLabel} sign-in failed. Please try again.`);
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [clearOAuthPending, markOAuthPending]);

  const loginWithGoogle = useCallback(
    () => signInWithProvider(OAuthProvider.Google, 'Google'),
    [signInWithProvider]
  );

  const loginWithGithub = useCallback(
    () => signInWithProvider(OAuthProvider.Github, 'GitHub'),
    [signInWithProvider]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        appwriteUser,
        loading,
        oauthPending,
        magicUrlPending,
        error,
        logout,
        loginWithGithub,
        loginWithGoogle,
        loginWithPassword,
        registerWithPassword,
        sendMagicUrl,
        verifyMagicUrl,
        verifyOAuthToken,
        completeTwoFactor,
        updateUser,
        completeAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
