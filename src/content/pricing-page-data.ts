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
    name: L('Growth', 'Crecimiento'),
    tagline: L('Small salons', 'Salones pequeños'),
    price: { monthly: 29, annualPerMonth: 25 },
    buttonLabel: L('Get Started', 'Comenzar'),
    buttonVariant: 'trial',
    features: [
      L('Core scheduling, booking & payments', 'Agenda, reservas y pagos esenciales'),
      L('Up to 50 clients · 5 GB', 'Hasta 50 clientes · 5 GB'),
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
    name: L('Standard', 'Estándar'),
    tagline: L('Growing teams & inventory', 'Equipos en crecimiento e inventario'),
    price: { monthly: 71, annualPerMonth: 60 },
    buttonLabel: L('Get Started', 'Comenzar'),
    buttonVariant: 'trial',
    features: [
      L('Up to 5 staff · 200 clients · 25 GB', 'Hasta 5 empleados · 200 clientes · 25 GB'),
      L('Inventory, client portal & branding', 'Inventario, portal de clientes y marca'),
      L('Analytics & priority support', 'Analíticas y soporte prioritario'),
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
    tagline: L('Boarding & larger teams', 'Hospedaje y equipos grandes'),
    price: { monthly: 153, annualPerMonth: 130 },
    buttonLabel: L('Get Started', 'Comenzar'),
    buttonVariant: 'trial',
    features: [
      L('Multi-day boarding & commission tools', 'Hospedaje multi-día y comisiones'),
      L('Up to 15 staff · unlimited clients · 100 GB', 'Hasta 15 · clientes ilimitados · 100 GB'),
      L('Advanced analytics & phone support', 'Analíticas avanzadas y soporte por teléfono'),
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
    tagline: L('Multi-location & custom rollouts', 'Multi-ubicación y despliegues a medida'),
    price: null,
    buttonLabel: L('Contact Sales', 'Contactar ventas'),
    buttonVariant: 'contact',
    features: [
      L('Multi-location & unlimited scale', 'Multi-ubicación y escala ilimitada'),
      L('API access & dedicated success lead', 'API y líder de éxito dedicado'),
      L('Unlimited storage · 24/7 support', 'Almacenamiento ilimitado · soporte 24/7'),
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
    availableFor: L('Standard (after 5), Pro (after 15)', 'Estándar (después de 5), Pro (después de 15)'),
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
    availableFor: L('Standard, Pro, Enterprise', 'Estándar, Pro, Empresarial'),
  },
];

export type CompareCell = 'check' | 'dash' | L10n;

export interface CompareRowGrumi {
  feature: L10n;
  growth: CompareCell;
  standard: CompareCell;
  pro: CompareCell;
}

export interface CompareSectionGrumi {
  category: L10n;
  rows: CompareRowGrumi[];
}

export const COMPARISON_PLAN_COLUMNS = [
  {
    id: 'growth' as const,
    name: L('Growth', 'Crecimiento'),
    priceLine: PRICE_TBD,
  },
  {
    id: 'standard' as const,
    name: L('Standard', 'Estándar'),
    priceLine: PRICE_TBD,
  },
  {
    id: 'pro' as const,
    name: L('Pro', 'Pro'),
    priceLine: PRICE_TBD,
  },
] as const;

export const COMPARISON_SECTIONS: CompareSectionGrumi[] = [
  {
    category: L('USERS & SCHEDULING', 'USUARIOS Y AGENDA'),
    rows: [
      {
        feature: L('Users per business', 'Usuarios por negocio'),
        growth: L('5', '5'),
        standard: L('Unlimited', 'Ilimitados'),
        pro: L('Unlimited', 'Ilimitados'),
      },
      {
        feature: L('Online booking + SMS/Email reminders', 'Citas en línea + recordatorios por SMS/correo'),
        growth: 'check',
        standard: 'check',
        pro: 'check',
      },
      {
        feature: L('Multi-groomer calendar', 'Calendario para múltiples estilistas'),
        growth: 'check',
        standard: 'check',
        pro: 'check',
      },
      {
        feature: L('No-show fee + cart prepay', 'Cargo por ausencias + prepago al carrito'),
        growth: 'check',
        standard: 'check',
        pro: 'check',
      },
    ],
  },
  {
    category: L('PAYMENTS & CLIENTS', 'PAGOS Y CLIENTES'),
    rows: [
      {
        feature: L('Stripe integrated', 'Stripe integrado'),
        growth: 'check',
        standard: 'check',
        pro: 'check',
      },
      {
        feature: L('ATH Móvil', 'ATH Móvil'),
        growth: 'check',
        standard: 'check',
        pro: 'check',
      },
      {
        feature: L(
          'Client app: history, receipts, pet profile',
          'Aplicación para clientes: historial, recibos y perfil de mascota',
        ),
        growth: 'check',
        standard: 'check',
        pro: 'check',
      },
    ],
  },
  {
    category: L('OPERATIONS & REPORTS', 'OPERACIONES Y REPORTES'),
    rows: [
      {
        feature: L('Analytics dashboard', 'Panel de analíticas'),
        growth: L('Essentials', 'Esenciales'),
        standard: L('Advanced', 'Avanzado'),
        pro: L('Full', 'Completo'),
      },
      {
        feature: L('Employee schedules', 'Horario de empleados'),
        growth: 'dash',
        standard: 'check',
        pro: 'check',
      },
      {
        feature: L('Inventory with mobile barcode', 'Inventario con código de barras móvil'),
        growth: 'dash',
        standard: 'check',
        pro: 'check',
      },
      {
        feature: L('PR Payroll', 'Nómina PR'),
        growth: 'dash',
        standard: 'check',
        pro: 'check',
      },
    ],
  },
  {
    category: L('BRANDING & SCALE', 'MARCA Y ESCALA'),
    rows: [
      {
        feature: L('Spanish-language interface', 'Interfaz en español'),
        growth: 'check',
        standard: 'check',
        pro: 'check',
      },
      {
        feature: L('Branding + custom QR', 'Personalización de marca + QR personalizado'),
        growth: 'dash',
        standard: 'check',
        pro: 'check',
      },
      {
        feature: L('Multi-location', 'Multi-ubicación'),
        growth: 'dash',
        standard: 'dash',
        pro: 'check',
      },
    ],
  },
];
