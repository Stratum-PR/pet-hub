/** Central nav items for public marketing header (Landing, Pricing, Contact, Legal). */
export type MarketingNavItem =
  | { kind: 'hash'; hash: string; labelKey: 'landing.navFeatures' }
  | { kind: 'route'; to: string; labelKey: 'landing.navPricing' | 'landing.navContactUs' };

export const MARKETING_NAV_ITEMS: MarketingNavItem[] = [
  { kind: 'hash', hash: 'features', labelKey: 'landing.navFeatures' },
  { kind: 'route', to: '/pricing', labelKey: 'landing.navPricing' },
  { kind: 'route', to: '/contact', labelKey: 'landing.navContactUs' },
];
