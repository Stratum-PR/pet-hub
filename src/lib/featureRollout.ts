export const SUPPORT_FEATURE_VIEW_TIER_KEY = 'support_feature_view_tier';

export type RolloutTier = 'production' | 'staged' | 'development';

/** Super-admin UI preview: only Production vs Development (no staged channel). */
export type SuperAdminViewerTier = 'production' | 'development';

export type FeatureKey = string;

export type FeatureRole = 'client' | 'employee' | 'manager' | 'super_admin';

export const FEATURE_ROLES: FeatureRole[] = ['client', 'employee', 'manager', 'super_admin'];
export const FEATURE_SUBSCRIPTION_TIERS = ['standard', 'basic', 'growth', 'pro', 'enterprise'] as const;
export type FeatureSubscriptionTier = (typeof FEATURE_SUBSCRIPTION_TIERS)[number];

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

/** Map DB / legacy tier labels to the super-admin preview toggle (staged → development). */
export function superAdminViewerTierFromRolloutTier(tier: RolloutTier): SuperAdminViewerTier {
  if (tier === 'staged') return 'development';
  if (tier === 'development') return 'development';
  return 'production';
}

/** Stored super-admin preview mode; legacy `staged` maps to `development` so removing the middle option does not break. */
export function getStoredSuperAdminViewerTier(): SuperAdminViewerTier {
  if (typeof window === 'undefined') return 'production';
  return superAdminViewerTierFromRolloutTier(parseRolloutTier(sessionStorage.getItem(SUPPORT_FEATURE_VIEW_TIER_KEY)));
}

export function setStoredSupportViewTier(tier: RolloutTier): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SUPPORT_FEATURE_VIEW_TIER_KEY, tier);
  window.dispatchEvent(new Event('support-feature-tier-changed'));
}

export function setStoredSuperAdminViewerTier(tier: SuperAdminViewerTier): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SUPPORT_FEATURE_VIEW_TIER_KEY, tier);
  window.dispatchEvent(new Event('support-feature-tier-changed'));
}

export function tierVisibleForViewer(featureMin: RolloutTier, viewer: RolloutTier): boolean {
  return TIER_ORDER[featureMin] <= TIER_ORDER[viewer];
}

export function normalizeRolloutTierLabel(v: string): RolloutTier {
  const x = v.toLowerCase().trim();
  if (x === 'staging' || x === 'staged') return 'staged';
  if (x === 'development' || x === 'dev') return 'development';
  return 'production';
}

export function normalizeFeatureKey(displayName: string): string {
  return displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
