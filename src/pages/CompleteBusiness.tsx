import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute } from '@/lib/authRouting';
import { getRedirectForAuthenticatedUser } from '@/lib/authRedirect';
import { debugIngest } from '@/lib/debugIngest';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

/**
 * Shown when a user is signed in but has no business_id (e.g. legacy OAuth account).
 * They must enter a business name to create a business and become a manager.
 */
export function CompleteBusiness() {
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, business, loading: authLoading, refreshAuth } = useAuth();
  const { language } = useLanguage();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (business?.name) {
      const destination = getDefaultRoute({ isAdmin: false, business });
      navigate(destination, { replace: true });
    }
  }, [user, business, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = businessName.trim();
    if (!trimmed) {
      toast.error('Business name is required.');
      return;
    }
    setLoading(true);
    // #region agent log
    debugIngest({ location: 'CompleteBusiness.tsx:handleSubmit', message: 'before RPC complete_manager_signup', data: { businessName: trimmed }, hypothesisId: 'complete-business' });
    // #endregion
    try {
      const { error } = await supabase.rpc('complete_manager_signup', { p_business_name: trimmed });
      // #region agent log
      debugIngest({ location: 'CompleteBusiness.tsx:handleSubmit', message: 'after RPC', data: { error: error?.message ?? null }, hypothesisId: 'complete-business' });
      // #endregion
      if (error) {
        toast.error(error.message || 'Could not create business.');
        return;
      }
      await refreshAuth();
      // #region agent log
      debugIngest({ location: 'CompleteBusiness.tsx:handleSubmit', message: 'after refreshAuth', data: { businessId: business?.id ?? null, businessName: business?.name ?? null }, hypothesisId: 'complete-business' });
      // #endregion
      const destination = await getRedirectForAuthenticatedUser();
      // #region agent log
      debugIngest({ location: 'CompleteBusiness.tsx:handleSubmit', message: 'navigating after complete-business', data: { destination }, hypothesisId: 'complete-business' });
      // #endregion
      navigate(destination, { replace: true });
    } catch (err) {
      console.error('[CompleteBusiness] error', err);
      toast.error(err instanceof Error ? err.message : 'Could not create business.');
      // #region agent log
      debugIngest({ location: 'CompleteBusiness.tsx:handleSubmit', message: 'handleSubmit threw', data: { err: (err as Error)?.message }, hypothesisId: 'complete-business' });
      // #endregion
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user || business?.name) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
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
              className="flex justify-center mb-4 cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
              onClick={() => navigate('/')}
            >
              <img src="/stratum hub logo.svg" alt="Stratum Hub" className="h-12" />
            </div>
            <CardTitle className="text-2xl">Complete your account</CardTitle>
            <CardDescription>
              Your account needs a business name to access the app. Enter your business name below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="complete-business-name">{t('signupManager.businessName')}</Label>
                <Input
                  id="complete-business-name"
                  type="text"
                  placeholder="My Grooming Salon"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  autoComplete="organization"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating…' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
