/**
 * Time Kiosk Page
 * Full-screen kiosk interface for employee clock in/out
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogIn, LogOut, User, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTimeKiosk } from '@/hooks/useTimeKiosk';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ScheduleCheckWarning } from '@/components/ScheduleCheckWarning';
import { KioskManagerAccess } from '@/components/KioskManagerAccess';
import { format, differenceInSeconds } from 'date-fns';
import { t } from '@/lib/translations';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import type { TimeEntry } from '@/types';

type KioskState = 'pin_entry' | 'employee_verified' | 'clocking' | 'success' | 'error' | 'off_schedule_warning';

export function TimeKiosk() {
  const navigate = useNavigate();
  const businessId = useBusinessId();
  const { clockInOut, getEmployeeByPin, loading, error } = useTimeKiosk();
  const { getCurrentLocation } = useGeolocation();
  const [pin, setPin] = useState('');
  const [state, setState] = useState<KioskState>('pin_entry');
  const [employee, setEmployee] = useState<any>(null);
  const [clockResult, setClockResult] = useState<any>(null);
  const [showManagerAccess, setShowManagerAccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(null);
  const [clockedInDuration, setClockedInDuration] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  // Auto-reset to PIN entry after success
  useEffect(() => {
    if (state === 'success') {
      const timer = setTimeout(() => {
        resetToPinEntry();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  // Update clocked-in duration timer in real-time
  useEffect(() => {
    if (!activeTimeEntry || state !== 'employee_verified') {
      setClockedInDuration(null);
      return;
    }

    const updateDuration = () => {
      const now = new Date();
      const clockInTime = new Date(activeTimeEntry.clock_in);
      const totalSeconds = differenceInSeconds(now, clockInTime);
      
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      setClockedInDuration({ hours, minutes, seconds });
    };

    // Update immediately
    updateDuration();

    // Update every second
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [activeTimeEntry, state]);

  const resetToPinEntry = useCallback(() => {
    setPin('');
    setState('pin_entry');
    setEmployee(null);
    setClockResult(null);
    setErrorMessage(null);
    setActiveTimeEntry(null);
    setClockedInDuration(null);
  }, []);

  const handlePinInput = useCallback((digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      
      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        handleVerifyPin(newPin);
      }
    }
  }, [pin]);

  const handleVerifyPin = useCallback(async (pinToVerify?: string) => {
    const pinToCheck = pinToVerify || pin;
    if (pinToCheck.length !== 4) return;

    setErrorMessage(null);
    
    // Check for manager PIN (special PIN like "9999" or check against business)
    // For now, we'll use a simple check - can be enhanced
    if (pinToCheck === '9999') {
      setShowManagerAccess(true);
      setPin('');
      return;
    }

    const emp = await getEmployeeByPin(pinToCheck);
    if (emp) {
      setEmployee(emp);
      
      // Check if employee has an active time entry (clocked in)
      if (businessId) {
        try {
          const { data: activeEntry } = await supabase
            .from('time_entries')
            .select('*')
            .eq('employee_id', emp.id)
            .eq('business_id', businessId)
            .is('clock_out', null)
            .eq('status', 'active')
            .order('clock_in', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (activeEntry) {
            setActiveTimeEntry(activeEntry as TimeEntry);
          } else {
            setActiveTimeEntry(null);
          }
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('Failed to fetch active time entry:', err);
          }
          setActiveTimeEntry(null);
        }
      }
      
      setState('employee_verified');
      setPin('');
    } else {
      setErrorMessage('Invalid PIN. Please try again.');
      setState('error');
      setTimeout(() => {
        resetToPinEntry();
      }, 2000);
    }
  }, [pin, getEmployeeByPin, resetToPinEntry, businessId]);

  const handleClockAction = useCallback(async () => {
    if (!employee) return;

    setState('clocking');
    setErrorMessage(null);

    try {
      // Get geolocation
      let location;
      try {
        location = await getCurrentLocation();
      } catch (geoErr) {
        // Continue without geolocation
        if (import.meta.env.DEV) {
          console.warn('Geolocation not available:', geoErr);
        }
      }

      const result = await clockInOut(employee.pin, location);
      
      if (result?.success) {
        setClockResult(result);
        
        // Clear active time entry if clocking out
        if (result.action === 'clock_out') {
          setActiveTimeEntry(null);
          setClockedInDuration(null);
        }
        
        // Check if off-schedule warning
        if (result.warning === 'off_schedule' || result.is_off_schedule) {
          setState('off_schedule_warning');
        } else {
          setState('success');
        }
      } else {
        // Handle geofencing errors specifically
        if (result?.error === 'outside_geofence' || result?.error === 'employee_location_required') {
          setErrorMessage(result?.message || 'You must be at the store location to clock in');
        } else {
          setErrorMessage(result?.message || result?.error || 'Failed to clock in/out');
        }
        setState('error');
        setTimeout(() => {
          resetToPinEntry();
        }, 5000); // Longer timeout for geofencing errors
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
      setState('error');
      setTimeout(() => {
        resetToPinEntry();
      }, 3000);
    }
  }, [employee, clockInOut, getCurrentLocation, resetToPinEntry]);

  const handleContinueOffSchedule = useCallback(() => {
    setState('success');
  }, []);

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
  }, []);

  // Render based on state
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      {showManagerAccess ? (
        <KioskManagerAccess
          onSuccess={() => navigate('/dashboard')}
          onCancel={() => {
            setShowManagerAccess(false);
            resetToPinEntry();
          }}
        />
      ) : (
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Clock className="w-12 h-12 text-primary" />
              <h1 className="text-4xl font-bold">Time Clock</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              {state === 'pin_entry' && 'Enter your PIN to clock in or out'}
              {state === 'employee_verified' && `Welcome, ${employee?.name}`}
              {state === 'clocking' && 'Processing...'}
              {state === 'success' && `${clockResult?.action === 'clock_in' ? 'Clocked In' : 'Clocked Out'} Successfully!`}
            </p>
          </div>

          {/* Main Content */}
          <Card className="shadow-lg">
            <CardContent className="p-8">
              {state === 'pin_entry' && (
                <div className="space-y-6">
                  {/* PIN Display */}
                  <div className="flex justify-center">
                    <div className="flex gap-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${
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
                  {errorMessage && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  )}

                  {/* Numeric Keypad */}
                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <Button
                        key={num}
                        size="lg"
                        variant="outline"
                        className="h-20 text-2xl font-bold"
                        onClick={() => handlePinInput(num.toString())}
                      >
                        {num}
                      </Button>
                    ))}
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-20 text-xl"
                      onClick={handleClear}
                    >
                      Clear
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-20 text-2xl font-bold"
                      onClick={() => handlePinInput('0')}
                    >
                      0
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-20 text-xl"
                      onClick={handleBackspace}
                    >
                      ←
                    </Button>
                  </div>

                  {/* Manager Access Hint */}
                  <div className="text-center text-sm text-muted-foreground mt-4">
                    Managers: Enter manager PIN to access admin
                  </div>
                </div>
              )}

              {state === 'employee_verified' && employee && (
                <div className="space-y-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <User className="w-16 h-16 text-primary" />
                    <div>
                      <h2 className="text-3xl font-bold">{employee.name}</h2>
                      <p className="text-muted-foreground">{employee.role}</p>
                    </div>
                  </div>

                  {/* Show clocked-in duration if employee is clocked in */}
                  {activeTimeEntry && clockedInDuration && (
                    <div className="bg-primary/10 border-2 border-primary rounded-lg p-6 mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Currently clocked in since</p>
                      <p className="text-lg font-semibold mb-4">
                        {format(new Date(activeTimeEntry.clock_in), 'h:mm a')}
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-6 h-6 text-primary" />
                        <div className="text-4xl font-bold text-primary tabular-nums">
                          {String(clockedInDuration.hours).padStart(2, '0')}:
                          {String(clockedInDuration.minutes).padStart(2, '0')}:
                          {String(clockedInDuration.seconds).padStart(2, '0')}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {clockedInDuration.hours > 0 && `${clockedInDuration.hours} hour${clockedInDuration.hours !== 1 ? 's' : ''}, `}
                        {clockedInDuration.minutes} minute{clockedInDuration.minutes !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 justify-center">
                    <Button
                      size="lg"
                      className="h-20 px-8 text-xl"
                      onClick={handleClockAction}
                      disabled={loading}
                    >
                      {loading ? (
                        'Processing...'
                      ) : (
                        <>
                          {activeTimeEntry ? (
                            <LogOut className="w-6 h-6 mr-2" />
                          ) : (
                            <LogIn className="w-6 h-6 mr-2" />
                          )}
                          {activeTimeEntry ? 'Clock Out' : 'Clock In'}
                        </>
                      )}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-20 px-8 text-xl"
                      onClick={resetToPinEntry}
                    >
                      <X className="w-6 h-6 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {state === 'clocking' && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-xl text-muted-foreground">Processing...</p>
                </div>
              )}

              {state === 'off_schedule_warning' && clockResult && (
                <ScheduleCheckWarning
                  scheduleInfo={clockResult.schedule_info}
                  onContinue={handleContinueOffSchedule}
                  onCancel={resetToPinEntry}
                />
              )}

              {state === 'success' && clockResult && (
                <div className="text-center space-y-6 py-8">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    {clockResult.action === 'clock_in' ? (
                      <LogIn className="w-16 h-16 text-green-500" />
                    ) : (
                      <LogOut className="w-16 h-16 text-blue-500" />
                    )}
                  </div>
                  <h2 className="text-3xl font-bold">
                    {clockResult.action === 'clock_in' ? 'Clocked In' : 'Clocked Out'}
                  </h2>
                  <p className="text-xl text-muted-foreground">
                    {format(new Date(clockResult.clock_in || clockResult.clock_out), 'h:mm a')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Returning to PIN entry in 3 seconds...
                  </p>
                </div>
              )}

              {state === 'error' && errorMessage && (
                <div className="text-center space-y-4 py-8">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-lg">{errorMessage}</AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

