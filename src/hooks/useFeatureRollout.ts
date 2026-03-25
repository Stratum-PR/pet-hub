import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  type FeatureKey,
  type RolloutTier,
  getStoredSupportViewTier,
  setStoredSupportViewTier,
  tierVisibleForViewer,
} from '@/lib/featureRollout';

export function useFeatureRollout() {
  const { profile } = useAuth();
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

  const rolloutQuery = useQuery({
    queryKey: ['feature_rollout'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_rollout').select('feature_key, min_tier');
      if (error) throw error;
      return (data ?? []) as { feature_key: string; min_tier: RolloutTier }[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const minTierByKey = useMemo(() => {
    const m = new Map<string, RolloutTier>();
    for (const row of rolloutQuery.data ?? []) {
      m.set(row.feature_key, row.min_tier);
    }
    return m;
  }, [rolloutQuery.data]);

  const isFeatureVisible = useCallback(
    (key: FeatureKey): boolean => {
      const min = minTierByKey.get(key) ?? ('production' as RolloutTier);
      return tierVisibleForViewer(min, viewerTier);
    },
    [minTierByKey, viewerTier]
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
    rolloutLoaded: rolloutQuery.isSuccess,
  };
}
