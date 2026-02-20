import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { t } from '@/lib/translations';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LoginForm } from '@/components/LoginForm';

export function Login() {
  const navigate = useNavigate();
  useLanguage(); // Force re-render on language change

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
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
              <img src="/pet-hub-logo.svg" alt="Pet Hub" className="h-12" />
            </div>
            <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
            <CardDescription>{t('login.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm onLoginSuccess={(destination) => navigate(destination, { replace: true })} />
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
