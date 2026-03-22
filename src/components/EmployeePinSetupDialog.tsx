/**
 * Employee PIN setup: manager assigns a system-generated unique PIN.
 */

import { useState, useEffect, useCallback } from 'react';
import { Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { EMPLOYEE_PIN_LENGTH } from '@/lib/pinLengths';
import { t } from '@/lib/translations';
import { generateUniqueEmployeePin } from '@/lib/employeePin';

interface EmployeePinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess?: () => void;
}

export function EmployeePinSetupDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSuccess,
}: EmployeePinSetupDialogProps) {
  const businessId = useBusinessId();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingPin, setLoadingPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const regenerate = useCallback(async () => {
    if (!businessId) {
      setError(t('employeePinSetup.generateFailed'));
      return;
    }
    setError(null);
    setLoadingPin(true);
    try {
      const next = await generateUniqueEmployeePin(supabase, businessId, { excludeEmployeeId: employeeId });
      setPin(next);
    } catch {
      setError(t('employeePinSetup.generateFailed'));
      setPin('');
    } finally {
      setLoadingPin(false);
    }
  }, [businessId, employeeId]);

  useEffect(() => {
    if (!open) {
      setPin('');
      setError(null);
      setLoadingPin(false);
      setSaving(false);
      return;
    }
    if (!businessId) return;
    void regenerate();
  }, [open, businessId, regenerate]);

  const handleSubmit = async () => {
    setError(null);
    if (pin.length !== EMPLOYEE_PIN_LENGTH) {
      setError(t('employeePinSetup.generateFailed'));
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          pin,
          pin_set_at: new Date().toISOString(),
          pin_required: false,
        })
        .eq('id', employeeId);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      onSuccess?.();
      onOpenChange(false);
      setPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('employeePinSetup.generateFailed'));
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {t('employeePinSetup.title')}
          </DialogTitle>
          <DialogDescription>{t('employeePinSetup.description', { name: employeeName })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2 justify-center" aria-live="polite">
              {Array.from({ length: EMPLOYEE_PIN_LENGTH }, (_, i) => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold tabular-nums ${
                    i < pin.length ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                  }`}
                >
                  {loadingPin ? '' : pin[i] ?? ''}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void regenerate()} disabled={loadingPin || saving}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingPin ? 'animate-spin' : ''}`} />
              {t('employeePinSetup.generateAnother')}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('timeKiosk.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || loadingPin || pin.length !== EMPLOYEE_PIN_LENGTH}>
            {saving ? t('employeePinSetup.saving') : t('employeePinSetup.savePin')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
