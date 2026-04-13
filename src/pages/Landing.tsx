import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { Eye, ChevronDown } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { t } from '@/lib/translations';
import { SplashAuthModal } from '@/components/SplashAuthModal';
import { LoginForm } from '@/components/LoginForm';
import { PageMeta } from '@/components/PageMeta';
import { DISCOVERABLE_ROUTES, getPublicBaseUrl } from '@/config/discoverable-routes';
import { DEMO_WORKSPACE_SLUG } from '@/lib/demoWorkspace';
import { useWaitlistModal } from '@/contexts/WaitlistModalContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader';
import { FeaturesMarketingSection } from '@/components/marketing/FeaturesMarketingSection';
import { MarketingBottomCta } from '@/components/marketing/MarketingBottomCta';
import { LandingWaitlistBrandMotifs } from '../components/marketing/MarketingBrandMotifs';

const LANDING_ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/')!;

function getLandingJsonLd(): string {
  const base = getPublicBaseUrl();
  // Use @graph + single root @context — Safari/WebKit structured-data parsing can throw
  // (e.g. undefined @context + .toLowerCase) on a root-level JSON array in ld+json scripts.
  const payload = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Grumi',
        url: base,
        description: 'Pet grooming business management. Manage appointments, clients, pets, and more.',
        logo: `${base}/logo_grumi_theme.png`,
      },
      {
        '@type': 'WebSite',
        name: 'Grumi',
        url: base,
        description: LANDING_ROUTE.description,
        publisher: {
          '@type': 'Organization',
          name: 'Grumi',
        },
      },
    ],
  };
  return JSON.stringify(payload);
}

