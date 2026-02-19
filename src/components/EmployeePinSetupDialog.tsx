/**
 * Employee PIN Setup Dialog
 * Allows employees to set their own PIN
 */

import { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePinInput = (digit: string, field: 'pin' | 'confirmPin') => {
    const value = field === 'pin' ? pin : confirmPin;
    if (value.length < 4) {
      if (field === 'pin') {
        setPin(value + digit);
      } else {
        setConfirmPin(value + digit);
      }
      setError(null);
    }
  };

  const handleBackspace = (field: 'pin' | 'confirmPin') => {
    if (field === 'pin') {
      setPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
    setError(null);
  };

  const handleClear = (field: 'pin' | 'confirmPin') => {
    if (field === 'pin') {
      setPin('');
    } else {
      setConfirmPin('');
    }
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    // Check if PIN is already in use by another employee
    if (businessId) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('business_id', businessId)
        .eq('pin', pin)
        .neq('id', employeeId)
        .single();

      if (existing) {
        setError('This PIN is already in use. Please choose another.');
        return;
      }
    }

    setLoading(true);

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
        setLoading(false);
        return;
      }

      onSuccess?.();
      onOpenChange(false);
      setPin('');
      setConfirmPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set PIN');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Set Your PIN
          </DialogTitle>
          <DialogDescription>
            {employeeName}, please set a 4-digit PIN for clocking in and out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* PIN Input */}
          <div className="space-y-2">
            <Label>Enter 4-Digit PIN</Label>
            <div className="flex justify-center mb-2">
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
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button
                  key={num}
                  size="sm"
                  variant="outline"
                  onClick={() => handlePinInput(num.toString(), 'pin')}
                  disabled={loading}
                >
                  {num}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleClear('pin')}
                disabled={loading}
              >
                Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePinInput('0', 'pin')}
                disabled={loading}
              >
                0
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBackspace('pin')}
                disabled={loading}
              >
                ←
              </Button>
            </div>
          </div>

          {/* Confirm PIN Input */}
          <div className="space-y-2">
            <Label>Confirm PIN</Label>
            <div className="flex justify-center mb-2">
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold ${
                      i < confirmPin.length
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    }`}
                  >
                    {i < confirmPin.length ? '•' : ''}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button
                  key={num}
                  size="sm"
                  variant="outline"
                  onClick={() => handlePinInput(num.toString(), 'confirmPin')}
                  disabled={loading}
                >
                  {num}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleClear('confirmPin')}
                disabled={loading}
              >
                Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePinInput('0', 'confirmPin')}
                disabled={loading}
              >
                0
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBackspace('confirmPin')}
                disabled={loading}
              >
                ←
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || pin.length !== 4 || confirmPin.length !== 4 || pin !== confirmPin}
          >
            {loading ? 'Setting PIN...' : 'Set PIN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

