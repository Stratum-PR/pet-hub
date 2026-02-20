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
      setHasExistingPin(!!data?.kiosk_manager_pin);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to check existing PIN:', err);
      }
    }
  };

  const handleSave = async () => {
    if (!businessId) return;

    setError(null);

    // Validate new PIN
    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PINs do not match');
      return;
    }

    // If there's an existing PIN, require current PIN
    if (hasExistingPin) {
      if (currentPin.length !== 4) {
        setError('Please enter your current PIN');
        return;
      }

      // Verify current PIN
      const { data: business, error: bizErr } = await supabase
        .from('businesses')
        .select('kiosk_manager_pin')
        .eq('id', businessId)
        .single();

      if (bizErr) {
        setError('Failed to verify current PIN');
        return;
      }

      // Simple comparison (in production, should use hashed PINs)
      if (business?.kiosk_manager_pin !== currentPin) {
        setError('Current PIN is incorrect');
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

      toast.success('Manager PIN updated successfully');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setHasExistingPin(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update PIN');
      toast.error('Failed to update manager PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Kiosk Manager PIN
        </CardTitle>
        <CardDescription>
          Set or change the PIN used to exit kiosk mode and access the main app. This PIN is separate from employee PINs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasExistingPin && (
          <div className="space-y-2">
            <Label htmlFor="current-pin">Current PIN</Label>
            <div className="relative">
              <Input
                id="current-pin"
                type={showCurrentPin ? 'text' : 'password'}
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter current PIN"
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
          <Label htmlFor="new-pin">New PIN (4 digits)</Label>
          <div className="relative">
            <Input
              id="new-pin"
              type={showNewPin ? 'text' : 'password'}
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter new PIN"
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
          <Label htmlFor="confirm-pin">Confirm New PIN</Label>
          <div className="relative">
            <Input
              id="confirm-pin"
              type={showConfirmPin ? 'text' : 'password'}
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm new PIN"
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
          disabled={saving || newPin.length !== 4 || confirmPin.length !== 4 || newPin !== confirmPin || (hasExistingPin && currentPin.length !== 4)}
          className="w-full"
        >
          {saving ? 'Saving...' : hasExistingPin ? 'Change PIN' : 'Set PIN'}
        </Button>

        {hasExistingPin && (
          <p className="text-xs text-muted-foreground text-center">
            If you forget your PIN, you can reset it from the database or contact support.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