export function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { openWaitlistModal } = useWaitlistModal();
  useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [heroFallbackImageError, setHeroFallbackImageError] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (location.pathname !== '/') return;
    const hash = location.hash.replace(/^#/, '');
    if (hash === 'waitlist') {
      const tier = searchParams.get('tier')?.trim() || undefined;
      const timer = window.setTimeout(() => {
        openWaitlistModal(tier ? { pricingTier: tier } : {});
        const path = `${location.pathname}${location.search}`;
        window.history.replaceState(null, '', path || '/');
      }, 150);
      return () => window.clearTimeout(timer);
    }
    if (hash === 'features') {
      const el = document.getElementById(hash);
      const timer = window.setTimeout(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      return () => window.clearTimeout(timer);
    }
  }, [location.pathname, location.hash, location.search, searchParams, openWaitlistModal]);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    const tryPlay = () => {
      if (document.visibilityState === 'hidden') return;
      video.muted = true;
      video.playsInline = true;
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
          // Keep poster/fallback in place when autoplay is blocked by the browser/device.
        });
      }
    };

    tryPlay();
    video.addEventListener('loadeddata', tryPlay);
    window.addEventListener('pageshow', tryPlay);
    document.addEventListener('visibilitychange', tryPlay);

    return () => {
      video.removeEventListener('loadeddata', tryPlay);
      window.removeEventListener('pageshow', tryPlay);
      document.removeEventListener('visibilitychange', tryPlay);
    };
  }, []);

  // Two-line headline: 0.5s delay, then 0.8s total with decremental timing (first letters faster, last slower)
  const headlineLine1 = t('landing.splashHeadlineLine1');
  const headlineLine2 = t('landing.splashHeadlineLine2');
  const chars1 = headlineLine1.split('');
  const chars2 = headlineLine2.split('');
  const totalChars = chars1.length + chars2.length;
  const titleRevealDuration = 0.8;
  // Decremental: letter i has duration ∝ (i+1), so first letters take less time. Sum 1+2+..+n = n(n+1)/2
  const letterDurations: number[] = [];
  if (totalChars > 0) {
    const sumWeights = (totalChars * (totalChars + 1)) / 2;
    for (let i = 0; i < totalChars; i++) {
      letterDurations.push((titleRevealDuration * (i + 1)) / sumWeights);
    }
  }
  const letterDelays: number[] = [];
  let acc = 0.5;
  for (let i = 0; i < totalChars; i++) {
    letterDelays.push(acc);
    acc += letterDurations[i] ?? 0.02;
  }

  // Note: landing page stays public even when logged in; no auto-redirect.

  const handleLogoClick = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-dvh bg-background">
      <PageMeta route={LANDING_ROUTE} jsonLd={getLandingJsonLd()} />
      <MarketingSiteHeader
        mode="landing"
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuOpenChange={setMobileMenuOpen}
        onLogoClick={handleLogoClick}
        onOpenLoginModal={() => setLoginModalOpen(true)}
      />

      {/* Hero: prefer video; if video doesn't load/play, fall back to static image */}
      <section
        ref={heroRef}
        className="relative flex min-h-dvh flex-col items-stretch overflow-x-hidden lg:overflow-hidden"
      >
        <div className="absolute inset-0 z-0 overflow-hidden bg-gradient-to-br from-emerald-900/90 via-teal-900/80 to-slate-900/90">
          {/* Static image fallback when video is loading or fails; hidden if image errors so we only show gradient */}
          {!heroFallbackImageError && (
            <img
              src="/hero_background.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-right md:object-center"
              aria-hidden
              onError={() => setHeroFallbackImageError(true)}
            />
          )}
          <div className="absolute inset-0 w-full h-full motion-reduce:!animate-none animate-hero-film-drift">
            <video
              ref={heroVideoRef}
              autoPlay
              muted
              loop
              playsInline
              controls={false}
              disablePictureInPicture
              preload="auto"
              poster={heroFallbackImageError ? undefined : '/hero_background.png'}
              className="absolute inset-0 w-full h-full object-cover object-right md:object-center"
              aria-hidden
            >
              <source src="/hero_background_animated_720.mp4" type="video/mp4" media="(max-width: 767px)" />
              <source src="/hero_background_animated_1080.mp4" type="video/mp4" media="(min-width: 768px)" />
            </video>
          </div>
          {/* Slight darkening overlay for readability */}
          <div className="absolute inset-0 bg-black/[0.125] pointer-events-none z-[1]" aria-hidden />
          {/* Darker beige overlay */}
          <div
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{ backgroundColor: 'rgba(140, 125, 100, 0.22)' }}
            aria-hidden
          />
        </div>

        {/* Hero: below lg, flexible height so title + CTAs are not clipped; lg+ keeps the framed viewport layout */}
        <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4rem)] pt-[max(6.25rem,calc(env(safe-area-inset-top,0px)+5.25rem))] lg:min-h-dvh lg:pb-[30vh] lg:pt-[30vh]">
          <div className="mx-auto flex w-full max-w-4xl min-h-0 flex-col items-center justify-center gap-2.5 text-center sm:gap-3 lg:h-[40vh] lg:min-h-[40vh] lg:max-h-[40vh] lg:gap-[clamp(0.35rem,1.8vh,1rem)]">
            {/* Title: two lines, letter-by-letter (0.5s delay, 1s total) */}
            <h1
              className="font-bold leading-tight tracking-tight text-white text-center w-full"
              style={{
                fontFamily: "Inter, 'SF Pro Display', -apple-system, sans-serif",
                letterSpacing: '-0.03em',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                fontSize: 'clamp(1.35rem, 5.2vw, 3.25rem)',
                lineHeight: 1.15,
              }}
            >
              <span className="block">
                {chars1.map((char, i) => {
                  const dur = letterDurations[i] ?? 0.02;
                  const delay = letterDelays[i] ?? 0.5;
                  return (
                    <span
                      key={`1-${i}-${char}`}
                      className="inline-block motion-reduce:!animate-none motion-reduce:opacity-100"
                      style={{
                        opacity: 0,
                        animation: `letter-appear ${dur}s ease-out ${delay}s forwards`,
                      }}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  );
                })}
              </span>
              <span className="block mt-0.5" style={{ marginTop: '0.15em' }}>
                {chars2.map((char, i) => {
                  const idx = chars1.length + i;
                  const dur = letterDurations[idx] ?? 0.02;
                  const delay = letterDelays[idx] ?? 0.5;
                  return (
                    <span
                      key={`2-${i}-${char}`}
                      className="inline-block motion-reduce:!animate-none motion-reduce:opacity-100"
                      style={{
                        opacity: 0,
                        animation: `letter-appear ${dur}s ease-out ${delay}s forwards`,
                      }}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  );
                })}
              </span>
            </h1>

            {/* Subtitle: starts 1.5s, duration 0.5s — ends same time as CTAs */}
            <p
              className="font-normal leading-snug text-white/90 max-w-[90%] mx-auto opacity-0 motion-reduce:!animate-none motion-reduce:opacity-100 animate-subtitle-fade-in shrink-0"
              style={{
                textShadow: '0 1px 4px rgba(0,0,0,0.2)',
                fontSize: 'clamp(0.875rem, 2vw, 1.35rem)',
              }}
            >
              {t('landing.splashSubheadline')}
            </p>

            {/* Waitlist CTA + demo */}
            <div
              id="waitlist"
              className="relative w-full max-w-xl mx-auto opacity-0 motion-reduce:!animate-none motion-reduce:opacity-100 motion-reduce:!scale-100 animate-cta-reveal shrink-0"
            >
              <LandingWaitlistBrandMotifs />
              <div className="relative z-10 flex flex-col items-center gap-3 sm:gap-4 pt-1">
                <Button
                  type="button"
                  onClick={() => openWaitlistModal()}
                  className="w-full sm:w-auto min-h-[48px] rounded-xl px-6 py-3 sm:px-8 sm:py-3.5 text-base font-semibold bg-[#D4FF00] text-black hover:bg-[#BFEF00] shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
                >
                  {t('waitlist.splashCta')}
                </Button>
                <p className="max-w-md rounded-2xl px-3 py-1.5 text-center text-xs leading-snug text-white/95 backdrop-blur-[10px] sm:px-4 sm:py-2 sm:text-sm sm:backdrop-blur-md">
                  {t('waitlist.splashCtaSubtitleBefore')}
                  <strong className="font-bold text-white">{t('waitlist.splashCtaSubtitleBold')}</strong>
                  {t('waitlist.splashCtaSubtitleAfter')}
                </p>
                <Link to={`/${DEMO_WORKSPACE_SLUG}/dashboard`} className="w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto inline-flex items-center gap-2 rounded-xl px-5 py-2.5 sm:px-6 sm:py-3 text-sm font-semibold text-white border-white/25 bg-white/10 backdrop-blur-2xl hover:bg-white/15 hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  >
                    <Eye className="w-4 h-4" />
                    {t('landing.viewDemo')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Down arrow: scroll to content below */}
        <button
          type="button"
          onClick={() => scrollToSection('features')}
          className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/20 p-2 text-white/90 transition-colors hover:bg-white/25 hover:text-white focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-4"
          aria-label="Scroll to content below"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </section>

      <section id="features" className="scroll-mt-28" aria-labelledby="marketing-features-heading">
        <h2 id="marketing-features-heading" className="sr-only">
          {t('landing.navFeatures')}
        </h2>
        <FeaturesMarketingSection />
      </section>

      <MarketingBottomCta />

      <Footer />

      {/* Login modal - same form as Login page */}
      <SplashAuthModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        title={t('login.title')}
        titleId="splash-login-modal-title"
      >
        <LoginForm
          onClose={() => setLoginModalOpen(false)}
          onLoginSuccess={(destination) => {
            setLoginModalOpen(false);
            navigate(destination, { replace: true });
          }}
        />
      </SplashAuthModal>

    </div>
  );
}
