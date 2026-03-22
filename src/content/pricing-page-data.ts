/**
 * Pricing page: tier definitions, features, comparison table, and add-ons.
 * Used by the glassmorphism pricing modal.
 */

export type BillingPeriod = 'monthly' | 'annual';

export interface TierPrice {
  monthly: number;
  annualPerMonth: number; // already discounted
}

export interface PricingTierConfig {
  id: 'basic' | 'growth' | 'pro' | 'enterprise';
  name: string;
  tagline: string;
  price: TierPrice | null; // null = custom pricing
  buttonLabel: string;
  buttonVariant: 'trial' | 'contact';
  featured?: boolean;
  badge?: string;
  features: string[];
  notIncluded?: string[];
}

export const PRICING_TIERS_CONFIG: PricingTierConfig[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Perfect for solo groomers',
    // Monthly is base; annual is ~15% discount
    price: { monthly: 29, annualPerMonth: 25 },
    buttonLabel: 'Get Started',
    buttonVariant: 'trial',
    features: [
      'Unlimited appointments & scheduling',
      'Up to 50 clients',
      'Online booking & payments',
      'Client profiles & pet records',
      '5 GB storage',
      'Email support',
    ],
    notIncluded: [
      'Inventory management',
      'Staff management features',
      'Multi-day boarding features',
      'Client portal access',
      'Advanced analytics',
      'Custom branding',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'For growing teams',
    // Monthly is base; annual is ~15% discount
    price: { monthly: 71, annualPerMonth: 60 },
    buttonLabel: 'Get Started',
    buttonVariant: 'trial',
    features: [
      'Everything in Basic, plus:',
      'Up to 5 staff members',
      'Up to 200 clients',
      'Inventory management',
      'Client portal access',
      'Analytics & reporting',
      'Custom branding',
      '25 GB storage',
      'Priority support',
    ],
    notIncluded: ['Multi-day boarding features', 'Commission tracking', 'Custom report builder'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Complete solution with boarding',
    // Monthly is base; annual is ~15% discount
    price: { monthly: 153, annualPerMonth: 130 },
    buttonLabel: 'Get Started',
    buttonVariant: 'trial',
    features: [
      'Everything in Growth, plus:',
      'Multi-day boarding features',
      'Up to 15 staff members',
      'Unlimited clients',
      'Commission tracking',
      'Advanced analytics',
      '100 GB storage',
      'Phone support',
    ],
    notIncluded: ['Multi-location management', 'API access', 'Dedicated account manager'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Built for multi-location operations',
    price: null,
    buttonLabel: 'Contact Sales',
    buttonVariant: 'contact',
    features: [
      'Everything in Pro, plus:',
      'Multi-location management',
      'Unlimited staff & clients',
      'API access & integrations',
      'Dedicated account manager',
      'Unlimited storage',
      '24/7 support',
    ],
  },
];

export interface AddOnConfig {
  id: string;
  title: string;
  price: string;
  description: string;
  availableFor: string[];
}

export const PRICING_ADDONS: AddOnConfig[] = [
  {
    id: 'additional-staff',
    title: 'Additional Staff Members',
    price: '$10/mo per additional staff member',
    description: 'Add as many team members as you need',
    availableFor: ['Growth (after 5)', 'Pro (after 15)'],
  },
  {
    id: 'sms',
    title: 'SMS Messaging',
    price: '$25, $50, or $100/mo',
    description: 'Send appointment reminders and updates via text',
    availableFor: ['All tiers'],
  },
  {
    id: 'payroll',
    title: 'Payroll Integration',
    price: '$50/mo',
    description: 'Automated payroll processing for your team',
    availableFor: ['Growth', 'Pro', 'Enterprise'],
  },
];

export type CompareCell = 'check' | 'dash' | string;

export interface CompareRow {
  feature: string;
  basic: CompareCell;
  growth: CompareCell;
  pro: CompareCell;
  enterprise: CompareCell;
}

export interface CompareSection {
  category: string;
  rows: CompareRow[];
}

export const COMPARISON_SECTIONS: CompareSection[] = [
  {
    category: 'CLIENTS & APPOINTMENTS',
    rows: [
      { feature: 'Active client limit', basic: '50', growth: '200', pro: 'Unlimited', enterprise: 'Unlimited' },
      { feature: 'Appointments per month', basic: 'Unlimited', growth: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
      { feature: 'Online booking', basic: 'check', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Appointment reminders', basic: 'Email only', growth: 'Email only', pro: 'Email only', enterprise: 'Email + SMS' },
      { feature: 'Client portal', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
    ],
  },
  {
    category: 'TEAM & STAFF',
    rows: [
      { feature: 'Staff members included', basic: '1 (just you)', growth: '5', pro: '15', enterprise: 'Unlimited' },
      { feature: 'Staff scheduling', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Staff permissions', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Track commissions', basic: 'dash', growth: 'dash', pro: 'check', enterprise: 'check' },
    ],
  },
  {
    category: 'SERVICES OFFERED',
    rows: [
      { feature: 'Grooming services', basic: 'check', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Daycare/boarding', basic: 'dash', growth: 'dash', pro: 'check', enterprise: 'check' },
      { feature: 'Daily care logs', basic: 'dash', growth: 'dash', pro: 'check', enterprise: 'check' },
      { feature: 'Room/kennel tracking', basic: 'dash', growth: 'dash', pro: 'check', enterprise: 'check' },
    ],
  },
  {
    category: 'PAYMENTS & MONEY',
    rows: [
      { feature: 'Accept credit cards', basic: 'check', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Online payments', basic: 'check', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Create invoices', basic: 'check', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Track revenue', basic: 'Basic', growth: 'Detailed', pro: 'Detailed', enterprise: 'Advanced' },
      { feature: 'Payroll processing', basic: 'Add-on', growth: 'Add-on', pro: 'Add-on', enterprise: 'Add-on' },
    ],
  },
  {
    category: 'INVENTORY & SUPPLIES',
    rows: [
      { feature: 'Track products/supplies', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Low stock alerts', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Inventory reports', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
    ],
  },
  {
    category: 'BRANDING & CUSTOMIZATION',
    rows: [
      { feature: 'Your logo & colors', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Branded invoices', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Custom web address', basic: 'dash', growth: 'dash', pro: 'dash', enterprise: 'check' },
    ],
  },
  {
    category: 'STORAGE & DATA',
    rows: [
      { feature: 'Photo & document storage', basic: '5 GB', growth: '25 GB', pro: '100 GB', enterprise: 'Unlimited' },
      { feature: 'Client notes', basic: 'check', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Pet records & history', basic: 'check', growth: 'check', pro: 'check', enterprise: 'check' },
    ],
  },
  {
    category: 'LOCATIONS',
    rows: [
      { feature: 'Number of locations', basic: '1', growth: '1', pro: '1', enterprise: 'Unlimited' },
      { feature: 'Manage multiple shops', basic: 'dash', growth: 'dash', pro: 'dash', enterprise: 'check' },
      { feature: 'Combined reporting', basic: 'dash', growth: 'dash', pro: 'dash', enterprise: 'check' },
    ],
  },
  {
    category: 'COMMUNICATION',
    rows: [
      { feature: 'Email notifications', basic: 'check', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Message clients', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'SMS text messages', basic: 'Add-on', growth: 'Add-on', pro: 'Add-on', enterprise: 'Included' },
      { feature: 'Automated follow-ups', basic: 'dash', growth: 'check', pro: 'check', enterprise: 'check' },
    ],
  },
  {
    category: 'SUPPORT & HELP',
    rows: [
      { feature: 'Help articles', basic: 'check', growth: 'check', pro: 'check', enterprise: 'check' },
      { feature: 'Email support', basic: '24-48 hours', growth: '12-24 hours', pro: 'Same day', enterprise: 'Priority' },
      { feature: 'Phone support', basic: 'dash', growth: 'dash', pro: 'check', enterprise: 'check' },
      { feature: 'Personal account manager', basic: 'dash', growth: 'dash', pro: 'dash', enterprise: 'check' },
      { feature: 'Setup & training', basic: 'dash', growth: '1 session', pro: 'Full onboarding', enterprise: 'Full onboarding' },
    ],
  },
];
