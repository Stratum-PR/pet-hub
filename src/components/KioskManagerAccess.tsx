/**
 * Kiosk Manager Access Component
 * Manager PIN entry modal to exit kiosk mode
 */

import { useState, useCallback } from 'react';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';

interface KioskManagerAccessProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function KioskManagerAccess({ onSuccess, onCancel }: KioskManagerAccessProps) {
  const businessId = useBusinessId();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePinInput = useCallback((digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
      setError(null);
    }
  }, [pin]);

  const handleVerify = useCallback(async () => {
    if (pin.length !== 4 || !businessId) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get business and check manager PIN
      // For now, we'll do a simple comparison
      // In production, this should use hashed PINs
      const { data: business, error: err } = await supabase
        .from('businesses')
        .select('kiosk_manager_pin')
        .eq('id', businessId)
        .single();

      if (err || !business) {
        setError('Business not found');
        setLoading(false);
        return;
      }

      // Simple PIN comparison (should be hashed in production)
      // For now, if kiosk_manager_pin is not set, we'll allow any PIN for setup
      if (business.kiosk_manager_pin) {
        if (business.kiosk_manager_pin !== pin) {
          setError('Invalid manager PIN');
          setLoading(false);
          return;
        }
      } else {
        // First time setup - set the PIN
        await supabase
          .from('businesses')
          .update({ kiosk_manager_pin: pin })
          .eq('id', businessId);
      }

      // Success - redirect to main app
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify PIN');
      setLoading(false);
    }
  }, [pin, businessId, onSuccess]);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Manager Access</CardTitle>
                <CardDescription>Enter manager PIN to exit kiosk mode</CardDescription>
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
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleVerify}
              disabled={loading || pin.length !== 4}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

