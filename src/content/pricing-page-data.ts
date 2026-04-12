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

/** Grumi plan columns for the public comparison table (no competitor columns). */
export interface CompareRowGrumi {
  feature: string;
  basico: CompareCell;
  estandar: CompareCell;
  pro: CompareCell;
}

export interface CompareSectionGrumi {
  category: string;
  rows: CompareRowGrumi[];
}

export const COMPARISON_PLAN_COLUMNS = [
  {
    id: 'basico' as const,
    name: 'Grumi Básico',
    priceLine: '$39–$69/mes',
  },
  {
    id: 'estandar' as const,
    name: 'Grumi Estándar',
    priceLine: '$79–$109/mes',
  },
  {
    id: 'pro' as const,
    name: 'Grumi Pro',
    priceLine: '$119–$159/mes',
  },
] as const;

/**
 * Merged comparison: resumen-style rows (competitor-style sheet, Grumi-only) plus
 * detailed sections by plan. Edit here to dedupe or tweak copy.
 */
export const COMPARISON_SECTIONS: CompareSectionGrumi[] = [
  {
    category: 'RESUMEN',
    rows: [
      {
        feature: 'Usuarios por negocio',
        basico: '5',
        estandar: 'Ilimitados',
        pro: 'Ilimitados',
      },
      {
        feature: 'Turnos y ponche de empleados',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'App para clientes con historial de mascotas y pagos',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Pagos en línea + ATH Móvil',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Inventario con barcode móvil',
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Nómina PR',
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Interfaz en español',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Branding y personalización por negocio',
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
    ],
  },
  {
    category: 'USUARIOS Y AGENDA',
    rows: [
      {
        feature: 'Usuarios por negocio',
        basico: '5',
        estandar: 'Ilimitados',
        pro: 'Ilimitados',
      },
      {
        feature: 'Citas en línea + recordatorios SMS/Email',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Calendario multi-groomer',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Cargo por no-show + prepago al carro',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
    ],
  },
  {
    category: 'PAGOS Y CLIENTES',
    rows: [
      {
        feature: 'Stripe integrado',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'ATH Móvil',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'App cliente: historial, recibos, perfil mascota',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
    ],
  },
  {
    category: 'OPERACIONES Y REPORTES',
    rows: [
      {
        feature: 'Horario de empleados',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Inventario con barcode móvil',
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Nómina PR (SINOT, Choferil)',
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Analytics dashboard',
        basico: 'Básico',
        estandar: 'Avanzado',
        pro: 'Completo',
      },
    ],
  },
  {
    category: 'BRANDING Y ESCALA',
    rows: [
      {
        feature: 'Interfaz en español',
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Branding + QR personalizado',
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: 'Multi-ubicación',
        basico: 'dash',
        estandar: 'dash',
        pro: 'check',
      },
    ],
  },
];
