import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { t } from '@/lib/translations';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LoginForm } from '@/components/LoginForm';
import { PageMeta } from '@/components/PageMeta';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { fetchBusinessByPublicSlug } from '@/lib/businessSlug';
import { supabase } from '@/integrations/supabase/client';
import { useThemedGrumiWordmarkSrc } from '@/hooks/useThemedGrumiWordmarkSrc';

const LOGIN_ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/login')!;

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themedGrumiWordmarkSrc = useThemedGrumiWordmarkSrc();
  useLanguage(); // Force re-render on language change
  const businessSlug = searchParams.get('business')?.trim() || undefined;

  const { data: business } = useQuery({
    queryKey: ['loginBusinessBySlug', businessSlug],
    enabled: !!businessSlug,
    queryFn: async () => fetchBusinessByPublicSlug(supabase, businessSlug!),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
      <PageMeta route={LOGIN_ROUTE} />
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div
              className="flex justify-center mb-4 cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
              onClick={() => navigate('/')}
            >
              <img
                src={themedGrumiWordmarkSrc}
                alt="Grumi"
                className="h-12 w-auto max-w-[min(240px,85vw)] object-contain object-center"
              />
            </div>
            <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
            <CardDescription>
              {t('login.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm
              businessSlug={businessSlug}
              businessId={business?.id}
              business={business}
              onLoginSuccess={(destination) => navigate(destination, { replace: true })}
            />
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
