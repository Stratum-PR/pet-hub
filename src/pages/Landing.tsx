import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { Calendar, Users, DollarSign, ArrowRight, Eye, Menu, ChevronDown } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute, getLastRoute } from '@/lib/authRouting';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SplashAuthModal } from '@/components/SplashAuthModal';
import { LoginForm } from '@/components/LoginForm';

export function Landing() {
  const navigate = useNavigate();
  const { user, isAdmin, business, loading } = useAuth();
  const { language } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

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

  // Redirect logged-in users
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const last = getLastRoute();
    if (last && last !== '/' && last !== '/login') {
      navigate(last, { replace: true });
      return;
    }
    navigate(getDefaultRoute({ isAdmin, business }), { replace: true });
  }, [loading, user, isAdmin, business, navigate]);

  const handleLogoClick = () => {
    if (loading) return;
    if (!user) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate(getDefaultRoute({ isAdmin, business }), { replace: true });
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
      {/* Fixed header - stays on screen when scrolling */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-md supports-[backdrop-filter]:bg-black/10">
        <nav className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-2 shrink-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] rounded"
          >
            <img
              src="/pet-hub-icon.svg"
              alt=""
              className="h-8 w-8 sm:h-9 sm:w-9 object-contain"
            />
            <span className="text-white font-semibold text-lg sm:text-xl">Pet Hub</span>
          </button>

          {/* Center nav - desktop */}
          <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 rounded-full bg-white/10 px-4 py-2 backdrop-blur-md">
            {navLinks.map(({ id, key }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className="px-3 py-1.5 text-sm font-medium text-white hover:text-white/90 rounded-full hover:bg-white/10 transition-colors"
              >
                {t(key)}
              </button>
            ))}
          </div>

          {/* Right: language, Login, Start Free Trial */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <LanguageSwitcher
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white"
            />
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-white hover:bg-white/10 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
            >
              {t('landing.login')}
            </button>
            <Button
              onClick={() => setSignupModalOpen(true)}
              className="bg-black hover:bg-black/90 text-white rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
            >
              {t('landing.startFreeTrial')}
            </Button>
          </div>

          {/* Mobile menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-white hover:bg-white/10"
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
                    setSignupModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                >
                  <Button className="w-full justify-start">{t('landing.startFreeTrial')}</Button>
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
                <Link to="/demo/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    {t('landing.viewDemo')}
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </header>

      {/* Video background + hero */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden bg-gradient-to-br from-emerald-900/90 via-teal-900/80 to-slate-900/90">
          {/* Fallback image when video is loading or fails */}
          <img
            src="/hero_background.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-right md:object-center"
            aria-hidden
          />
          <div className="absolute inset-0 w-full h-full motion-reduce:!animate-none animate-hero-film-drift">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/hero_background.png"
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

            {/* CTA buttons: start 1.5s, duration 0.5s — ends same time as subtitle */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-center justify-center w-full max-w-md sm:max-w-none opacity-0 motion-reduce:!animate-none motion-reduce:opacity-100 motion-reduce:!scale-100 animate-cta-reveal shrink-0">
            <Button
              onClick={() => setSignupModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center gap-2 rounded-xl px-5 py-2.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold text-black bg-[#D4FF00] hover:bg-[#BFEF00] hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
              style={{
                boxShadow: '0 4px 16px rgba(205,255,0,0.25), 0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              {t('landing.startFreeTrial')}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Link to="/demo/dashboard" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto inline-flex items-center gap-2 rounded-xl px-5 py-2.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold text-white border-white/25 bg-white/10 backdrop-blur-2xl hover:bg-white/15 hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              >
                <Eye className="w-4 h-4" />
                {t('landing.viewDemo')}
              </Button>
            </Link>
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

      {/* Section: Features */}
      <section id="features" className="container mx-auto px-4 py-16 sm:py-24 scroll-mt-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('landing.featureSchedulingTitle')}</h3>
            <p className="text-muted-foreground">{t('landing.featureSchedulingText')}</p>
          </div>
          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('landing.featureCustomersTitle')}</h3>
            <p className="text-muted-foreground">{t('landing.featureCustomersText')}</p>
          </div>
          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('landing.featureRevenueTitle')}</h3>
            <p className="text-muted-foreground">{t('landing.featureRevenueText')}</p>
          </div>
        </div>
      </section>

      {/* Section: Why Pet Hub */}
      <section id="why-pet-hub" className="container mx-auto px-4 py-16 sm:py-24 scroll-mt-20 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">{t('landing.readyTitle')}</h2>
          <p className="text-muted-foreground text-lg">{t('landing.readyText')}</p>
        </div>
      </section>

      {/* Section: Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-16 sm:py-24 scroll-mt-20">
        <div className="bg-card p-6 sm:p-12 rounded-lg shadow-sm border max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">{t('landing.readyTitle')}</h2>
          <p className="text-muted-foreground mb-6 sm:mb-8 text-base sm:text-lg px-2">
            {t('landing.readyText')}
          </p>
          <Link to="/pricing" className="inline-block w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
              {t('landing.viewPricingPlans')}
              <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Section: FAQ */}
      <section id="faq" className="container mx-auto px-4 py-16 sm:py-24 scroll-mt-20 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">{t('landing.navFaq')}</h2>
          <p className="text-muted-foreground">Content coming soon.</p>
        </div>
      </section>

      {/* Section: About */}
      <section id="about" className="container mx-auto px-4 py-16 sm:py-24 scroll-mt-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">{t('landing.navAbout')}</h2>
          <p className="text-muted-foreground">Content coming soon.</p>
        </div>
      </section>

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

      {/* Signup modal - Start free trial */}
      <SplashAuthModal
        isOpen={signupModalOpen}
        onClose={() => setSignupModalOpen(false)}
        title={t('landing.modalSignUp')}
        titleId="splash-signup-modal-title"
      >
        {/* Form content to be added by you */}
      </SplashAuthModal>
    </div>
  );
}
