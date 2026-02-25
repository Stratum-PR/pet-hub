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
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    tier: 'basic',
    name: 'Basic',
    price: 29,
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
    tier: 'pro',
    name: 'Pro',
    price: 79,
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
    tier: 'enterprise',
    name: 'Enterprise',
    price: 199,
    description: 'For large operations',
    features: [
      'Everything in Pro',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 phone support',
      'Custom reporting',
      'Multi-location support',
      'API access',
    ],
    popular: false,
  },
];

export interface FaqEntry {
  question: string;
  answer: string;
}

/** FAQ shown on the landing page and exposed in llms.txt / content.json. Edit here. */
export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: 'What is Pet Hub?',
    answer: 'Pet Hub is a business management platform for pet grooming businesses. It helps you manage appointments, clients, pets, inventory, employees, and time tracking in one place.',
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
      { heading: 'Features', body: 'Easy Scheduling: Manage appointments effortlessly with our intuitive calendar system. Never double-book again with real-time availability. Customer Management: Keep detailed records of your clients and their pets. Track preferences, history, and special instructions all in one place. Revenue Tracking: Monitor your business performance with comprehensive analytics. Track revenue, appointments, and growth metrics.' },
      { heading: 'Why Pet Hub', body: 'Ready to Get Started? Choose the plan that fits your business. All plans include a 14-day free trial.' },
      { heading: 'Pricing', body: 'View pricing plans. All plans include a 14-day free trial. No credit card required.' },
      ...FAQ_ENTRIES.flatMap((f) => [{ heading: `FAQ: ${f.question}`, body: f.answer }] as PageSection[]),
      { heading: 'About', body: 'Pet Hub is a pet grooming business management platform. Manage appointments, clients, pets, inventory, and employees in one place.' },
    ],
  },
  '/pricing': {
    sections: [
      { heading: 'Intro', body: 'Simple, transparent pricing. Choose the plan that\'s right for your business. All plans include a 14-day free trial. No credit card required to start.' },
      ...PRICING_TIERS.flatMap((t) => [
        { heading: `${t.name} - $${t.price}/month`, body: [t.description, ...t.features].join('. ') } as PageSection,
      ]),
    ],
  },
  '/login': {
    sections: [{ heading: 'Log in', body: 'Log in to your Pet Hub account.' }],
  },
  '/registrarse': {
    sections: [{ heading: 'Sign up', body: 'Create your Pet Hub account. Sign up as a business owner or client.' }],
  },
  '/cliente': {
    sections: [{ heading: 'Client portal', body: 'Pet Hub client portal. View your appointments and pet care info.' }],
  },
  '/demo': {
    sections: [{ heading: 'Demo', body: 'Try Pet Hub with our interactive demo. No signup required.' }],
  },
  '/signup/success': {
    sections: [{ heading: 'Success', body: 'Your Pet Hub account has been created. Check your email to activate.' }],
  },
};
