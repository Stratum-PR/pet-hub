import { useState, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { Check, ArrowRight, Menu, ChevronDown } from 'lucide-react';
import { t } from '@/lib/translations';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { PageMeta } from '@/components/PageMeta';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
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

const LANDING_NAV_LINKS = [
  { id: 'features', key: 'landing.navFeatures' as const },
  { id: 'why-pet-hub', key: 'landing.navWhyPetHub' as const },
  { id: 'pricing', key: 'landing.navPricing' as const },
  { id: 'faq', key: 'landing.navFaq' as const },
  { id: 'about', key: 'landing.navAbout' as const },
];

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
      className="inline-flex rounded-full p-1 bg-white/40 backdrop-blur-md border border-border shadow-sm"
    >
      <button
        type="button"
        onClick={() => onChange('annual')}
        aria-pressed={value === 'annual'}
        aria-label="Annual billing — Save 15%"
        className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          value === 'annual'
            ? 'bg-[#D4FF00] text-black shadow'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
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
            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
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
    <div className="min-h-screen flex flex-col">
      <PageMeta route={PRICING_ROUTE} />

      {/* Hero background — same as Landing for consistent transition feel */}
      <section className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 via-teal-900/80 to-slate-900/90">
          <img
            src="/hero_background.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-right md:object-center"
            aria-hidden
          />
          <div className="absolute inset-0 bg-black/[0.125] pointer-events-none" aria-hidden />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: 'rgba(140, 125, 100, 0.22)' }}
            aria-hidden
          />
        </div>
      </section>

      {/* Blur overlay — same animation as login modal */}
      <div
        className="fixed inset-0 z-[1] animate-backdrop-blur-in bg-transparent pointer-events-none"
        aria-hidden
      />

      {/* Nav — pill-shaped glass header, shared look with Landing */}
      <header className="fixed top-3 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <nav className="container mx-auto px-4 pointer-events-auto">
          <div className="relative flex items-center justify-between gap-4 rounded-full border border-white/30 bg-white/60 backdrop-blur-xl px-4 py-2 sm:px-6 sm:py-3 shadow-lg shadow-black/10">
            <Link
              to="/"
              className="flex items-center gap-2 shrink-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] rounded-full"
            >
              <img src="/pet-hub-icon.svg" alt="" className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
              <span className="text-slate-900 font-semibold text-lg sm:text-xl">Pet Hub</span>
            </Link>
            {/* Center nav - desktop, same entries as Landing */}
            <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
              {LANDING_NAV_LINKS.map(({ id, key }) =>
                id === 'pricing' ? (
                  <Link
                    key={id}
                    to="/pricing"
                    className="px-3 py-1.5 text-sm font-medium text-slate-900/85 hover:text-slate-900 rounded-full hover:bg-white/80 transition-colors"
                  >
                    {t(key)}
                  </Link>
                ) : (
                  <Link
                    key={id}
                    to={`/#${id}`}
                    className="px-3 py-1.5 text-sm font-medium text-slate-900/85 hover:text-slate-900 rounded-full hover:bg-white/80 transition-colors"
                  >
                    {t(key)}
                  </Link>
                )
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              <LanguageSwitcher
                variant="ghost"
                size="sm"
                className="text-slate-900 hover:bg-white/70 hover:text-slate-900"
              />
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-white/80 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
              >
                {t('landing.login')}
              </Link>
              <Link to="/registrarse" className="hidden sm:block">
                <Button className="bg-[#D4FF00] hover:bg-[#BFEF00] text-black rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]">
                  {t('landing.startFreeTrial')}
                </Button>
              </Link>
            </div>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden text-white hover:bg-white/10 rounded-full"
                  aria-label="Menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex flex-col gap-6 pt-8">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Idioma / Language</p>
                  <LanguageSwitcher />
                </div>
                <div className="flex flex-col gap-2">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      {t('landing.login')}
                    </Button>
                  </Link>
                  <Link to="/registrarse" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full justify-start">{t('landing.startFreeTrial')}</Button>
                  </Link>
                  <Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      {t('landing.viewPricingPlans')}
                    </Button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>

      {/* Glass modal container — wider and more transparent than login modal */}
      <div className="relative z-10 flex flex-col items-center pt-24 pb-20 px-4 flex-1">
        <div
          className="w-full max-w-[1400px] rounded-3xl bg-white/65 backdrop-blur-xl border border-white/40 shadow-2xl animate-zoom-out-up mt-4"
          style={{
            boxShadow: '0 32px 64px rgba(0,0,0,0.18), 0 0 1px rgba(255,255,255,0.5)',
          }}
          role="article"
          aria-label="Pricing plans"
        >
          <div className="px-6 py-8 md:px-12 md:py-10 lg:px-16 lg:py-12">
            {/* Modal header */}
            <header className="text-center mb-8 md:mb-10">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-2">
                Start Free. Scale with Confidence.
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg">
                Pay only as your pet care business grows
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1 mb-4">
                All plans include 14-day free trial. No credit card required.
              </p>
              <BillingToggle value={billing} onChange={setBilling} />
            </header>

            {/* Pricing grid: 4 → 2 → 1 */}
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
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border-white/50 bg-white/40 backdrop-blur-md text-sm font-semibold text-foreground hover:bg-white/60 hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                    className="rounded-xl border bg-white/50 backdrop-blur-sm border-border p-4 hover:border-primary/30 transition-colors"
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
              <div className="rounded-xl border border-border bg-white/50 backdrop-blur-sm overflow-hidden overflow-x-auto">
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

            {/* Footer note + global footer */}
            <footer className="mt-4 pt-6 border-t border-border text-center text-xs sm:text-sm text-muted-foreground">
              <p className="mb-3">Prices in USD. Cancel anytime.</p>
              <Footer />
            </footer>
          </div>
        </div>
      </div>
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
      className="relative rounded-2xl border border-border bg-white/60 backdrop-blur-sm p-6 flex flex-col h-full transition-colors hover:border-primary/30"
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
          className="inline-flex items-center justify-center rounded-xl border-2 border-primary/50 bg-white/60 backdrop-blur-sm px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {tier.buttonLabel}
          <ArrowRight className="ml-2 w-4 h-4" />
        </a>
      ) : (
        <Button
          asChild
          className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Link to={`/registrarse?tier=${tier.id}`}>
            {tier.buttonLabel}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      )}
    </article>
  );
}
