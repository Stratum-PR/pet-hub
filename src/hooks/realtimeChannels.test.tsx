// E2E-1 (FIX_LOG): two mounted instances of a realtime hook must not share a channel.
// supabase-js 2.117 returns the existing channel for a repeated topic, and `.on()` on an already-subscribed channel
// throws, which crashed the whole app when Quick charge / Nueva transacción mounted a second copy of these hooks.
// The fake client below reproduces exactly that behavior.
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const realtime = vi.hoisted(() => {
  class FakeChannel {
    subscribed = false;
    constructor(public topic: string) {}
    on() {
      if (this.subscribed) throw new Error(`cannot add \`postgres_changes\` callbacks for ${this.topic} after \`subscribe()\`.`);
      return this;
    }
    subscribe() {
      this.subscribed = true;
      return this;
    }
  }
  const channels = new Map<string, FakeChannel>();
  /** Any query chain resolves to an empty result. */
  const query = (): unknown =>
    new Proxy(() => {}, {
      get: (_t, prop) =>
        prop === 'then'
          ? (resolve: (v: unknown) => void) => resolve({ data: [], error: null, count: 0 })
          : () => query(),
    });
  const supabase = {
    channel(name: string) {
      const topic = `realtime:${name}`;
      let c = channels.get(topic);
      if (!c) channels.set(topic, (c = new FakeChannel(topic)));
      return c;
    },
    removeChannel(c: FakeChannel) {
      channels.delete(c.topic);
      return Promise.resolve('ok');
    },
    from: () => query(),
    rpc: () => query(),
  };
  return { supabase, channels };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: realtime.supabase }));
vi.mock('@/hooks/useBusinessId', () => ({ useBusinessId: () => 'biz-1' }));
vi.mock('@/hooks/useDemoBrowseOnly', () => ({ useDemoBrowseOnly: () => false }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: { id: 'user-1', business_id: 'biz-1', role: 'manager' }, business: null }),
}));

const { useInventory } = await import('./useInventory');
const { useTransactions } = await import('./useTransactions');
const { useAppointments: useAppointmentsSupabaseData } = await import('./useSupabaseData');
const { useAppointments: useAppointmentsBusinessData } = await import('./useBusinessData');

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe('realtime hooks can be mounted twice (E2E-1)', () => {
  it.each([
    ['useInventory', useInventory],
    ['useTransactions', useTransactions],
    ['useSupabaseData.useAppointments', useAppointmentsSupabaseData],
    ['useBusinessData.useAppointments', useAppointmentsBusinessData],
  ])('%s: a second instance subscribes its own channel', (_name, hook) => {
    const first = renderHook(() => hook(), { wrapper });
    expect(() => renderHook(() => hook(), { wrapper })).not.toThrow();
    const topics = [...realtime.channels.keys()];
    expect(new Set(topics).size).toBe(topics.length);
    first.unmount();
  });
});
