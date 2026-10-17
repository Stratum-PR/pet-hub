// The post-login routing (landing page, login form, /auth/callback) finishes a manager sign-up that is still
// pending in user_metadata, so an owner who confirmed on another device or used a magic link lands on the new
// dashboard instead of /portal.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const state = {
    profile: { is_super_admin: false, business_id: null, role: 'client' } as Record<string, unknown>,
    business: { id: 'b1', slug: 'patitas', name: 'Patitas' },
    session: null as unknown,
    rpcCalls: [] as string[],
  };
  const supabase = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: table === 'businesses' ? state.business : state.profile, error: null }),
        }),
      }),
    }),
    rpc: (fn: string) => {
      state.rpcCalls.push(fn);
      // What complete_manager_signup does to the profile.
      state.profile = { is_super_admin: false, business_id: 'b1', role: 'manager' };
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: state.session }, error: null }),
      updateUser: () => Promise.resolve({ data: {}, error: null }),
    },
  };
  return { state, supabase };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: fake.supabase }));

const { resolveAuthenticatedDestination } = await import('./authRouting');

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

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  fake.state.profile = { is_super_admin: false, business_id: null, role: 'client' };
  fake.state.rpcCalls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveAuthenticatedDestination: pending manager sign-up', () => {
  it('finishes it from user_metadata and routes to the new dashboard', async () => {
    fake.state.session = {
      user: { id: 'user-1', user_metadata: { pending_manager_signup: { business_name: 'Patitas', tier: 'basic' } } },
    };
    await expect(resolveAuthenticatedDestination('user-1')).resolves.toBe('/patitas/dashboard');
    expect(fake.state.rpcCalls).toEqual(['complete_manager_signup']);
  });

  it('leaves a plain client in /portal', async () => {
    fake.state.session = { user: { id: 'user-1', user_metadata: { full_name: 'Ana' } } };
    await expect(resolveAuthenticatedDestination('user-1')).resolves.toBe('/portal');
    expect(fake.state.rpcCalls).toEqual([]);
  });

  it("does not use another session's metadata", async () => {
    fake.state.session = {
      user: { id: 'someone-else', user_metadata: { pending_manager_signup: { business_name: 'X' } } },
    };
    await expect(resolveAuthenticatedDestination('user-1')).resolves.toBe('/portal');
    expect(fake.state.rpcCalls).toEqual([]);
  });
});
