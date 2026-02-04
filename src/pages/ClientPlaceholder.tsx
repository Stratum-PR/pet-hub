import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { t } from '@/lib/translations';
import { signOut } from '@/lib/auth';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Footer } from '@/components/Footer';

export function ClientPlaceholder() {
  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t('clientPlaceholder.title')}</CardTitle>
            <CardDescription>{t('clientPlaceholder.comingSoon')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{t('clientPlaceholder.message')}</p>
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              {t('logout.confirmButton')}
            </Button>
            <Link to="/" className="block">
              <Button variant="ghost" className="w-full">Ir al inicio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
