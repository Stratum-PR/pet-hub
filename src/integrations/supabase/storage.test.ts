import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAuthStorage } from './storage';

const CODE_VERIFIER_KEY = 'sb-project-auth-token-code-verifier';
const OTHER_KEY = 'sb-project-auth-token';

/**
 * Root cause of "security key was missing": Supabase stores the PKCE code_verifier
 * in localStorage when OAuth starts. On redirect back, it reads the verifier to
 * exchange the code for a session. If localStorage is empty (cleared, different
 * tab, or browser quirk), the verifier is missing and exchange fails.
 *
 * Fix: Custom storage backs up the code_verifier in a cookie. On callback, getItem
 * falls back to the cookie when localStorage doesn't have it.
 */
describe('PKCE auth storage (code_verifier cookie fallback)', () => {
  let storage: ReturnType<typeof createAuthStorage>;

  beforeEach(() => {
    storage = createAuthStorage();
    if (typeof localStorage !== 'undefined') localStorage.clear();
    if (typeof document !== 'undefined') {
      document.cookie = '';
      document.cookie = 'sb-pkce-code-verifier=; path=/; max-age=0';
    }
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    if (typeof document !== 'undefined') {
      document.cookie = 'sb-pkce-code-verifier=; path=/; max-age=0';
    }
  });

  describe('code_verifier is backed up in a cookie', () => {
    it('setItem with code_verifier key writes to both localStorage and cookie', () => {
      const value = JSON.stringify('pkce-verifier-abc123');
      storage.setItem(CODE_VERIFIER_KEY, value);

      expect(localStorage.getItem(CODE_VERIFIER_KEY)).toBe(value);
      expect(document.cookie).toContain('sb-pkce-code-verifier=');
    });

    it('getItem returns from localStorage when present', () => {
      const value = JSON.stringify('verifier-xyz');
      storage.setItem(CODE_VERIFIER_KEY, value);
      expect(storage.getItem(CODE_VERIFIER_KEY)).toBe(value);
    });

    it('getItem falls back to cookie when localStorage is empty (simulates redirect)', () => {
      const value = JSON.stringify('verifier-after-redirect');
      storage.setItem(CODE_VERIFIER_KEY, value);
      // Simulate "redirect": localStorage cleared (e.g. different tab, storage cleared)
      localStorage.removeItem(CODE_VERIFIER_KEY);
      expect(localStorage.getItem(CODE_VERIFIER_KEY)).toBeNull();

      const got = storage.getItem(CODE_VERIFIER_KEY);
      expect(got).toBe(value);
      // Should also restore to localStorage so Supabase finds it
      expect(localStorage.getItem(CODE_VERIFIER_KEY)).toBe(value);
    });

    it('getItem returns null when both localStorage and cookie are empty', () => {
      storage.removeItem(CODE_VERIFIER_KEY);
      if (typeof document !== 'undefined') document.cookie = 'sb-pkce-code-verifier=; path=/; max-age=0';
      expect(storage.getItem(CODE_VERIFIER_KEY)).toBeNull();
    });

    it('removeItem clears both localStorage and cookie for code_verifier key', () => {
      storage.setItem(CODE_VERIFIER_KEY, JSON.stringify('v'));
      storage.removeItem(CODE_VERIFIER_KEY);
      expect(localStorage.getItem(CODE_VERIFIER_KEY)).toBeNull();
      expect(document.cookie).not.toContain('sb-pkce-code-verifier=');
    });
  });

  describe('non-code_verifier keys use localStorage only', () => {
    it('setItem with other key does not set PKCE cookie', () => {
      storage.setItem(OTHER_KEY, 'session-data');
      expect(localStorage.getItem(OTHER_KEY)).toBe('session-data');
      expect(document.cookie).not.toContain('sb-pkce-code-verifier=');
    });

    it('getItem for other key does not read from cookie', () => {
      storage.setItem(OTHER_KEY, 'data');
      localStorage.removeItem(OTHER_KEY);
      expect(storage.getItem(OTHER_KEY)).toBeNull();
    });
  });

  describe('PKCE "security key missing" scenario', () => {
    it('after setItem then localStorage cleared (same-tab redirect), getItem recovers verifier from cookie', () => {
      // 1. Login page: user clicks Microsoft, Supabase stores verifier (JSON stringified)
      const verifierValue = JSON.stringify('abc123verifier');
      storage.setItem(CODE_VERIFIER_KEY, verifierValue);
      expect(localStorage.getItem(CODE_VERIFIER_KEY)).toBe(verifierValue);

      // 2. User is redirected to Microsoft, then back to /auth/callback
      //    Simulate: localStorage was cleared (browser quirk, extension, or user cleared)
      localStorage.clear();

      // 3. Callback page: Supabase calls getItem to exchange code for session
      const recovered = storage.getItem(CODE_VERIFIER_KEY);
      expect(recovered).toBe(verifierValue);
    });
  });
});
