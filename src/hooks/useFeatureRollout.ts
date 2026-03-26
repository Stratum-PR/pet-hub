import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  FEATURE_SUBSCRIPTION_TIERS,
  type FeatureRole,
  type FeatureKey,
  type RolloutTier,
  getStoredSupportViewTier,
  setStoredSupportViewTier,
  tierVisibleForViewer,
} from '@/lib/featureRollout';

type RolloutRow = { feature_key: string; min_tier: RolloutTier };
type VisibilityRuleRow = {
  feature_key: string;
  roles: string[] | null;
  subscription_tiers: string[] | null;
};

export function useFeatureRollout() {
  const { profile, business } = useAuth();
  const isSuperAdmin = profile?.is_super_admin ?? false;
  const [sessionTier, setSessionTier] = useState<RolloutTier>(() => getStoredSupportViewTier());

  useEffect(() => {
    const onChange = () => setSessionTier(getStoredSupportViewTier());
    window.addEventListener('support-feature-tier-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('support-feature-tier-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const viewerTier: RolloutTier = isSuperAdmin ? sessionTier : 'production';
  const roleForRules = (isSuperAdmin ? 'super_admin' : (profile?.role ?? 'client')) as FeatureRole;
  const subscriptionTierForRules = useMemo(() => {
    const tier = (business?.subscription_tier ?? 'standard').toLowerCase().trim();
    return FEATURE_SUBSCRIPTION_TIERS.includes(tier as (typeof FEATURE_SUBSCRIPTION_TIERS)[number])
      ? tier
      : 'standard';
  }, [business?.subscription_tier]);

  const rolloutQuery = useQuery({
    queryKey: ['feature_rollout_v2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_rollout').select('feature_key, min_tier');
      if (error) throw error;
      return (data ?? []) as RolloutRow[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const visibilityQuery = useQuery({
    queryKey: ['feature_visibility_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_visibility_rules')
        .select('feature_key, roles, subscription_tiers');
      if (error) throw error;
      return (data ?? []) as VisibilityRuleRow[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const configByKey = useMemo(() => {
    const m = new Map<
      string,
      {
        minTier: RolloutTier;
        roles: string[];
        subscriptionTiers: string[];
      }
    >();

    for (const row of rolloutQuery.data ?? []) {
      const prev = m.get(row.feature_key);
      m.set(row.feature_key, {
        minTier: row.min_tier,
        roles: prev?.roles ?? ['super_admin'],
        subscriptionTiers: prev?.subscriptionTiers ?? ['standard'],
      });
    }

    for (const row of visibilityQuery.data ?? []) {
      const prev = m.get(row.feature_key);
      m.set(row.feature_key, {
        minTier: prev?.minTier ?? 'development',
        roles: row.roles ?? ['super_admin'],
        subscriptionTiers: row.subscription_tiers ?? ['standard'],
      });
    }
    return m;
  }, [rolloutQuery.data, visibilityQuery.data]);

  const roleAllowed = useCallback(
    (roles: string[]) => roles.includes('*') || roles.includes(roleForRules),
    [roleForRules]
  );

  const subscriptionAllowed = useCallback(
    (tiers: string[]) =>
      tiers.includes('*') ||
      tiers.includes(subscriptionTierForRules) ||
      // "standard" is the default compatibility tier for now; treat as broadly visible.
      tiers.includes('standard'),
    [subscriptionTierForRules]
  );

  const isFeatureVisible = useCallback(
    (key: FeatureKey): boolean => {
      const config = configByKey.get(key);
      if (!config) return false;
      const visible =
        tierVisibleForViewer(config.minTier, viewerTier) &&
        roleAllowed(config.roles) &&
        subscriptionAllowed(config.subscriptionTiers);
      return visible;
    },
    [configByKey, viewerTier, roleAllowed, subscriptionAllowed]
  );

  const setViewerTier = useCallback((tier: RolloutTier) => {
    setStoredSupportViewTier(tier);
    setSessionTier(tier);
  }, []);

  return {
    viewerTier,
    setViewerTier,
    isFeatureVisible,
    isSuperAdmin,
    rolloutLoaded: rolloutQuery.isSuccess && visibilityQuery.isSuccess,
    featureConfigs: configByKey,
  };
}
