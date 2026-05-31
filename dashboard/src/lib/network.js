import { configuredHostedApiUrl, shouldUseRelativeApi } from './api';

export const isBackendUnavailable = (error) => {
  if (!error) return false;

  const code = error.code || error?.cause?.code;
  const status = error.response?.status;
  const message = error.message || '';

  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNREFUSED' ||
    message === 'Network Error' ||
    message.includes('ERR_CONNECTION_REFUSED') ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
};

export const getErrorMessage = (error, fallbackMessage) => {
  if (isBackendUnavailable(error)) {
    const apiTarget = shouldUseRelativeApi
      ? 'the local dashboard proxy on port 3000'
      : configuredHostedApiUrl;
    return `Backend is unavailable right now. Tried ${apiTarget}. Make sure the configured API server is reachable.`;
  }

  if (error?.response?.status === 401) {
    return error?.response?.data?.message || 'Your session expired. Please sign in again.';
  }

  if (error?.response?.status === 429) {
    return error?.response?.data?.message || 'Too many requests. Wait a moment and try again.';
  }

  if (!error?.response && (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK')) {
    return 'Could not reach the Velocity Brain API. This is often a network or CORS configuration issue in production.';
  }

  return error?.response?.data?.message || error?.message || fallbackMessage;
};
