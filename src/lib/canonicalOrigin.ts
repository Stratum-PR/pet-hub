/**
 * Canonical origin for OAuth/cookies so localhost and 127.0.0.1 don't mismatch.
 * Cookies and redirect_uri must use the same origin or the PKCE code_verifier
 * cookie won't be sent on the callback.
 */
export function getCanonicalOrigin(): string {
  if (typeof window === 'undefined') return '';
  const loc = window.location;
  const origin = loc.origin || `${loc.protocol}//${loc.hostname}${loc.port ? ':' + loc.port : ''}`;
  try {
    const url = new URL(origin);
    if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
      return url.origin;
    }
    return origin;
  } catch {
    return origin;
  }
}
