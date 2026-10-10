// U26 (FIX_LOG): useFeatureRollout reports when the feature rules have settled — 'loaded' when both
// feature_rollout and feature_visibility_rules returned, 'error' when one failed — so the route gate
// in Index.tsx can stop waiting right away instead of after U19's 10 s timeout.
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown[] | null; error: { message: string } | null };

const fake = vi.hoisted(() => ({
  responses: {} as Record<string, () => Promise<Result>>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { is_super_admin: false, role: 'manager' },
    business: { id: 'biz-1', subscription_tier: 'pro' },
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (table: string) => ({ select: () => fake.responses[table]() }) },
}));

const { useFeatureRollout } = await import('./useFeatureRollout');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/acme/appt-book/list']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const ok = (data: unknown[]) => () => Promise.resolve<Result>({ data, error: null });
const fail = () => Promise.resolve<Result>({ data: null, error: { message: 'boom' } });
const never = () => new Promise<Result>(() => {});

describe('useFeatureRollout featureRulesStatus', () => {
  beforeEach(() => {
    fake.responses = {};
  });

  it('is loading until both rule queries return', () => {
    fake.responses = { feature_rollout: ok([]), feature_visibility_rules: never };
    const { result } = renderHook(() => useFeatureRollout(), { wrapper });
    expect(result.current.featureRulesStatus).toBe('loading');
  });

  it('is loaded when both return, and visibility follows the rules', async () => {
    fake.responses = {
      feature_rollout: ok([
        { feature_key: 'appointment_book', min_tier: 'production' },
        { feature_key: 'inventory', min_tier: 'production' },
      ]),
      feature_visibility_rules: ok([
        { feature_key: 'appointment_book', roles: ['manager'], subscription_tiers: ['pro'] },
        { feature_key: 'inventory', roles: ['super_admin'], subscription_tiers: ['pro'] },
      ]),
    };
    const { result } = renderHook(() => useFeatureRollout(), { wrapper });
    await waitFor(() => expect(result.current.featureRulesStatus).toBe('loaded'));
    expect(result.current.isFeatureVisible('appointment_book')).toBe(true);
    expect(result.current.isFeatureVisible('inventory')).toBe(false);
  });

  it('is error as soon as a rule query fails (no timeout), with every gated feature hidden', async () => {
    fake.responses = { feature_rollout: fail, feature_visibility_rules: ok([]) };
    const { result } = renderHook(() => useFeatureRollout(), { wrapper });
    await waitFor(() => expect(result.current.featureRulesStatus).toBe('error'));
    expect(result.current.isFeatureVisible('appointment_book')).toBe(false);
  });
});
