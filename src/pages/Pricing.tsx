import { useState, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { Check, ArrowRight, ChevronDown } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import {
  PRICING_TIERS_CONFIG,
  PRICING_ADDONS,
  COMPARISON_SECTIONS,
  type BillingPeriod,
  type CompareCell,
} from '@/content/pricing-page-data';

const PRICING_ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/pricing')!;
const COMPARISON_TABLE_ID = 'comparison-table';
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'sales@example.com';

function scrollToComparison() {
  const el = document.getElementById(COMPARISON_TABLE_ID);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function BillingToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (v: BillingPeriod) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Billing period"
      className="inline-flex rounded-full p-1 bg-muted/60 border border-border shadow-sm"
    >
      <button
        type="button"
        onClick={() => onChange('annual')}
        aria-pressed={value === 'annual'}
        aria-label="Annual billing — Save 15%"
        className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          value === 'annual'
            ? 'bg-[#D4FF00] text-black shadow'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
        }`}
      >
        Annual billing <span className="text-xs opacity-90">(Save 15%)</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('monthly')}
        aria-pressed={value === 'monthly'}
        aria-label="Monthly billing"
        className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          value === 'monthly'
            ? 'bg-[#D4FF00] text-black shadow'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
        }`}
      >
        Monthly billing
      </button>
    </div>
  );
}

function CompareCellContent({ cell }: { cell: CompareCell }) {
  if (cell === 'check') {
    return (
      <span className="inline-flex text-primary" aria-hidden>
        <Check className="w-5 h-5" strokeWidth={2.5} />
      </span>
    );
  }
  if (cell === 'dash') {
    return (
      <span className="text-muted-foreground/60" aria-hidden>
        —
      </span>
    );
  }
  return <span className="text-foreground text-sm">{cell}</span>;
}

