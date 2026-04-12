/**
 * Pricing page: tier definitions, features, comparison table, and add-ons.
 * User-facing strings are bilingual { en, es }; use `pick(str, language)` in UI.
 */

export type PricingLocale = 'en' | 'es';

export type L10n = { en: string; es: string };

/** Short helper for bilingual literals. */
export const L = (en: string, es: string): L10n => ({ en, es });

/** Public-facing placeholder until final pricing is published. */
export const PRICE_TBD = L('TBD', 'Por Determinar');

export function pick(msg: L10n, lang: PricingLocale): string {
  return msg[lang];
}

export type BillingPeriod = 'monthly' | 'annual';

export interface TierPrice {
  monthly: number;
  annualPerMonth: number;
}

export interface PricingTierConfig {
  id: 'basic' | 'growth' | 'pro' | 'enterprise';
  name: L10n;
  tagline: L10n;
  price: TierPrice | null;
  buttonLabel: L10n;
  buttonVariant: 'trial' | 'contact';
  featured?: boolean;
  badge?: L10n;
  features: L10n[];
  notIncluded?: L10n[];
}

export const PRICING_TIERS_CONFIG: PricingTierConfig[] = [
  {
    id: 'basic',
    name: L('Basic', 'Básico'),
    tagline: L('Perfect for solo groomers', 'Ideal para groomers en solitario'),
    price: { monthly: 29, annualPerMonth: 25 },
    buttonLabel: L('Get Started', 'Comenzar'),
    buttonVariant: 'trial',
    features: [
      L('Unlimited appointments & scheduling', 'Citas y agenda ilimitadas'),
      L('Up to 50 clients', 'Hasta 50 clientes'),
      L('Online booking & payments', 'Reservas y pagos en línea'),
      L('Client profiles & pet records', 'Perfiles de clientes y fichas de mascotas'),
      L('5 GB storage', '5 GB de almacenamiento'),
      L('Email support', 'Soporte por correo'),
    ],
    notIncluded: [
      L('Inventory management', 'Gestión de inventario'),
      L('Staff management features', 'Funciones de personal'),
      L('Multi-day boarding features', 'Hospedaje multi-día'),
      L('Client portal access', 'Portal de clientes'),
      L('Advanced analytics', 'Analíticas avanzadas'),
      L('Custom branding', 'Marca personalizada'),
    ],
  },
  {
    id: 'growth',
    name: L('Growth', 'Crecimiento'),
    tagline: L('For growing teams', 'Para equipos en crecimiento'),
    price: { monthly: 71, annualPerMonth: 60 },
    buttonLabel: L('Get Started', 'Comenzar'),
    buttonVariant: 'trial',
    features: [
      L('Everything in Basic, plus:', 'Todo lo de Básico, más:'),
      L('Up to 5 staff members', 'Hasta 5 empleados'),
      L('Up to 200 clients', 'Hasta 200 clientes'),
      L('Inventory management', 'Gestión de inventario'),
      L('Client portal access', 'Portal de clientes'),
      L('Analytics & reporting', 'Analíticas e informes'),
      L('Custom branding', 'Marca personalizada'),
      L('25 GB storage', '25 GB de almacenamiento'),
      L('Priority support', 'Soporte prioritario'),
    ],
    notIncluded: [
      L('Multi-day boarding features', 'Hospedaje multi-día'),
      L('Commission tracking', 'Seguimiento de comisiones'),
      L('Custom report builder', 'Informes personalizados avanzados'),
    ],
  },
  {
    id: 'pro',
    name: L('Pro', 'Pro'),
    tagline: L('Complete solution with boarding', 'Solución completa con hospedaje'),
    price: { monthly: 153, annualPerMonth: 130 },
    buttonLabel: L('Get Started', 'Comenzar'),
    buttonVariant: 'trial',
    features: [
      L('Everything in Growth, plus:', 'Todo lo de Crecimiento, más:'),
      L('Multi-day boarding features', 'Hospedaje multi-día'),
      L('Up to 15 staff members', 'Hasta 15 empleados'),
      L('Unlimited clients', 'Clientes ilimitados'),
      L('Commission tracking', 'Seguimiento de comisiones'),
      L('Advanced analytics', 'Analíticas avanzadas'),
      L('100 GB storage', '100 GB de almacenamiento'),
      L('Phone support', 'Soporte telefónico'),
    ],
    notIncluded: [
      L('Multi-location management', 'Gestión multi-ubicación'),
      L('API access', 'Acceso API'),
      L('Dedicated account manager', 'Gerente de cuenta dedicado'),
    ],
  },
  {
    id: 'enterprise',
    name: L('Enterprise', 'Empresarial'),
    tagline: L('Built for multi-location operations', 'Pensado para operaciones multi-ubicación'),
    price: null,
    buttonLabel: L('Contact Sales', 'Contactar ventas'),
    buttonVariant: 'contact',
    features: [
      L('Everything in Pro, plus:', 'Todo lo de Pro, más:'),
      L('Multi-location management', 'Gestión multi-ubicación'),
      L('Unlimited staff & clients', 'Personal y clientes ilimitados'),
      L('API access & integrations', 'Acceso API e integraciones'),
      L('Dedicated account manager', 'Gerente de cuenta dedicado'),
      L('Unlimited storage', 'Almacenamiento ilimitado'),
      L('24/7 support', 'Soporte 24/7'),
    ],
  },
];

