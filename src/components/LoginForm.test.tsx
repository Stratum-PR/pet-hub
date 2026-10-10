// U18 (FIX_LOG): a slow post-login destination lookup must never send staff to the client portal.
// LoginForm used to race the role-based resolver against a 6 s timer that answered '/portal', so a
// manager whose profile lookup took longer than 6 s landed on the client portal.
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const user = { id: 'user-1', email: 'staff@grumi.test' };
  const supabase = {
    auth: {
      signInWithPassword: () => Promise.resolve({ data: { user, session: { user } }, error: null }),
      getUser: () => Promise.resolve({ data: { user }, error: null }),
      getSession: () => Promise.resolve({ data: { session: { user } }, error: null }),
    },
  };
  return {
    supabase,
    /** Replaced per test: what `resolveAuthenticatedDestination` returns. */
    resolveDestination: (() => Promise.resolve('/')) as (userId: string) => Promise<string>,
    toastError: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: fake.supabase }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ refreshAuth: () => Promise.resolve() }) }));
vi.mock('@/lib/authBroadcast', () => ({ broadcastAuthLogin: () => {} }));
vi.mock('sonner', () => ({ toast: { success: () => {}, error: fake.toastError } }));
vi.mock('@/lib/authRouting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authRouting')>()),
  setDemoMode: () => {},
  clearAuthContext: () => {},
  setPostAuthHint: () => {},
  clearPostAuthHint: () => {},
  setBusinessSlugForSession: () => {},
  resolveAuthenticatedDestination: (userId: string) => fake.resolveDestination(userId),
}));

// LoginForm reads these at import time and refuses to sign in without them.
vi.stubEnv('VITE_SUPABASE_URL', 'https://placeholder.supabase.co');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'placeholder');
const { LoginForm } = await import('./LoginForm');

/** Resolves with `route` after `ms` of (fake) time. */
const resolveAfter = (route: string, ms: number) => () =>
  new Promise<string>((resolve) => setTimeout(() => resolve(route), ms));

function submitLogin() {
  const onLoginSuccess = vi.fn();
  const { container } = render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginForm onLoginSuccess={onLoginSuccess} />
    </MemoryRouter>,
  );
  const el = <T extends Element>(selector: string) => {
    const found = container.querySelector<T>(selector);
    if (!found) throw new Error(`missing ${selector}`);
    return found;
  };
  fireEvent.change(el('#login-email'), { target: { value: 'staff@grumi.test' } });
  fireEvent.change(el('#login-password'), { target: { value: 'Secret#123' } });
  fireEvent.submit(el('form'));
  return { onLoginSuccess, submitButton: el<HTMLButtonElement>('form button[type="submit"]') };
}

describe('LoginForm: post-login destination', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake.toastError.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a manager to their dashboard even when the lookup takes longer than 6 s', async () => {
    fake.resolveDestination = resolveAfter('/acme/dashboard', 7000);
    const { onLoginSuccess } = submitLogin();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6500);
    });
    // Still waiting for the real answer: no guess.
    expect(onLoginSuccess).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    expect(onLoginSuccess).toHaveBeenCalledWith('/acme/dashboard');
  });

  it('still sends a client to the portal when the lookup is fast', async () => {
    fake.resolveDestination = () => Promise.resolve('/portal');
    const { onLoginSuccess } = submitLogin();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onLoginSuccess).toHaveBeenCalledWith('/portal');
  });

  it('shows an error instead of guessing when the lookup never answers', async () => {
    fake.resolveDestination = () => new Promise<string>(() => {});
    const { onLoginSuccess, submitButton } = submitLogin();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(onLoginSuccess).not.toHaveBeenCalled();
    expect(fake.toastError).toHaveBeenCalled();
    // The form is usable again, so the person can retry.
    expect(submitButton).not.toBeDisabled();
  });
});
