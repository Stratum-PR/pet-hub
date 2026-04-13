import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { t } from '@/lib/translations';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DEMO_WORKSPACE_SLUG } from '@/lib/demoWorkspace';
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
    <header className="pointer-events-none fixed left-0 right-0 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-50 flex justify-center">
      <nav className="container mx-auto px-4 pointer-events-auto" aria-label="Marketing">
        <div className="relative flex items-center justify-between gap-4 rounded-full border border-white/30 bg-white/60 backdrop-blur-xl px-4 py-2 sm:px-6 sm:py-3 shadow-lg shadow-black/10">
          {mode === 'landing' ? (
            <button
              type="button"
              onClick={onLogoClick}
              className="flex items-center shrink-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] rounded-full"
            >
              <img
                src={logoSrc}
                alt="Grumi"
                className="h-8 sm:h-9 w-auto max-w-[min(200px,42vw)] object-contain object-left"
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
                className="h-8 sm:h-9 w-auto max-w-[min(200px,42vw)] object-contain object-left"
              />
            </Link>
          )}

          <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
            {MARKETING_NAV_ITEMS.map((item) => (
              <NavItemLink key={item.kind === 'hash' ? item.hash : item.to} item={item} />
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <LanguageSwitcher
              variant="ghost"
              size="sm"
              className="text-slate-900 hover:bg-white/70 hover:text-slate-900"
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
              className={`bg-[#D4FF00] hover:bg-[#BFEF00] text-black rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] ${
                mode === 'standard' ? 'hidden sm:inline-flex' : 'inline-flex'
              }`}
            >
              {t('waitlist.navCta')}
            </Button>
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={onMobileMenuOpenChange}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-slate-900 hover:bg-white/15 rounded-full"
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
                <Link to={`/${DEMO_WORKSPACE_SLUG}/dashboard`} onClick={closeMobile}>
                  <Button variant="ghost" className="w-full justify-start">
                    {t('landing.viewDemo')}
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
