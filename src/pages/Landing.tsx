import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { Eye, Menu, ChevronDown, Lock } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { getDefaultRoute, getLastRoute } from '@/lib/authRouting';
import { t } from '@/lib/translations';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SplashAuthModal } from '@/components/SplashAuthModal';
import { LoginForm } from '@/components/LoginForm';
import { PageMeta } from '@/components/PageMeta';
import { DISCOVERABLE_ROUTES, getPublicBaseUrl } from '@/config/discoverable-routes';
import { DEMO_WORKSPACE_SLUG } from '@/lib/demoWorkspace';
import { WaitlistForm } from '@/components/waitlist/WaitlistForm';

const LANDING_ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/')!;

function getLandingJsonLd(): string {
  const base = getPublicBaseUrl();
  return JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Grumi',
      url: base,
      description: 'Pet grooming business management. Manage appointments, clients, pets, and more.',
      logo: `${base}/pet-hub-icon.svg`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Grumi',
      url: base,
      description: LANDING_ROUTE.description,
      // Nested nodes must include @context where parsers walk the tree (Safari JSON-LD can call @context.toLowerCase).
      publisher: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Grumi',
      },
    },
  ]);
}

export function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [heroFallbackImageError, setHeroFallbackImageError] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const scrollToWaitlist = useCallback(() => {
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  useEffect(() => {
    if (location.pathname === '/' && location.hash === '#waitlist') {
      const timer = window.setTimeout(() => scrollToWaitlist(), 150);
      return () => window.clearTimeout(timer);
    }
  }, [location.pathname, location.hash, scrollToWaitlist]);

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

  const navLinks = [
    { id: 'features', key: 'landing.navFeatures' as const },
    { id: 'why-pet-hub', key: 'landing.navWhyPetHub' as const },
    { id: 'pricing', key: 'landing.navPricing' as const },
    { id: 'faq', key: 'landing.navFaq' as const },
    { id: 'about', key: 'landing.navAbout' as const },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageMeta route={LANDING_ROUTE} jsonLd={getLandingJsonLd()} />
      {/* Pill-shaped glass header, shared with Pricing */}
      <header className="fixed top-3 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <nav className="container mx-auto px-4 pointer-events-auto">
          <div className="relative flex items-center justify-between gap-4 rounded-full border border-white/30 bg-white/60 backdrop-blur-xl px-4 py-2 sm:px-6 sm:py-3 shadow-lg shadow-black/10">
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center gap-2 shrink-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] rounded-full"
            >
              <img
                src="/pet-hub-icon.svg"
                alt=""
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain"
              />
              <span className="text-slate-900 font-semibold text-lg sm:text-xl">Grumi</span>
            </button>

            {/* Center nav - desktop, centered inside pill */}
            <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
              {navLinks.map(({ id, key }) =>
                id === 'pricing' ? (
                  <Link
                    key={id}
                    to="/pricing"
                    className="px-3 py-1.5 text-sm font-medium text-slate-900/85 hover:text-slate-900 rounded-full hover:bg-white/80 transition-colors"
                  >
                    {t(key)}
                  </Link>
                ) : (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollToSection(id)}
                    className="px-3 py-1.5 text-sm font-medium text-slate-900/85 hover:text-slate-900 rounded-full hover:bg-white/80 transition-colors"
                  >
                    {t(key)}
                  </button>
                )
              )}
            </div>

            {/* Right: language, Login, Sign Up */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              <LanguageSwitcher
                variant="ghost"
                size="sm"
                className="text-slate-900 hover:bg-white/70 hover:text-slate-900"
              />
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-white/80 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
              >
                {t('landing.login')}
              </button>
              <Button
                type="button"
                onClick={scrollToWaitlist}
                className="bg-[#D4FF00] hover:bg-[#BFEF00] text-black rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
              >
                {t('waitlist.navCta')}
              </Button>
            </div>

            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden text-white hover:bg-white/10 rounded-full"
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
                  <button
                    type="button"
                    onClick={() => {
                      setLoginModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start"
                  >
                    <Button variant="ghost" className="w-full justify-start">
                      {t('landing.login')}
                    </Button>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      scrollToWaitlist();
                    }}
                  >
                    <Button className="w-full justify-start">{t('waitlist.navCta')}</Button>
                  </button>
                  {navLinks.map(({ id, key }) => (
                    <Button
                      key={id}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        scrollToSection(id);
                      }}
                    >
                      {t(key)}
                    </Button>
                  ))}
                  <Link to={`/${DEMO_WORKSPACE_SLUG}/dashboard`} onClick={() => setMobileMenuOpen(false)}>
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

      {/* Hero: prefer video; if video doesn't load/play, fall back to static image */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
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
              autoPlay
              muted
              loop
              playsInline
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

        {/* Hero block: title top → CTA bottom = 30%–70% of viewport (40vh), centered */}
        <div
          className="relative z-10 flex flex-col items-center justify-center px-4 min-h-screen"
          style={{ paddingTop: '30vh', paddingBottom: '30vh' }}
        >
          <div
            className="flex flex-col items-center justify-center text-center w-full max-w-4xl mx-auto"
            style={{
              height: '40vh',
              minHeight: '40vh',
              maxHeight: '40vh',
              gap: 'clamp(0.35rem, 1.8vh, 1rem)',
              justifyContent: 'center',
            }}
          >
            {/* Title: two lines, letter-by-letter (0.5s delay, 1s total) */}
            <h1
              className="font-bold leading-tight tracking-tight text-white text-center w-full"
              style={{
                fontFamily: "Inter, 'SF Pro Display', -apple-system, sans-serif",
                letterSpacing: '-0.03em',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                fontSize: 'clamp(1.5rem, 4.5vw, 3.25rem)',
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

            {/* Waitlist + demo */}
            <div
              id="waitlist"
              className="w-full max-w-xl mx-auto space-y-3 opacity-0 motion-reduce:!animate-none motion-reduce:opacity-100 motion-reduce:!scale-100 animate-cta-reveal shrink-0"
            >
              <WaitlistForm className="w-full" />
              <p className="flex items-center justify-center gap-2 text-xs sm:text-sm text-white/85 text-center px-2">
                <Lock className="w-3.5 h-3.5 shrink-0 text-[#D4FF00]" aria-hidden />
                <span>{t('waitlist.founderLine')}</span>
              </p>
              <div className="flex justify-center pt-1">
                <Link to={`/${DEMO_WORKSPACE_SLUG}/dashboard`} className="w-full sm:w-auto">
                  <Button
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
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 rounded-full text-white/90 hover:text-white bg-white/20 hover:bg-white/25 transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Scroll to content below"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </section>

      {/* Placeholder anchors under hero (content removed for now) */}
      <section id="features" aria-hidden className="hidden" />
      <section id="why-pet-hub" aria-hidden className="hidden" />
      <section id="pricing" aria-hidden className="hidden" />
      <section id="faq" aria-hidden className="hidden" />
      <section id="about" aria-hidden className="hidden" />

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
