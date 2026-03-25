export const SUPPORT_FEATURE_VIEW_TIER_KEY = 'support_feature_view_tier';

export type RolloutTier = 'production' | 'staged' | 'development';

export type FeatureKey = 'geofencing';

const TIER_ORDER: Record<RolloutTier, number> = {
  production: 0,
  staged: 1,
  development: 2,
};

export function parseRolloutTier(v: string | null): RolloutTier {
  const x = (v || 'production').toLowerCase().trim();
  if (x === 'staged' || x === 'development') return x;
  return 'production';
}

export function getStoredSupportViewTier(): RolloutTier {
  if (typeof window === 'undefined') return 'production';
  return parseRolloutTier(sessionStorage.getItem(SUPPORT_FEATURE_VIEW_TIER_KEY));
}

export function setStoredSupportViewTier(tier: RolloutTier): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SUPPORT_FEATURE_VIEW_TIER_KEY, tier);
  window.dispatchEvent(new Event('support-feature-tier-changed'));
}

export function tierVisibleForViewer(featureMin: RolloutTier, viewer: RolloutTier): boolean {
  return TIER_ORDER[featureMin] <= TIER_ORDER[viewer];
}
