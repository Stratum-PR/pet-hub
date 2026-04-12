/**
 * Single source of truth for content exposed to crawlers and AI agents via llms.txt and content.json.
 *
 * - Add a new public page: (1) Add route to DISCOVERABLE_ROUTES in discoverable-routes.ts,
 *   (2) Add full page text here in PAGE_CONTENT[path]. Build will add it to sitemap, ai-routes, llms.txt, and content.json.
 * - Keep copy here in sync with what appears on the site (use same English text as your UI/translations).
 *
 * SECURITY: Do not put secrets, API keys, PII, or user-generated content here. This data is served
 * publicly in llms.txt and content.json. Use only static, non-sensitive marketing copy.
 */

export interface PricingTier {
  tier: string;
  name: string;
  /** Omit or null for "Contact us for custom pricing" (e.g. enterprise). */
  price: number | null;
  description: string;
  features: string[];
  popular?: boolean;
  /** If true, show Contact CTA instead of Start Trial (e.g. enterprise, manual/VIP only). */
  contactUs?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    tier: 'basic',
    name: 'Basic',
    price: null,
    description: 'Perfect for small grooming businesses',
    features: [
      'Up to 100 clients',
      'Unlimited appointments',
      'Basic reporting',
      'Email support',
      'Mobile app access',
    ],
    popular: false,
  },
  {
    tier: 'growth',
    name: 'Growth',
    price: null,
    description: 'Ideal for growing businesses',
    features: [
      'Unlimited clients',
      'Unlimited appointments',
      'Advanced analytics',
      'Priority support',
      'Mobile app access',
      'Employee management',
      'Time tracking',
    ],
    popular: true,
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: null,
    description: 'For large operations',
    features: [
      'Everything in Growth',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 phone support',
      'Custom reporting',
      'Multi-location support',
      'API access',
    ],
    popular: false,
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: null,
    description: 'Custom solutions for VIP and multi-location operations',
    features: [
      'Everything in Pro',
      'Custom contracts',
      'Dedicated success manager',
      'SLA and custom terms',
    ],
    popular: false,
    contactUs: true,
  },
];

export interface FaqEntry {
  question: string;
  answer: string;
}

/** FAQ shown on the landing page and exposed in llms.txt / content.json. Edit here. */
export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: 'What is Grumi?',
    answer: 'Grumi is a business management platform for pet grooming businesses. It helps you manage appointments, clients, pets, inventory, employees, and time tracking in one place.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes. All plans include a 14-day free trial. No credit card required to start.',
  },
  {
    question: 'Can I manage multiple locations?',
    answer: 'Yes. The Enterprise plan includes multi-location support. Contact us for details.',
  },
  {
    question: 'Do you offer client-facing booking?',
    answer: 'Yes. Clients can book appointments through your booking flow. You can also manage appointments manually from the dashboard.',
  },
];

/** Full text of each public page for crawlers. Add an entry when you add a new page to DISCOVERABLE_ROUTES. */
export interface PageSection {
  heading: string;
  body: string;
}

export type PageContent = { sections: PageSection[] };

export const PAGE_CONTENT: Record<string, PageContent> = {
  '/': {
    sections: [
      { heading: 'Hero', body: 'Transform How You Run Your Pet Business. Save hours every week with software built specifically for your industry.' },
      {
        heading: 'Features',
        body: 'Marketing features section: appointments and calendar, staff management and PIN punch, SMS/WhatsApp reminders, clients and pets, dashboard and reports, inventory with low-stock alerts. Mini UI previews on the public landing page.',
      },
      {
        heading: 'Call to action',
        body: 'Join the waitlist for Founders Price (25% off your first year at launch). Link anchors to #waitlist on the home page.',
      },
    ],
  },
  '/pricing': {
    sections: [
      {
        heading: 'Intro',
        body: 'Plan tiers and features are listed on the pricing page. All published prices are to be determined (TBD) until launch. A 14-day free trial is planned; no credit card required to start when available.',
      },
      ...PRICING_TIERS.flatMap((t) => [
        {
          heading: `${t.name} — TBD`,
          body: [t.description, ...t.features].join('. '),
        } as PageSection,
      ]),
    ],
  },
  '/why-grumi': {
    sections: [
      {
        heading: 'Problem',
        body: 'Existing salon software is not built for Puerto Rico: language, payments without ATH Móvil, and unnecessary POS hardware expectations.',
      },
      {
        heading: 'Solution',
        body: 'Grumi is co-built with local groomers: Spanish-first, local payments, and workflows that match how salons operate in PR.',
      },
      {
        heading: 'Stratum PR',
        body: 'Stratum PR LLC is a Puerto Rican decision-systems company; Grumi is its first product collaboration with the grooming industry.',
      },
    ],
  },
  '/contact': {
    sections: [
      {
        heading: 'Contact',
        body: 'Email support for questions about Grumi. Waitlist signup form on the same page. Grumi is in active development.',
      },
    ],
  },
  '/terms': {
    sections: [
      {
        heading: 'Terms of Use (platform)',
        body: 'Full Terms of Service for the Grumi application are published on this path as Markdown in Spanish and English, selectable via the site language control.',
      },
    ],
  },
  '/website-terms': {
    sections: [
      {
        heading: 'Website terms',
        body: 'Terms for using the public grumi.pet site and waitlist, in Spanish and English, selectable via the site language control. Opens with definitions (Sitio, Site Terms, Grumi).',
      },
    ],
  },
  '/privacy': {
    sections: [
      {
        heading: 'Privacy',
        body: 'Privacy practices for the site and platform, third-party processors (e.g. Stripe, ATH Móvil, Supabase), user rights, and defined terms (Sitio, Plataforma, Cuenta) in Spanish.',
      },
    ],
  },
  '/login': {
    sections: [{ heading: 'Log in', body: 'Log in to your Grumi account.' }],
  },
  '/registrarse': {
    sections: [{ heading: 'Sign up', body: 'Create your Grumi account. Sign up as a business owner or client.' }],
  },
  '/portal': {
    sections: [{ heading: 'Client portal', body: 'Grumi global client portal. Choose businesses and view your own appointments and pet care info.' }],
  },
  '/demo': {
    sections: [{ heading: 'Demo', body: 'Try Grumi with our interactive demo. No signup required.' }],
  },
  '/directorio': {
    sections: [{ heading: 'Directorio', body: 'Encuentra negocios y accede a sus portales de clientes.' }],
  },
  '/signup/success': {
    sections: [{ heading: 'Success', body: 'Your Grumi account has been created. Check your email to activate.' }],
  },
  '/waitlist/confirmed': {
    sections: [
      {
        heading: 'Confirmed',
        body: "You are on the Grumi waitlist with Founder's Price locked in. Optional short survey to help prioritize features.",
      },
    ],
  },
};
