import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { t } from '@/lib/translations';
import { useWaitlistModal } from '@/contexts/WaitlistModalContext';
import { useLanguage } from '@/contexts/LanguageContext';

export function MarketingBottomCta() {
  const { openWaitlistModal } = useWaitlistModal();
  useLanguage();

  return (
    <section
      className="relative bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 px-4 py-12 text-white sm:py-16"
      aria-labelledby="marketing-bottom-cta-heading"
    >
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h2 id="marketing-bottom-cta-heading" className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t('marketing.bottomCta.title')}
        </h2>
        <p className="text-white/85 text-sm sm:text-base">{t('marketing.bottomCta.subtitle')}</p>
        <Button
          type="button"
          onClick={() => openWaitlistModal()}
          className="rounded-full bg-[#D4FF00] text-black hover:bg-[#BFEF00] font-semibold px-6 py-5 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] inline-flex items-center gap-2"
        >
          {t('waitlist.submitCta')}
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
