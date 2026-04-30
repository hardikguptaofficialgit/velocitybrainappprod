const configuredApiUrl = process.env.REACT_APP_API_URL || '';

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
    const apiTarget = configuredApiUrl || 'the dashboard proxy on port 3000';
    return `Backend is unavailable right now. Tried ${apiTarget}. Make sure the configured API server is reachable.`;
  }

  if (error?.response?.status === 401) {
    return 'Your session expired. Please sign in again.';
  }

  return error?.response?.data?.message || error?.message || fallbackMessage;
};
