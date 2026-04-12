import { useState } from 'react';
import { Copy, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageMeta } from '@/components/PageMeta';
import { Footer } from '@/components/Footer';
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { WaitlistForm } from '@/components/waitlist/WaitlistForm';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { t } from '@/lib/translations';

/** Prefer VITE_CONTACT_EMAIL; Grumi support when unset (see Pricing). */
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'support@grumi.pet';

const CONTACT_ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/contact')!;

export function Contact() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      toast.success(t('marketing.contact.copied'));
    } catch {
      toast.error(t('waitlist.errorGeneric'));
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageMeta route={CONTACT_ROUTE} />
      <MarketingSiteHeader
        mode="standard"
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuOpenChange={setMobileMenuOpen}
      />

      <main className="flex-1 relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_45%_at_50%_-15%,rgba(212,255,0,0.1),transparent_50%)]"
          aria-hidden
        />

        <div className="max-w-6xl mx-auto px-4 pt-28 pb-16 space-y-10">
          <MarketingPageHero>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              {t('marketing.contact.heroTag')}
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight max-w-2xl mx-auto">
              {t('marketing.contact.title')}
            </h1>
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base mt-4 max-w-xl mx-auto">
              {t('marketing.contact.subtitle')}
            </p>
          </MarketingPageHero>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D4FF00]/90 text-black">
                    <Mail className="w-5 h-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('marketing.contact.emailLabel')}
                    </p>
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="text-base font-semibold text-primary hover:underline break-all"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-border"
                  onClick={() => void copyEmail()}
                >
                  <Copy className="w-4 h-4 mr-1.5" aria-hidden />
                  {t('marketing.contact.copy')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed px-1">{t('marketing.contact.waitlistHint')}</p>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm shadow-md p-6 sm:p-8 md:p-10">
              <h2 className="text-lg font-bold text-foreground tracking-tight mb-1">
                {t('marketing.contact.waitlistTitle')}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">{t('marketing.contact.waitlistLead')}</p>
              <WaitlistForm className="w-full" animate={false} surface="light" />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
