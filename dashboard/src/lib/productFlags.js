/**
 * Product toggles shared across dashboard flows.
 * Set REACT_APP_INTEGRATIONS_COMING_SOON=true to hide company OAuth UI.
 * Default: integrations enabled (demo mode works without OAuth secrets).
 */
export const INTEGRATIONS_COMING_SOON = process.env.REACT_APP_INTEGRATIONS_COMING_SOON === 'true';
