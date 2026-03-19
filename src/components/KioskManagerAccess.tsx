/**
 * Kiosk Manager Access Component
 * Manager PIN entry modal to exit kiosk mode
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { t } from '@/lib/translations';

interface KioskManagerAccessProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function KioskManagerAccess({ onSuccess, onCancel }: KioskManagerAccessProps) {
  const businessId = useBusinessId();
  const pinInputRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Focus hidden input on mount so the first numpad key is never lost (browser delivers it to focused element).
  useEffect(() => {
    const t = setTimeout(() => pinInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const handlePinInput = useCallback((digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
      setError(null);
    }
  }, [pin]);

  const handleVerify = useCallback(async (pinToUse?: string) => {
    const value = pinToUse ?? pin;
    if (value.length !== 4 || !businessId) {
      setError(t('kioskManager.verify4DigitPin'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: business, error: err } = await supabase
        .from('businesses')
        .select('kiosk_manager_pin')
        .eq('id', businessId)
        .single();

      if (err || !business) {
        setError(t('kioskManager.businessNotFound'));
        setLoading(false);
        return;
      }

      if (business.kiosk_manager_pin) {
        if (business.kiosk_manager_pin !== value) {
          setError(t('kioskManager.invalidPin'));
          setLoading(false);
          return;
        }
      } else {
        await supabase
          .from('businesses')
          .update({ kiosk_manager_pin: value })
          .eq('id', businessId);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('kioskManager.failedVerifyPin'));
      setLoading(false);
    }
  }, [pin, businessId, onSuccess, t]);

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setError(null);
  }, []);

  // Auto-submit when 4 digits entered
  const handleAutoSubmit = useCallback(() => {
    if (pin.length === 4) {
      handleVerify();
    }
  }, [pin, handleVerify]);

  const getDigit = useCallback((e: React.KeyboardEvent | KeyboardEvent): string | null => {
    if (e.key >= '0' && e.key <= '9') return e.key;
    if (e.key.startsWith('Numpad') && e.key.length === 7) {
      const d = e.key.slice(-1);
      if (d >= '0' && d <= '9') return d;
    }
    const code = 'code' in e ? e.code : (e as KeyboardEvent).code;
    if (code?.startsWith('Numpad') && code.length >= 7) {
      const d = code.slice(-1);
      if (d >= '0' && d <= '9') return d;
    }
    return null;
  }, []);

  const handlePinKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const digit = getDigit(e);
      if (digit !== null) {
        setPin(prev => {
          if (prev.length >= 4) return prev;
          const next = prev + digit;
          if (next.length === 4) setTimeout(() => handleVerify(next), 0);
          return next;
        });
        setError(null);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
        setError(null);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [getDigit, handleVerify]
  );

  // Window listener as fallback when focus leaves the hidden input (e.g. after clicking a button).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target === pinInputRef.current) return;
      if (target?.closest('button') || target?.closest('a')) return;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const digit = getDigit(e);
      if (digit !== null) {
        setPin(prev => {
          if (prev.length >= 4) return prev;
          const next = prev + digit;
          if (next.length === 4) setTimeout(() => handleVerify(next), 0);
          return next;
        });
        setError(null);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
        setError(null);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [getDigit, handleVerify]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-md">
        <input
          ref={pinInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Manager PIN"
          tabIndex={0}
          className="absolute left-0 top-0 w-px h-px opacity-0 overflow-hidden"
          onKeyDown={handlePinKeyDown}
          readOnly
        />
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>{t('kioskManager.accessTitle')}</CardTitle>
                <CardDescription>{t('kioskManager.accessDescription')}</CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PIN Display */}
          <div className="flex justify-center">
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold ${
                    i < pin.length
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30'
                  }`}
                >
                  {i < pin.length ? '•' : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                size="lg"
                variant="outline"
                className="h-16 text-xl font-bold"
                onClick={() => {
                  handlePinInput(num.toString());
                  setTimeout(handleAutoSubmit, 100);
                }}
                disabled={loading}
              >
                {num}
              </Button>
            ))}
            <Button
              size="lg"
              variant="outline"
              className="h-16 text-sm"
              onClick={handleClear}
              disabled={loading}
            >
              Clear
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 text-xl font-bold"
              onClick={() => {
                handlePinInput('0');
                setTimeout(handleAutoSubmit, 100);
              }}
              disabled={loading}
            >
              0
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 text-sm"
              onClick={handleBackspace}
              disabled={loading}
            >
              ←
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={loading}
            >
              {t('kioskManager.cancel')}
            </Button>
            <Button
              className="flex-1"
              onClick={handleVerify}
              disabled={loading || pin.length !== 4}
            >
              {loading ? t('kioskManager.verifying') : t('kioskManager.verify')}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

