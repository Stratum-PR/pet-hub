import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { t } from '@/lib/translations';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useThemedGrumiWordmarkSrc } from '@/hooks/useThemedGrumiWordmarkSrc';
import { MARKETING_NAV_ITEMS, type MarketingNavItem } from './marketingNavConfig';
import { useWaitlistModal } from '@/contexts/WaitlistModalContext';
import { useLanguage } from '@/contexts/LanguageContext';

export type MarketingSiteHeaderMode = 'landing' | 'standard';

type Props = {
  mode: MarketingSiteHeaderMode;
  mobileMenuOpen: boolean;
  onMobileMenuOpenChange: (open: boolean) => void;
  /** Landing: scroll home + top. Standard: unused (logo is Link). */
  onLogoClick?: () => void;
  onOpenLoginModal?: () => void;
};

function NavItemLink({ item, onNavigate }: { item: MarketingNavItem; onNavigate?: () => void }) {
  if (item.kind === 'hash') {
    return (
      <Link
        to={`/#${item.hash}`}
        onClick={onNavigate}
        className="px-3 py-1.5 text-sm font-medium text-slate-900/85 hover:text-slate-900 rounded-full hover:bg-white/80 transition-colors"
      >
        {t(item.labelKey)}
      </Link>
    );
  }
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className="px-3 py-1.5 text-sm font-medium text-slate-900/85 hover:text-slate-900 rounded-full hover:bg-white/80 transition-colors"
    >
      {t(item.labelKey)}
    </Link>
  );
}

export function MarketingSiteHeader({
  mode,
  mobileMenuOpen,
  onMobileMenuOpenChange,
  onLogoClick,
  onOpenLoginModal,
}: Props) {
  const logoSrc = useThemedGrumiWordmarkSrc();
  const { openWaitlistModal } = useWaitlistModal();
  useLanguage();

  const closeMobile = () => onMobileMenuOpenChange(false);

  return (
    <header className="pointer-events-none fixed left-0 right-0 top-[max(1rem,calc(env(safe-area-inset-top,0px)+0.5rem))] z-50 flex justify-center">
      <nav className="container mx-auto px-5 pointer-events-auto sm:px-4" aria-label="Marketing">
        <div className="relative flex min-h-[3rem] items-center gap-2 rounded-full border border-white/30 bg-white/60 px-3 py-2.5 shadow-lg shadow-black/10 backdrop-blur-xl sm:gap-3 sm:px-6 sm:py-3">
          {mode === 'landing' ? (
            <button
              type="button"
              onClick={onLogoClick}
              className="flex items-center shrink-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] rounded-full"
            >
              <img
                src={logoSrc}
                alt="Grumi"
                className="h-8 w-auto max-w-[min(168px,40vw)] object-contain object-left sm:h-9 sm:max-w-[min(200px,42vw)]"
              />
            </button>
          ) : (
            <Link
              to="/"
              className="flex items-center shrink-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] rounded-full"
            >
              <img
                src={logoSrc}
                alt="Grumi"
                className="h-8 w-auto max-w-[min(168px,40vw)] object-contain object-left sm:h-9 sm:max-w-[min(200px,42vw)]"
              />
            </Link>
          )}

          <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
            {MARKETING_NAV_ITEMS.map((item) => (
              <NavItemLink key={item.kind === 'hash' ? item.hash : item.to} item={item} />
            ))}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-3">
            <LanguageSwitcher
              variant="ghost"
              size="sm"
              className="shrink-0 text-slate-900 hover:bg-white/70 hover:text-slate-900"
            />
            {mode === 'landing' ? (
              <button
                type="button"
                onClick={() => onOpenLoginModal?.()}
                className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-white/80 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
              >
                {t('landing.login')}
              </button>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-white/80 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
              >
                {t('landing.login')}
              </Link>
            )}
            <Button
              type="button"
              onClick={() => openWaitlistModal()}
              className={`shrink-0 bg-[#D4FF00] px-3 py-2 text-xs font-semibold text-black hover:bg-[#BFEF00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] sm:px-4 sm:text-sm ${
                mode === 'standard' ? 'hidden sm:inline-flex' : 'inline-flex'
              } rounded-full`}
            >
              <span className="sm:hidden">{t('waitlist.navCtaShort')}</span>
              <span className="hidden sm:inline">{t('waitlist.navCta')}</span>
            </Button>

            <Sheet open={mobileMenuOpen} onOpenChange={onMobileMenuOpenChange}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-slate-900 hover:bg-white/15 lg:hidden"
                  aria-label="Menu"
                >
                  <Menu className="h-6 w-6" aria-hidden />
                </Button>
              </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-2 pt-8">
              <div className="flex flex-col gap-2">
                {MARKETING_NAV_ITEMS.map((item) =>
                  item.kind === 'hash' ? (
                    <Link key={item.hash} to={`/#${item.hash}`} onClick={closeMobile}>
                      <Button variant="ghost" className="w-full justify-start">
                        {t(item.labelKey)}
                      </Button>
                    </Link>
                  ) : (
                    <Link key={item.to} to={item.to} onClick={closeMobile}>
                      <Button variant="ghost" className="w-full justify-start">
                        {t(item.labelKey)}
                      </Button>
                    </Link>
                  )
                )}
                {mode === 'landing' ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenLoginModal?.();
                      closeMobile();
                    }}
                  >
                    <Button variant="ghost" className="w-full justify-start">
                      {t('landing.login')}
                    </Button>
                  </button>
                ) : (
                  <Link to="/login" onClick={closeMobile}>
                    <Button variant="ghost" className="w-full justify-start">
                      {t('landing.login')}
                    </Button>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    openWaitlistModal();
                  }}
                >
                  <Button className="w-full justify-start">{t('waitlist.navCta')}</Button>
                </button>
              </div>
            </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
}
