import { describe, expect, it } from 'vitest';
import {
  normalizeFeatureKey,
  normalizeRolloutTierLabel,
  tierVisibleForViewer,
  superAdminViewerTierFromRolloutTier,
} from '@/lib/featureRollout';

describe('featureRollout helpers', () => {
  it('normalizes feature keys from display names', () => {
    expect(normalizeFeatureKey('Feature Tier Preview Control (Dev/Staged/Prod toggles)')).toBe(
      'feature_tier_preview_control_dev_staged_prod_toggles'
    );
    expect(normalizeFeatureKey('  Geofencing Settings ')).toBe('geofencing_settings');
  });

  it('normalizes tier labels from UI/csv values', () => {
    expect(normalizeRolloutTierLabel('Production')).toBe('production');
    expect(normalizeRolloutTierLabel('staging')).toBe('staged');
    expect(normalizeRolloutTierLabel('dev')).toBe('development');
  });

  it('applies hierarchical visibility (production < staged < development)', () => {
    expect(tierVisibleForViewer('production', 'production')).toBe(true);
    expect(tierVisibleForViewer('staged', 'production')).toBe(false);
    expect(tierVisibleForViewer('staged', 'staged')).toBe(true);
    expect(tierVisibleForViewer('development', 'staged')).toBe(false);
    expect(tierVisibleForViewer('development', 'development')).toBe(true);
  });

  it('maps staged rollout tier to development for super-admin viewer toggle', () => {
    expect(superAdminViewerTierFromRolloutTier('staged')).toBe('development');
    expect(superAdminViewerTierFromRolloutTier('production')).toBe('production');
    expect(superAdminViewerTierFromRolloutTier('development')).toBe('development');
  });
});
