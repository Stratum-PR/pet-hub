import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performEmailSignup, performOAuthLogin } from './authService';

describe('Account creation / auth workflow', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
  });

  describe('Email signup', () => {
    it('calls signUp with email, password, and emailRedirectTo pointing to /auth/callback', async () => {
      const signUp = vi.fn().mockResolvedValue({
        data: { user: { id: '1', identities: [{}] }, session: null },
        error: null,
      });
      const mockSupabase = {
        auth: { signUp },
      } as any;

      await performEmailSignup(mockSupabase, 'user@example.com', 'secret123');

      expect(signUp).toHaveBeenCalledTimes(1);
      expect(signUp).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'secret123',
        options: {
          emailRedirectTo: 'https://app.example.com/auth/callback',
        },
      });
    });
  });

  describe('Google OAuth', () => {
    it('calls signInWithOAuth with provider google and redirectTo /auth/callback', async () => {
      const signInWithOAuth = vi.fn().mockResolvedValue({
        data: { url: 'https://accounts.google.com/...', provider: 'google' },
        error: null,
      });
      const mockSupabase = {
        auth: { signInWithOAuth },
      } as any;

      await performOAuthLogin(mockSupabase, 'google');

      expect(signInWithOAuth).toHaveBeenCalledTimes(1);
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://app.example.com/auth/callback',
        },
      });
    });
  });

  describe('Microsoft OAuth', () => {
    it('calls signInWithOAuth with provider azure and redirectTo /auth/callback', async () => {
      const signInWithOAuth = vi.fn().mockResolvedValue({
        data: { url: 'https://login.microsoftonline.com/...', provider: 'azure' },
        error: null,
      });
      const mockSupabase = {
        auth: { signInWithOAuth },
      } as any;

      await performOAuthLogin(mockSupabase, 'azure');

      expect(signInWithOAuth).toHaveBeenCalledTimes(1);
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: 'azure',
        options: {
          redirectTo: 'https://app.example.com/auth/callback',
        },
      });
    });
  });
});
