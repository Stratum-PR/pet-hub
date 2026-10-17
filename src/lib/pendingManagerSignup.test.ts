// Manager sign-up must not depend on the browser that filled in the form: the pending business travels in the
// account's user_metadata, and any page that resolves the post-login destination finishes it through the
// SECURITY DEFINER RPC `complete_manager_signup` (the database never reads the metadata for the role).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const state = {
    profile: null as Record<string, unknown> | null,
    profileError: null as unknown,
    rpcError: null as unknown,
    rpcCalls: [] as Array<{ fn: string; args: unknown }>,
    updateUserCalls: [] as unknown[],
    session: null as unknown,
  };
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: state.profile, error: state.profileError }),
        }),
      }),
    }),
    rpc: (fn: string, args: unknown) => {
      state.rpcCalls.push({ fn, args });
      return new Promise((resolve) => setTimeout(() => resolve({ data: null, error: state.rpcError }), 0));
    },
    auth: {
      updateUser: (args: unknown) => {
        state.updateUserCalls.push(args);
        return Promise.resolve({ data: {}, error: null });
      },
      getSession: () => Promise.resolve({ data: { session: state.session }, error: null }),
    },
  };
  return { state, supabase };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: fake.supabase }));

const {
  buildPendingManagerSignupMetadata,
  canCompletePendingManagerSignup,
  completePendingManagerSignup,
  finishPendingManagerSignupIfNeeded,
  onPendingManagerSignupCompleted,
  readPendingManagerSignup,
  readPendingManagerSignupFromMetadata,
  PENDING_MANAGER_SIGNUP_METADATA_KEY,
} = await import('./pendingManagerSignup');

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

const userWith = (meta: Record<string, unknown> = {}) => ({ id: 'user-1', user_metadata: meta });
const pendingMeta = { [PENDING_MANAGER_SIGNUP_METADATA_KEY]: { business_name: 'Patitas', tier: 'growth' } };

let storage: Storage;
beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
  fake.state.profile = { is_super_admin: false, business_id: null, role: 'client' };
  fake.state.profileError = null;
  fake.state.rpcError = null;
  fake.state.rpcCalls = [];
  fake.state.updateUserCalls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pending manager sign-up: reading', () => {
  it('builds trimmed metadata with a default plan', () => {
    expect(buildPendingManagerSignupMetadata('  Patitas ', '')).toEqual({ business_name: 'Patitas', tier: 'basic' });
  });

  it('reads the metadata and ignores empty or malformed values', () => {
    expect(readPendingManagerSignupFromMetadata(userWith(pendingMeta))).toEqual({ businessName: 'Patitas', tier: 'growth' });
    expect(readPendingManagerSignupFromMetadata(userWith({ [PENDING_MANAGER_SIGNUP_METADATA_KEY]: null }))).toBeNull();
    expect(readPendingManagerSignupFromMetadata(userWith({ [PENDING_MANAGER_SIGNUP_METADATA_KEY]: { business_name: ' ' } }))).toBeNull();
    expect(readPendingManagerSignupFromMetadata(userWith({ [PENDING_MANAGER_SIGNUP_METADATA_KEY]: 'Patitas' }))).toBeNull();
    expect(readPendingManagerSignupFromMetadata(userWith({ [PENDING_MANAGER_SIGNUP_METADATA_KEY]: { business_name: 'P' } })))
      .toEqual({ businessName: 'P', tier: 'basic' });
    expect(readPendingManagerSignupFromMetadata(null)).toBeNull();
  });

  it('falls back to the legacy localStorage keys only in readPendingManagerSignup', () => {
    storage.setItem('pending_manager_business_name', 'Legacy');
    expect(readPendingManagerSignupFromMetadata(userWith())).toBeNull();
    expect(readPendingManagerSignup(userWith())).toEqual({ businessName: 'Legacy', tier: 'basic' });
    // Metadata wins over the browser keys.
    expect(readPendingManagerSignup(userWith(pendingMeta))).toEqual({ businessName: 'Patitas', tier: 'growth' });
  });

  it('only lets a plain client with no business finish it', () => {
    expect(canCompletePendingManagerSignup(null)).toBe(true);
    expect(canCompletePendingManagerSignup({ role: 'client', business_id: null })).toBe(true);
    expect(canCompletePendingManagerSignup({ role: 'client', business_id: 'b1' })).toBe(false);
    expect(canCompletePendingManagerSignup({ role: 'employee', business_id: null })).toBe(false);
    expect(canCompletePendingManagerSignup({ role: 'manager', business_id: null })).toBe(false);
    expect(canCompletePendingManagerSignup({ role: 'client', is_super_admin: true })).toBe(false);
  });
});

