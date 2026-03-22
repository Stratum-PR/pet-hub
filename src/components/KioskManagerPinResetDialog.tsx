/**
 * Reset kiosk manager PIN after re-authenticating with the account password (step-up).
 * Use from punch clock (kiosk locked) or business settings.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { KIOSK_MANAGER_PIN_LENGTH } from '@/lib/pinLengths';
import {
  fetchEmployeePinsForBusiness,
  managerPinPrefixCollidesWithEmployeePins,
} from '@/lib/employeePin';

export type KioskManagerPinResetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string | null;
  /** Called after PIN is saved successfully (e.g. unlock kiosk + navigate). */
  onSuccess?: () => void | Promise<void>;
};

export function KioskManagerPinResetDialog({
  open,
  onOpenChange,
  businessId,
  onSuccess,
}: KioskManagerPinResetDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'password' | 'newPin'>('password');
  const [accountPassword, setAccountPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('password');
      setAccountPassword('');
      setNewPin('');
      setConfirmPin('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const verifyPassword = useCallback(async () => {
    setError(null);
    const email = user?.email?.trim();
    if (!email) {
      setError(t('kioskManagerPinReset.errors.noEmail'));
      return;
    }
    if (!accountPassword) {
      setError(t('kioskManagerPinReset.errors.enterPassword'));
      return;
    }
    setBusy(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: accountPassword,
      });
      if (signErr) {
        setError(t('kioskManagerPinReset.errors.invalidPassword'));
        return;
      }
      setAccountPassword('');
      setStep('newPin');
    } finally {
      setBusy(false);
    }
  }, [user?.email, accountPassword]);

  const saveNewPin = useCallback(async () => {
    setError(null);
    if (!businessId) {
      setError(t('kioskManagerPinReset.errors.noBusiness'));
      return;
    }
    if (newPin.length !== KIOSK_MANAGER_PIN_LENGTH) {
      setError(t('kioskManagerPinSettings.errors.pin6Digits'));
      return;
    }
    if (newPin !== confirmPin) {
      setError(t('kioskManagerPinSettings.errors.pinsDontMatch'));
      return;
    }
    try {
      const employeePins = await fetchEmployeePinsForBusiness(supabase, businessId);
      if (managerPinPrefixCollidesWithEmployeePins(newPin, employeePins)) {
        setError(t('kioskManagerPinSettings.errors.prefixMatchesEmployee'));
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('kioskManagerPinSettings.toast.failedUpdate'));
      return;
    }
    setBusy(true);
    try {
      const { error: upErr } = await supabase
        .from('businesses')
        .update({ kiosk_manager_pin: newPin })
        .eq('id', businessId);
      if (upErr) throw upErr;
      toast.success(t('kioskManagerPinReset.successToast'));
      onOpenChange(false);
      await onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('kioskManagerPinSettings.toast.failedUpdate'));
    } finally {
      setBusy(false);
    }
  }, [businessId, newPin, confirmPin, onOpenChange, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('kioskManagerPinReset.title')}</DialogTitle>
          <DialogDescription>
            {step === 'password'
              ? t('kioskManagerPinReset.stepPasswordDescription')
              : t('kioskManagerPinReset.stepPinDescription')}
          </DialogDescription>
        </DialogHeader>

        {step === 'password' ? (
          <div className="space-y-4 py-2">
            {user?.email ? (
              <p className="text-sm text-muted-foreground break-all">
                {t('kioskManagerPinReset.signedInAs', { email: user.email })}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="kiosk-reset-account-password">{t('kioskManagerPinReset.accountPassword')}</Label>
              <Input
                id="kiosk-reset-account-password"
                type="password"
                autoComplete="current-password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && verifyPassword()}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="kiosk-reset-new-pin">{t('kioskManagerPinSettings.newPin')}</Label>
              <Input
                id="kiosk-reset-new-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={KIOSK_MANAGER_PIN_LENGTH}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kiosk-reset-confirm-pin">{t('kioskManagerPinSettings.confirmNewPin')}</Label>
              <Input
                id="kiosk-reset-confirm-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={KIOSK_MANAGER_PIN_LENGTH}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && !busy && saveNewPin()}
              />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'newPin' ? (
            <Button type="button" variant="outline" onClick={() => setStep('password')} disabled={busy}>
              {t('kioskManagerPinReset.back')}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('kioskManager.cancel')}
          </Button>
          {step === 'password' ? (
            <Button type="button" onClick={verifyPassword} disabled={busy}>
              {busy ? t('kioskManagerPinReset.verifyingAccount') : t('kioskManagerPinReset.verifyAccount')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={saveNewPin}
              disabled={
                busy ||
                newPin.length !== KIOSK_MANAGER_PIN_LENGTH ||
                confirmPin.length !== KIOSK_MANAGER_PIN_LENGTH ||
                newPin !== confirmPin
              }
            >
              {busy ? t('kioskManagerPinSettings.save') : t('kioskManagerPinReset.saveNewPin')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Managers / super admins with a password-capable session can reset the kiosk PIN. */
export function useCanResetKioskManagerPin(): boolean {
  const { user, role, isAdmin } = useAuth();
  const email = Boolean(user?.email);
  const allowedRole = role === 'manager' || role === 'super_admin' || isAdmin;
  return email && allowedRole;
}
