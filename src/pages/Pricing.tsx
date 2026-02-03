import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, ArrowRight } from 'lucide-react';
import { t } from '@/lib/translations';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function Pricing() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 focus:outline-none"
        >
          <img src="/stratum hub logo.svg" alt="Stratum Hub" className="h-8 sm:h-10" />
          <span className="hidden sm:inline text-lg font-semibold">Stratum Hub</span>
        </button>
        <Link to="/login">
          <Button variant="ghost">{t('landing.login')}</Button>
        </Link>
      </nav>
      <section className="container mx-auto px-4 py-12 sm:py-20 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">{t('landing.readyTitle')}</h1>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">{t('landing.readyText')}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {['basic', 'pro', 'enterprise'].map((tier) => (
            <Card key={tier} className="flex flex-col">
              <CardHeader>
                <CardTitle className="capitalize">{tier}</CardTitle>
                <CardDescription>
                  {tier === 'basic' && '14-day free trial'}
                  {tier === 'pro' && 'Most popular'}
                  {tier === 'enterprise' && 'Custom'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="text-sm text-muted-foreground space-y-2 mb-6 text-left">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    Scheduling & appointments
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    Customers & pets
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    Reports
                  </li>
                </ul>
                <Link to="/signup" className="mt-auto">
                  <Button className="w-full">
                    {t('landing.startFreeTrial')}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