export interface AddOnConfig {
  id: string;
  title: L10n;
  price: L10n;
  description: L10n;
  availableFor: L10n;
}

export const PRICING_ADDONS: AddOnConfig[] = [
  {
    id: 'additional-staff',
    title: L('Additional Staff Members', 'Empleados adicionales'),
    price: PRICE_TBD,
    description: L('Add as many team members as you need', 'Añade tantos miembros del equipo como necesites'),
    availableFor: L('Growth (after 5), Pro (after 15)', 'Crecimiento (después de 5), Pro (después de 15)'),
  },
  {
    id: 'sms',
    title: L('SMS Messaging', 'Mensajes SMS'),
    price: PRICE_TBD,
    description: L('Send appointment reminders and updates via text', 'Envía recordatorios de citas y avisos por SMS'),
    availableFor: L('All tiers', 'Todos los planes'),
  },
  {
    id: 'payroll',
    title: L('Payroll Integration', 'Integración de nómina'),
    price: PRICE_TBD,
    description: L('Automated payroll processing for your team', 'Procesamiento de nómina para tu equipo'),
    availableFor: L('Growth, Pro, Enterprise', 'Crecimiento, Pro, Empresarial'),
  },
];

export type CompareCell = 'check' | 'dash' | L10n;

export interface CompareRowGrumi {
  feature: L10n;
  basico: CompareCell;
  estandar: CompareCell;
  pro: CompareCell;
}

export interface CompareSectionGrumi {
  category: L10n;
  rows: CompareRowGrumi[];
}

export const COMPARISON_PLAN_COLUMNS = [
  {
    id: 'basico' as const,
    name: L('Grumi Basic', 'Grumi Básico'),
    priceLine: PRICE_TBD,
  },
  {
    id: 'estandar' as const,
    name: L('Grumi Standard', 'Grumi Estándar'),
    priceLine: PRICE_TBD,
  },
  {
    id: 'pro' as const,
    name: L('Grumi Pro', 'Grumi Pro'),
    priceLine: PRICE_TBD,
  },
] as const;

export const COMPARISON_SECTIONS: CompareSectionGrumi[] = [
  {
    category: L('SUMMARY', 'RESUMEN'),
    rows: [
      {
        feature: L('Users per business', 'Usuarios por negocio'),
        basico: L('5', '5'),
        estandar: L('Unlimited', 'Ilimitados'),
        pro: L('Unlimited', 'Ilimitados'),
      },
      {
        feature: L('Shifts & employee time clock', 'Turnos y ponche de empleados'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L(
          'Client app with pet history and payments',
          'App para clientes con historial de mascotas y pagos',
        ),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Online payments + ATH Móvil', 'Pagos en línea + ATH Móvil'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Inventory with mobile barcode', 'Inventario con barcode móvil'),
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Puerto Rico payroll', 'Nómina PR'),
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Spanish-language interface', 'Interfaz en español'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Branding & per-business customization', 'Branding y personalización por negocio'),
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
    ],
  },
  {
    category: L('USERS & SCHEDULING', 'USUARIOS Y AGENDA'),
    rows: [
      {
        feature: L('Users per business', 'Usuarios por negocio'),
        basico: L('5', '5'),
        estandar: L('Unlimited', 'Ilimitados'),
        pro: L('Unlimited', 'Ilimitados'),
      },
      {
        feature: L('Online booking + SMS/Email reminders', 'Citas en línea + recordatorios SMS/Email'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Multi-groomer calendar', 'Calendario multi-groomer'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('No-show fee + cart prepay', 'Cargo por no-show + prepago al carro'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
    ],
  },
  {
    category: L('PAYMENTS & CLIENTS', 'PAGOS Y CLIENTES'),
    rows: [
      {
        feature: L('Stripe integrated', 'Stripe integrado'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('ATH Móvil', 'ATH Móvil'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Client app: history, receipts, pet profile', 'App cliente: historial, recibos, perfil mascota'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
    ],
  },
  {
    category: L('OPERATIONS & REPORTS', 'OPERACIONES Y REPORTES'),
    rows: [
      {
        feature: L('Employee schedules', 'Horario de empleados'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Inventory with mobile barcode', 'Inventario con barcode móvil'),
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('PR payroll (SINOT, Choferil)', 'Nómina PR (SINOT, Choferil)'),
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Analytics dashboard', 'Analytics dashboard'),
        basico: L('Basic', 'Básico'),
        estandar: L('Advanced', 'Avanzado'),
        pro: L('Full', 'Completo'),
      },
    ],
  },
  {
    category: L('BRANDING & SCALE', 'BRANDING Y ESCALA'),
    rows: [
      {
        feature: L('Spanish-language interface', 'Interfaz en español'),
        basico: 'check',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Branding + custom QR', 'Branding + QR personalizado'),
        basico: 'dash',
        estandar: 'check',
        pro: 'check',
      },
      {
        feature: L('Multi-location', 'Multi-ubicación'),
        basico: 'dash',
        estandar: 'dash',
        pro: 'check',
      },
    ],
  },
];
