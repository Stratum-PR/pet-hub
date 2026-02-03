import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { Footer } from '@/components/Footer';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function hasRecoveryInHash(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  if (!hash) return false;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('type') === 'recovery';
}

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (hasRecoveryInHash()) {
      supabase.auth.getSession().then(() => {
        setIsRecovery(true);
        setChecking(false);
      });
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsRecovery(!!session);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message || 'Could not update password.');
        return;
      }
      setSuccess(true);
      toast.success(t('resetPassword.success'));
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: unknown) {
      console.error('[ResetPassword]', err);
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <p className="text-muted-foreground">Loading...</p>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div
              className="flex justify-center mb-4 cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => navigate('/')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/')}
              role="button"
              tabIndex={0}
            >
              <img src="/stratum hub logo.svg" alt="Stratum Hub" className="h-12" />
            </div>
            <CardTitle className="text-2xl">{t('resetPassword.title')}</CardTitle>
            <CardDescription>{t('resetPassword.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!isRecovery ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  {t('resetPassword.invalidLink')}
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/forgot-password">{t('resetPassword.requestNew')}</Link>
                </Button>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-primary hover:underline">
                    {t('forgotPassword.backToLogin')}
                  </Link>
                </div>
              </div>
            ) : success ? (
              <p className="text-sm text-muted-foreground text-center">
                {t('resetPassword.success')} Redirecting to login...
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('resetPassword.newPassword')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('resetPassword.updating') : t('resetPassword.update')}
                </Button>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-primary hover:underline">
                    {t('forgotPassword.backToLogin')}
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