export function Pricing() {
  const [billing, setBilling] = useState<BillingPeriod>('annual');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToComparisonCb = useCallback(scrollToComparison, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageMeta route={PRICING_ROUTE} />

      <MarketingSiteHeader
        mode="standard"
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuOpenChange={setMobileMenuOpen}
      />

      <main className="relative flex-1 pt-28 pb-12 px-4">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_40%_at_50%_-18%,rgba(212,255,0,0.11),transparent_52%)]"
          aria-hidden
        />

        <div className="w-full max-w-6xl mx-auto space-y-10 pb-4">
          <MarketingPageHero>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">Pricing</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-2 max-w-3xl mx-auto">
              Start free. Scale with confidence.
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              Pay only as your pet care business grows.
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm mt-2 max-w-xl mx-auto">
              All plans include a 14-day free trial. No credit card required.
            </p>
          </MarketingPageHero>

          <div
            className="rounded-3xl border border-border/80 bg-card text-card-foreground shadow-md overflow-hidden"
            role="article"
            aria-label="Pricing plans"
          >
            <div className="px-5 py-8 sm:px-8 sm:py-9 md:px-10 md:py-10 lg:px-12 lg:py-11">
              <header className="text-center mb-8 md:mb-9">
                <BillingToggle value={billing} onChange={setBilling} />
              </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
              {PRICING_TIERS_CONFIG.map((tier) => (
                <PricingCard key={tier.id} tier={tier} billing={billing} />
              ))}
            </div>

            {/* Single comparison link below all tiers */}
            <section className="mb-16 text-center">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={scrollToComparisonCb}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-border bg-muted/40 text-sm font-semibold text-foreground hover:bg-muted/60 hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Compare Plans in Detail
                <ChevronDown className="ml-2 w-4 h-4" />
              </Button>
            </section>

            {/* Add-ons */}
            <section className="mb-12" aria-labelledby="addons-heading">
              <h2 id="addons-heading" className="text-xl font-semibold text-center mb-6">
                Enhance Your Plan
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PRICING_ADDONS.map((addon) => (
                  <div
                    key={addon.id}
                    className="rounded-xl border border-border bg-muted/20 p-4 hover:border-primary/30 transition-colors"
                  >
                    <h3 className="font-medium text-foreground mb-1">{addon.title}</h3>
                    <p className="text-sm font-medium text-primary mb-1">{addon.price}</p>
                    <p className="text-sm text-muted-foreground">{addon.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Available for: {addon.availableFor.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Comparison table */}
            <section
              id={COMPARISON_TABLE_ID}
              className="mb-10"
              aria-labelledby="comparison-heading"
            >
              <h2 id="comparison-heading" className="text-xl font-semibold text-center mb-6">
                Compare Plans in Detail
              </h2>
              <div className="rounded-xl border border-border bg-background overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm" role="grid" aria-label="Plan comparison">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 sticky top-0 z-10">
                      <th
                        scope="col"
                        className="text-left py-3 px-4 font-semibold text-foreground w-[200px]"
                      >
                        Feature
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold text-foreground">
                        Basic
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold text-foreground">
                        Growth
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold text-foreground">
                        Pro
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold text-foreground">
                        Enterprise
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_SECTIONS.map((sec) => (
                      <Fragment key={sec.category}>
                        <tr className="bg-muted/30">
                          <td
                            colSpan={5}
                            className="py-2 px-4 font-semibold text-foreground"
                            id={`cat-${sec.category.replace(/\s+/g, '-')}`}
                          >
                            {sec.category}
                          </td>
                        </tr>
                        {sec.rows.map((row, ri) => (
                          <tr
                            key={`${sec.category}-${ri}`}
                            className="border-b border-border/70 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2.5 px-4 text-foreground">{row.feature}</td>
                            <td className="py-2.5 px-4 text-center">
                              <CompareCellContent cell={row.basic} />
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <CompareCellContent cell={row.growth} />
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <CompareCellContent cell={row.pro} />
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <CompareCellContent cell={row.enterprise} />
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="mt-6 pt-6 border-t border-border text-center text-xs sm:text-sm text-muted-foreground">
              <p>Prices in USD. Cancel anytime.</p>
            </footer>
          </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function PricingCard({
  tier,
  billing,
}: {
  tier: (typeof PRICING_TIERS_CONFIG)[number];
  billing: BillingPeriod;
}) {
  const isAnnual = billing === 'annual';
  const price =
    tier.price == null
      ? null
      : isAnnual
        ? tier.price.annualPerMonth
        : tier.price.monthly;

  return (
    <article
      className="relative rounded-2xl border border-border bg-background p-6 flex flex-col h-full transition-colors hover:border-primary/30 shadow-sm"
      aria-labelledby={`tier-${tier.id}-name`}
    >
      <div className="mb-4">
        <h3 id={`tier-${tier.id}-name`} className="text-xl font-bold text-foreground">
          {tier.name}
        </h3>
        <p className="text-sm text-muted-foreground">{tier.tagline}</p>
      </div>
      <div className="mb-4">
        {price != null ? (
          <div
            key={billing}
            className="flex items-baseline gap-1 flex-wrap animate-fade-in"
            aria-live="polite"
          >
            <span className="text-3xl font-bold text-foreground tabular-nums">${price}</span>
            <span className="text-muted-foreground">/month</span>
            {isAnnual && tier.price && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Save 15%
              </span>
            )}
          </div>
        ) : (
          <p className="text-lg font-semibold text-muted-foreground">Custom pricing</p>
        )}
      </div>
      <ul className="space-y-2 flex-1 mb-6 text-sm text-foreground" aria-label={`${tier.name} features`}>
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {tier.buttonVariant === 'contact' ? (
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Enterprise%20pricing%20inquiry`}
          className="inline-flex items-center justify-center rounded-xl border-2 border-primary/50 bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {tier.buttonLabel}
          <ArrowRight className="ml-2 w-4 h-4" />
        </a>
      ) : (
        <Button
          asChild
          className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Link to={`/?tier=${encodeURIComponent(tier.id)}#waitlist`}>
            {tier.buttonLabel}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      )}
    </article>
  );
}
