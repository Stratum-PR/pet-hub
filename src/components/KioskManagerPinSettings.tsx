/**
 * Kiosk Manager PIN Settings Component
 * Allows managers to set/change their kiosk manager PIN
 */

import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { KioskManagerPinResetDialog, useCanResetKioskManagerPin } from '@/components/KioskManagerPinResetDialog';
import { KIOSK_MANAGER_PIN_LENGTH } from '@/lib/pinLengths';
import {
  fetchEmployeePinsForBusiness,
  managerPinPrefixCollidesWithEmployeePins,
} from '@/lib/employeePin';

export function KioskManagerPinSettings() {
  const businessId = useBusinessId();
  const [currentPin, setCurrentPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [pinResetOpen, setPinResetOpen] = useState(false);
  const canResetWithPassword = useCanResetKioskManagerPin();

  useEffect(() => {
    if (!businessId) return;
    checkExistingPin();
  }, [businessId]);

  const checkExistingPin = async () => {
    if (!businessId) return;
    try {
      const { data, error: err } = await supabase
        .from('businesses')
        .select('kiosk_manager_pin')
        .eq('id', businessId)
        .single();

      if (err) throw err;
      const stored = data?.kiosk_manager_pin;
      // Only a full 6-digit PIN counts as "existing": no PIN or legacy shorter values use first-time flow (no current PIN).
      setHasExistingPin(
        typeof stored === 'string' && stored.length === KIOSK_MANAGER_PIN_LENGTH
      );
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to check existing PIN:', err);
      }
    }
  };

  const handleSave = async () => {
    if (!businessId) return;

    setError(null);

    // Validate new manager PIN (6 digits; employee PINs stay 4 elsewhere)
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

    // If there's an existing PIN, require current PIN
    if (hasExistingPin) {
      if (!currentPin) {
        setError(t('kioskManagerPinSettings.errors.enterCurrentPin'));
        return;
      }

      // Verify current PIN
      const { data: business, error: bizErr } = await supabase
        .from('businesses')
        .select('kiosk_manager_pin')
        .eq('id', businessId)
        .single();

      if (bizErr) {
        setError(t('kioskManagerPinSettings.errors.failedVerifyCurrentPin'));
        return;
      }

      // Simple comparison (in production, should use hashed PINs)
      if (business?.kiosk_manager_pin !== currentPin) {
        setError(t('kioskManagerPinSettings.errors.currentPinIncorrect'));
        return;
      }
    }

    setSaving(true);

    try {
      const { error: err } = await supabase
        .from('businesses')
        .update({
          kiosk_manager_pin: newPin, // In production, hash this
        })
        .eq('id', businessId);

      if (err) throw err;

      toast.success(t('kioskManagerPinSettings.toast.updated'));
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setHasExistingPin(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('kioskManagerPinSettings.toast.failedUpdate'));
      toast.error(t('kioskManagerPinSettings.toast.failedUpdate'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          {t('kioskManagerPinSettings.title')}
        </CardTitle>
        <CardDescription>
          {t('kioskManagerPinSettings.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasExistingPin && (
          <div className="space-y-2">
            <Label htmlFor="current-pin">{t('kioskManagerPinSettings.currentPin')}</Label>
            <div className="relative">
              <Input
                id="current-pin"
                type={showCurrentPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={KIOSK_MANAGER_PIN_LENGTH}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder={t('kioskManagerPinSettings.enterCurrentPin')}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-10"
                onClick={() => setShowCurrentPin(!showCurrentPin)}
              >
                {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="new-pin">{t('kioskManagerPinSettings.newPin')}</Label>
          <div className="relative">
            <Input
              id="new-pin"
              type={showNewPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={KIOSK_MANAGER_PIN_LENGTH}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder={t('kioskManagerPinSettings.enterNewPin')}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full w-10"
              onClick={() => setShowNewPin(!showNewPin)}
            >
              {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-pin">{t('kioskManagerPinSettings.confirmNewPin')}</Label>
          <div className="relative">
            <Input
              id="confirm-pin"
              type={showConfirmPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={KIOSK_MANAGER_PIN_LENGTH}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder={t('kioskManagerPinSettings.confirmNewPinHint')}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full w-10"
              onClick={() => setShowConfirmPin(!showConfirmPin)}
            >
              {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleSave}
          disabled={
            saving ||
            newPin.length !== KIOSK_MANAGER_PIN_LENGTH ||
            confirmPin.length !== KIOSK_MANAGER_PIN_LENGTH ||
            newPin !== confirmPin ||
            (hasExistingPin && !currentPin)
          }
          className="w-full"
        >
          {saving ? t('kioskManagerPinSettings.save') : hasExistingPin ? t('kioskManagerPinSettings.changePin') : t('kioskManagerPinSettings.setPin')}
        </Button>

        {hasExistingPin && canResetWithPassword ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">{t('kioskManagerPinSettings.forgetHint')}</p>
            <Button type="button" variant="outline" className="w-full" onClick={() => setPinResetOpen(true)}>
              {t('kioskManagerPinReset.openFromSettings')}
            </Button>
            <KioskManagerPinResetDialog
              open={pinResetOpen}
              onOpenChange={setPinResetOpen}
              businessId={businessId}
              onSuccess={async () => {
                await checkExistingPin();
              }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

