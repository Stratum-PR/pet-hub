import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CreditCard, ExternalLink, FlaskConical, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { callPayments, paymentErrorText, type AthMode, type PaymentSettings } from '@/lib/payments';

const MODES: AthMode[] = ['off', 'simulator', 'live'];

/** Settings → Pagos: turn ATH Móvil on (test or real) and, later, connect Stripe. */
export function PaymentsSettingsPage() {
  useLanguage();
  const slug = useResolvedBusinessSlug();
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<AthMode>('off');
  const [publicToken, setPublicToken] = useState('');
  const [privateToken, setPrivateToken] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await callPayments<PaymentSettings>('settings_get');
    if (error || !data) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    setSettings(data);
    setMode(data.athmovil.mode);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = settings?.athmovil.mode ?? 'off';
  const canEdit = !!settings?.canEdit;
  const dirty = mode !== current || (mode === 'live' && (publicToken !== '' || privateToken !== ''));

  const save = async () => {
    if (mode === 'live' && current !== 'live' && (!publicToken.trim() || !privateToken.trim())) {
      toast.error(t('payments.settings.keysRequired'));
      return;
    }
    setSaving(true);
    const { data, error } = await callPayments<{ ok: boolean; error?: string }>('settings_save_ath', {
      mode,
      publicToken: publicToken.trim() || undefined,
      privateToken: privateToken.trim() || undefined,
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast.error(paymentErrorText(error ?? data?.error));
      return;
    }
    setPublicToken('');
    setPrivateToken('');
    toast.success(t('payments.settings.saved'));
    await load();
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-2">
        <p className="text-sm text-muted-foreground">{t('payments.settings.loadError')}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          {t('apptBook.retry')}
        </Button>
      </div>
    );
  }
  if (!settings) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> ATH Móvil
            {current === 'live' ? (
              <Badge className="ml-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-200">
                {t('payments.settings.statusLive')}
              </Badge>
            ) : current === 'simulator' ? (
              <Badge className="ml-1 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100">
                {t('payments.settings.statusTest')}
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-1">
                {t('payments.settings.statusOff')}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{t('payments.settings.athDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="ATH Móvil">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                disabled={!canEdit || (m === 'simulator' && settings.simulatorAllowed === false && current !== 'simulator')}
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  mode === m ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {m === 'simulator' ? <FlaskConical className="h-4 w-4" /> : null}
                  {t(`payments.settings.mode.${m}`)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t(`payments.settings.modeHint.${m}`)}</span>
              </button>
            ))}
          </div>

          {mode === 'simulator' ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p>{t('payments.settings.simulatorExplain')}</p>
              <p className="mt-1.5 text-xs">{t('payments.settings.simulatorNotRevenue')}</p>
              {current === 'simulator' && slug ? (
                <Button variant="outline" size="sm" className="mt-2 gap-1.5" asChild>
                  <Link to={`/${slug}/ath-simulador`} target="_blank">
                    <ExternalLink className="h-4 w-4" /> {t('payments.sim.openPhone')}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}

          {mode === 'live' ? (
            <div className="space-y-3">
              {current === 'live' && settings.athmovil.last4 ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {t('payments.settings.keysOnFile', { last4: settings.athmovil.last4 })}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">{t('payments.settings.whereKeys')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ath-public">{t('payments.settings.publicToken')}</Label>
                  <Input
                    id="ath-public"
                    value={publicToken}
                    onChange={(e) => setPublicToken(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ath-private">{t('payments.settings.privateToken')}</Label>
                  <Input
                    id="ath-private"
                    type="password"
                    value={privateToken}
                    onChange={(e) => setPrivateToken(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('payments.settings.keysPrivacy')}</p>
            </div>
          ) : null}

          {canEdit ? (
            <Button onClick={() => void save()} disabled={saving || !dirty}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('common.save')}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t('groomerSettings.readOnly')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> {t('payments.settings.cardTitle')}
            <Badge variant="secondary" className="ml-1">
              {t('payments.settings.comingSoon')}
            </Badge>
          </CardTitle>
          <CardDescription>{t('payments.settings.cardDescription')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
