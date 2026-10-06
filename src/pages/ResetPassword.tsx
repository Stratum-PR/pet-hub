import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { t } from '@/lib/translations';
import { devConsole } from '@/lib/clientDebug';

const MIN_LENGTH = 8;

/**
 * Landing page for the password-reset email link (/reset-password).
 * Supabase exchanges the link's code for a short recovery session on load (detectSessionInUrl),
 * then the user chooses a new password here. No current password needed.
 */
export function ResetPassword() {
  useLanguage(); // re-render on language change
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let settled = false;
    const markReady = () => {
      if (!settled) {
        settled = true;
        setStatus('ready');
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) markReady();
    });
    // The code exchange can finish before this effect runs; also check the current session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });
    // If nothing arrives, the link was opened in another browser, already used, or expired.
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setStatus('invalid');
      }
    }, 6000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      toast.error(t('resetPassword.tooShort'));
      return;
    }
    if (password !== confirm) {
      toast.error(t('accountSettings.passwordMismatch'));
      return;
    }
    setSaving(true);
    const payload: Record<string, string> = {};
    payload['password'] = password;
    const { error } = await supabase.auth.updateUser(payload as Parameters<typeof supabase.auth.updateUser>[0]);
    setSaving(false);
    if (error) {
      devConsole.error('[ResetPassword] updateUser failed', error);
      toast.error(
        /same|different/i.test(error.message) ? t('resetPassword.samePassword') : t('login.errorGeneric')
      );
      return;
    }
    setPassword('');
    setConfirm('');
    setStatus('done');
    // Sign out the recovery session so the next login uses the new password.
    await supabase.auth.signOut().catch(() => {});
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher variant="ghost" size="sm" />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('resetPassword.title')}</CardTitle>
          <CardDescription>
            {status === 'invalid'
              ? t('resetPassword.invalidLink')
              : status === 'done'
                ? t('resetPassword.done')
                : t('resetPassword.hint')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'checking' && <p className="text-sm text-muted-foreground">{t('resetPassword.checking')}</p>}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('resetPassword.newPassword')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_LENGTH}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('resetPassword.confirmPassword')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={MIN_LENGTH}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? t('resetPassword.saving') : t('resetPassword.save')}
              </Button>
            </form>
          )}

          {(status === 'invalid' || status === 'done') && (
            <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
              {t('resetPassword.goToLogin')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ResetPassword;
