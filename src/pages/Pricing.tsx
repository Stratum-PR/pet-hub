import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, ArrowRight, Menu } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const PRICING_PLANS = [
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

export function Pricing() {
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleStartTrial = async (tier: 'basic' | 'pro' | 'enterprise') => {
    if (!email || !businessName) {
      toast.error('Please enter your email and business name');
      return;
    }

    if (!email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Call API to create Stripe checkout session
      // Note: In a Vite app, this would need to be a separate backend or Supabase Edge Function
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: getStripePriceId(tier),
          email,
          businessName,
          tier,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      // In production, you'd use Stripe's embedded checkout
      // For now, we'll show a message
      toast.success('Redirecting to checkout...');
      
      // TODO: Integrate Stripe embedded checkout
      // This requires Stripe.js and proper setup
      console.log('Would redirect to Stripe checkout with session:', sessionId);
      
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStripePriceId = (tier: string): string => {
    const priceIds: Record<string, string> = {
      basic: import.meta.env.VITE_STRIPE_PRICE_BASIC || '',
      pro: import.meta.env.VITE_STRIPE_PRICE_PRO || '',
      enterprise: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE || '',
    };
    return priceIds[tier] || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      {/* Language - desktop only; mobile gets it in sheet */}
      <div className="fixed top-4 right-4 z-50 hidden md:block">
        <LanguageSwitcher />
      </div>
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/pet-hub-logo.svg" alt="Pet Hub" className="h-10" />
          <span className="text-xl font-semibold">Pet Hub</span>
        </Link>
        <div className="hidden md:flex items-center gap-4">
          <Link to="/login">
            <Button variant="ghost">{t('landing.login')}</Button>
          </Link>
          <Link to="/registrarse">
            <Button>{t('landing.getStarted')}</Button>
          </Link>
        </div>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden shrink-0" aria-label="Menu">
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
                <Button variant="ghost" className="w-full justify-start">{t('landing.login')}</Button>
              </Link>
              <Link to="/registrarse" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">{t('landing.getStarted')}</Button>
              </Link>
              <Link to="/registrarse" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">{t('landing.startFreeTrial')}</Button>
              </Link>
              <Link to="/demo/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">{t('landing.viewDemo')}</Button>
              </Link>
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">{t('landing.viewPricingPlans')}</Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground">
            Choose the plan that's right for your business. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Business Info Form */}
        <Card className="max-w-2xl mx-auto mb-12">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Enter your business information to begin your free trial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  placeholder="Your Business Name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {PRICING_PLANS.map((plan) => (
            <Card
              key={plan.tier}
              className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleStartTrial(plan.tier)}
                  disabled={loading || !email || !businessName}
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12 text-muted-foreground">
          <p>All plans include a 14-day free trial. No credit card required to start.</p>
          <p className="mt-2">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Inicia sesión aquí
            </Link>
            {' · '}
            <Link to="/registrarse" className="text-primary hover:underline">
              Registrarse
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