describe('pending manager sign-up: finishing', () => {
  it('calls the RPC from metadata, clears the flag and local keys, then notifies listeners', async () => {
    storage.setItem('pending_manager_business_name', 'Legacy');
    const listener = vi.fn();
    const unsubscribe = onPendingManagerSignupCompleted(listener);

    await expect(finishPendingManagerSignupIfNeeded(userWith(pendingMeta))).resolves.toBe('completed');

    expect(fake.state.rpcCalls).toEqual([
      { fn: 'complete_manager_signup', args: { p_business_name: 'Patitas', p_subscription_tier: 'growth' } },
    ]);
    expect(fake.state.updateUserCalls).toEqual([{ data: { [PENDING_MANAGER_SIGNUP_METADATA_KEY]: null } }]);
    expect(storage.getItem('pending_manager_business_name')).toBeNull();
    expect(listener).toHaveBeenCalledWith('user-1');
    unsubscribe();
  });

  it('does nothing without a pending sign-up', async () => {
    await expect(finishPendingManagerSignupIfNeeded(userWith())).resolves.toBe('none');
    expect(fake.state.rpcCalls).toEqual([]);
  });

  it('ignores the legacy browser keys unless asked (shared browser, different user)', async () => {
    storage.setItem('pending_manager_business_name', 'Someone else');
    await expect(finishPendingManagerSignupIfNeeded(userWith())).resolves.toBe('none');
    expect(fake.state.rpcCalls).toEqual([]);

    await expect(finishPendingManagerSignupIfNeeded(userWith(), { includeLocalStorage: true })).resolves.toBe('completed');
    expect(fake.state.rpcCalls).toHaveLength(1);
  });

  it('skips an account that already has a business or is not a client', async () => {
    storage.setItem('pending_manager_business_name', 'Stale');
    fake.state.profile = { is_super_admin: false, business_id: 'b1', role: 'manager' };
    await expect(finishPendingManagerSignupIfNeeded(userWith(pendingMeta), { includeLocalStorage: true })).resolves.toBe('none');
    fake.state.profile = { is_super_admin: false, business_id: 'b2', role: 'employee' };
    await expect(finishPendingManagerSignupIfNeeded(userWith(pendingMeta))).resolves.toBe('none');
    expect(fake.state.rpcCalls).toEqual([]);
    expect(storage.getItem('pending_manager_business_name')).toBeNull();
  });

  it('reports failure and keeps the flag when the RPC fails', async () => {
    fake.state.rpcError = { message: 'boom' };
    const listener = vi.fn();
    const unsubscribe = onPendingManagerSignupCompleted(listener);
    await expect(finishPendingManagerSignupIfNeeded(userWith(pendingMeta))).resolves.toBe('failed');
    expect(fake.state.updateUserCalls).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('reports failure when the profile cannot be read', async () => {
    fake.state.profileError = { message: 'network' };
    await expect(finishPendingManagerSignupIfNeeded(userWith(pendingMeta))).resolves.toBe('failed');
    expect(fake.state.rpcCalls).toEqual([]);
  });

  it('shares one RPC call between concurrent callers for the same user', async () => {
    const pending = { businessName: 'Patitas', tier: 'basic' };
    const [a, b] = await Promise.all([
      completePendingManagerSignup('user-1', pending),
      completePendingManagerSignup('user-1', pending),
    ]);
    expect([a, b]).toEqual(['completed', 'completed']);
    expect(fake.state.rpcCalls).toHaveLength(1);
    // Once settled, a later call runs again (the RPC itself is a no-op when the business exists).
    await completePendingManagerSignup('user-1', pending);
    expect(fake.state.rpcCalls).toHaveLength(2);
  });
});
