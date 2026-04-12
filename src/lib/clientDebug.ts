/**
 * Client-side debug surfaces and verbose logging.
 * Enabled only during Vite dev or when the app is opened on localhost (includes `vite preview`).
 * Deployed hosts (e.g. grumi.pet) stay quiet for end users.
 */

function isLocalhostHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/** UI panels, registration logs, env diagnostics — never on production hosts. */
export function isClientDebugSurfacesEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  return isLocalhostHostname(window.location.hostname);
}

/** Verbose console logging — same predicate as debug surfaces. */
export function isClientVerboseLoggingEnabled(): boolean {
  return isClientDebugSurfacesEnabled();
}

/** Use instead of bare `console.*` so production / remote hosts stay quiet in DevTools. */
export const devConsole = {
  log: (...args: unknown[]) => {
    if (isClientVerboseLoggingEnabled()) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isClientVerboseLoggingEnabled()) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (isClientVerboseLoggingEnabled()) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (isClientVerboseLoggingEnabled()) console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isClientVerboseLoggingEnabled()) console.debug(...args);
  },
};
