const configuredApiUrl = (process.env.REACT_APP_API_URL || '').trim().replace(/\/+$/, '');

const isLocalHost = (value) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);

const fallbackHostedApiUrl =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    ? ''
    : 'https://velocity.linkitapp.in';

const resolvedApiUrl = configuredApiUrl || fallbackHostedApiUrl;

const normalizedApiOrigin = resolvedApiUrl.replace(/\/api$/i, '');

export const apiBaseUrl = normalizedApiOrigin;
export const configuredHostedApiUrl = resolvedApiUrl;

export const shouldUseRelativeApi =
  !resolvedApiUrl ||
  (typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) &&
    isLocalHost(normalizedApiOrigin));

export const resolveApiUrl = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (shouldUseRelativeApi) {
    return normalizedPath;
  }
  return `${normalizedApiOrigin}${normalizedPath}`;
};
