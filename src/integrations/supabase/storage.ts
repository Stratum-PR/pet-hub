/**
 * Storage adapter that backs up the PKCE code_verifier in a cookie so OAuth
 * redirects can find it even when localStorage is cleared or unavailable
 * (e.g. same-tab redirect, private browsing). Keeps PKCE flow secure.
 */

import { authLog } from '@/lib/authDebugLog';

const PKCE_COOKIE_NAME = 'sb-pkce-code-verifier';
const PKCE_COOKIE_MAX_AGE = 600; // 10 minutes
const DEBUG_AUTH = typeof window !== 'undefined' && typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

function isCodeVerifierKey(key: string): boolean {
  return key.endsWith('-code-verifier');
}

/**
 * Wraps localStorage so the PKCE code_verifier is also stored in a cookie.
 * On redirect, getItem can recover the verifier from the cookie if localStorage
 * doesn't have it (e.g. cleared or different context).
 */
export function createAuthStorage(): { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void } {
  return {
    getItem(key: string): string | null {
      let value = null;
      try {
        value = localStorage.getItem(key);
      } catch {
        // ignore
      }
      if (value) {
        if (DEBUG_AUTH && isCodeVerifierKey(key)) authLog('storage', 'PKCE getItem: from localStorage', { key });
        return value;
      }
      if (isCodeVerifierKey(key)) {
        const fromCookie = getCookie(PKCE_COOKIE_NAME);
        if (fromCookie) {
          try {
            localStorage.setItem(key, fromCookie);
          } catch {
            // ignore
          }
          if (DEBUG_AUTH) authLog('storage', 'PKCE getItem: from cookie (restored to localStorage)', { key });
          return fromCookie;
        }
        if (DEBUG_AUTH) authLog('storage', 'PKCE getItem: null (no localStorage, no cookie)', { key });
      }
      return null;
    },
    setItem(key: string, value: string): void {
      try {
        localStorage.setItem(key, value);
      } catch {
        // ignore
      }
      if (isCodeVerifierKey(key)) {
        setCookie(PKCE_COOKIE_NAME, value, PKCE_COOKIE_MAX_AGE);
        if (DEBUG_AUTH) authLog('storage', 'PKCE setItem: cookie set', { key });
      }
    },
    removeItem(key: string): void {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
      if (isCodeVerifierKey(key)) {
        removeCookie(PKCE_COOKIE_NAME);
      }
    },
  };
}
