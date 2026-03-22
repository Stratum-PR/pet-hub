/**
 * Time Kiosk Page
 * Full-screen kiosk interface for employee clock in/out
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, LogIn, LogOut, User, AlertTriangle, X, Lock, Settings, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTimeKiosk } from '@/hooks/useTimeKiosk';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ScheduleCheckWarning } from '@/components/ScheduleCheckWarning';
import { format, differenceInSeconds } from 'date-fns';
import { t } from '@/lib/translations';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import type { TimeEntry } from '@/types';
import { setKioskLocked } from '@/lib/kioskLock';
import { useTheme } from 'next-themes';
import { EMPLOYEE_PIN_LENGTH, KIOSK_MANAGER_PIN_LENGTH } from '@/lib/pinLengths';
import { KioskManagerPinResetDialog, useCanResetKioskManagerPin } from '@/components/KioskManagerPinResetDialog';
import { useAuth } from '@/contexts/AuthContext';

type KioskState = 'pin_entry' | 'employee_verified' | 'clocking' | 'success' | 'error' | 'off_schedule_warning';

type ManagerPinGate = 'loading' | 'configured' | 'missing';

export function TimeKiosk() {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const businessId = useBusinessId();
  const { clockInOut, getEmployeeByPin, loading, error } = useTimeKiosk();
  const { getCurrentLocation } = useGeolocation();
  const [pin, setPin] = useState('');
  const [state, setState] = useState<KioskState>('pin_entry');
  const [employee, setEmployee] = useState<any>(null);
  const [clockResult, setClockResult] = useState<any>(null);
  const [showManagerChoice, setShowManagerChoice] = useState(false);
  const [managerChoiceEmployee, setManagerChoiceEmployee] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(null);
  const [clockedInDuration, setClockedInDuration] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [businessLogoLightUrl, setBusinessLogoLightUrl] = useState<string | null>(null);
  const [businessLogoDarkUrl, setBusinessLogoDarkUrl] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const pinCaptureInputRef = useRef<HTMLInputElement>(null);
  const [managerPinGate, setManagerPinGate] = useState<ManagerPinGate>('loading');
  const [managerPinResetOpen, setManagerPinResetOpen] = useState(false);
  const canResetKioskManagerPin = useCanResetKioskManagerPin();
  const { loading: authLoading } = useAuth();
  const managerPinGateFetchGen = useRef(0);
  const [businessResolveTimedOut, setBusinessResolveTimedOut] = useState(false);

  // If we never get a business id (slug/profile), stop spinning forever.
  useEffect(() => {
    if (businessId) {
      setBusinessResolveTimedOut(false);
      return;
    }
    const t = window.setTimeout(() => setBusinessResolveTimedOut(true), 8000);
    return () => window.clearTimeout(t);
  }, [businessId]);

  // Require a valid 6-digit kiosk_manager_pin before locking — legacy 4-digit counts as "missing" (upgrade path).
  // Uses a generation counter so React Strict Mode effect cleanup does not leave gate stuck on "loading".
  useEffect(() => {
    if (!businessId) {
      managerPinGateFetchGen.current += 1;
      setManagerPinGate('loading');
      return;
    }

    const gen = ++managerPinGateFetchGen.current;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('kiosk_manager_pin')
          .eq('id', businessId)
          .maybeSingle();

        if (gen !== managerPinGateFetchGen.current) return;

        if (error) {
          if (import.meta.env.DEV) console.warn('TimeKiosk: could not load kiosk_manager_pin', error);
          setManagerPinGate('missing');
          return;
        }
        const pin = data?.kiosk_manager_pin;
        setManagerPinGate(
          typeof pin === 'string' && pin.length === KIOSK_MANAGER_PIN_LENGTH ? 'configured' : 'missing'
        );
      } catch {
        if (gen !== managerPinGateFetchGen.current) return;
        setManagerPinGate('missing');
      }
    })();

    return () => {
      managerPinGateFetchGen.current += 1;
    };
  }, [businessId]);

  useEffect(() => {
    if (managerPinGate !== 'configured') return;
    setKioskLocked(true);
  }, [managerPinGate]);

  useEffect(() => {
    if (managerPinGate !== 'missing') return;
    setKioskLocked(false);
  }, [managerPinGate]);

  // Fetch the current business logo for display on the punch clock screen.
  useEffect(() => {
    if (!businessId) return;

    let isMounted = true;
    (async () => {
      // Prefer light/dark logo stored in `public.settings` (single-row-per-business).
      let light: string | null = null;
      let dark: string | null = null;
      let legacy: string | null = null;
      try {
        const { data: settingsRow } = await supabase
          .from('settings')
          .select('business_logo_url_light, business_logo_url_dark, business_logo_url')
          .eq('business_id', businessId)
          .maybeSingle();
        light = settingsRow?.business_logo_url_light ?? null;
        dark = settingsRow?.business_logo_url_dark ?? null;
        legacy = settingsRow?.business_logo_url ?? null;
      } catch {
        // ignore, fallback below
      }

      // Light falls back to legacy if no light was provided.
      if (!light) light = legacy;

      // If we still have neither light nor dark, fall back to `businesses.logo_url`.
      if (!light && !dark) {
        try {
          const { data: bizRow } = await supabase
            .from('businesses')
            .select('logo_url')
            .eq('id', businessId)
            .maybeSingle();
          light = bizRow?.logo_url ?? null;
        } catch {
          // ignore
        }
      }

      if (!isMounted) return;
      setBusinessLogoLightUrl(light);
      setBusinessLogoDarkUrl(dark);
    })();

    return () => {
      isMounted = false;
    };
  }, [businessId]);

  const selectedBusinessLogoUrl = resolvedTheme === 'dark' ? businessLogoDarkUrl || businessLogoLightUrl : businessLogoLightUrl;

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

  const pinVerifyGen = useRef(0);

  const bumpPinVerification = useCallback(() => {
    pinVerifyGen.current += 1;
  }, []);

  const resetToPinEntry = useCallback(() => {
    bumpPinVerification();
    setPin('');
    setState('pin_entry');
    setEmployee(null);
    setClockResult(null);
    setErrorMessage(null);
    setActiveTimeEntry(null);
    setClockedInDuration(null);
  }, [bumpPinVerification]);

  const setEmployeeAndFetchActiveEntry = useCallback(
    async (emp: any) => {
      setEmployee(emp);
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
          setActiveTimeEntry(activeEntry ? (activeEntry as TimeEntry) : null);
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch active time entry:', err);
          setActiveTimeEntry(null);
        }
      } else {
        setActiveTimeEntry(null);
      }
      setState('employee_verified');
      setPin('');
    },
    [businessId]
  );

  const tryVerifyPin = useCallback(
    async (pinStr: string) => {
      const gen = ++pinVerifyGen.current;
      if (pinStr.length < EMPLOYEE_PIN_LENGTH) return;

      setErrorMessage(null);

      const managerPin = businessId
        ? await supabase
            .from('businesses')
            .select('kiosk_manager_pin')
            .eq('id', businessId)
            .single()
            .then(({ data }) => data?.kiosk_manager_pin ?? null)
        : null;

      if (gen !== pinVerifyGen.current) return;

      const mp = typeof managerPin === 'string' ? managerPin : '';

      if (mp.length !== KIOSK_MANAGER_PIN_LENGTH) {
        if (pinStr.length === EMPLOYEE_PIN_LENGTH) {
          const emp = await getEmployeeByPin(pinStr);
          if (gen !== pinVerifyGen.current) return;
          if (emp) {
            await setEmployeeAndFetchActiveEntry(emp);
            return;
          }
          setErrorMessage(t('timeTracking.invalidPin'));
          setState('error');
          setTimeout(() => resetToPinEntry(), 2000);
        } else if (pinStr.length > EMPLOYEE_PIN_LENGTH) {
          if (gen !== pinVerifyGen.current) return;
          setErrorMessage(t('timeTracking.invalidPin'));
          setState('error');
          setTimeout(() => resetToPinEntry(), 2000);
        }
        return;
      }

      if (pinStr.length === KIOSK_MANAGER_PIN_LENGTH) {
        if (pinStr === mp) {
          const emp = await getEmployeeByPin(pinStr);
          if (gen !== pinVerifyGen.current) return;
          setManagerChoiceEmployee(emp);
          setShowManagerChoice(true);
          setPin('');
          return;
        }
        if (gen !== pinVerifyGen.current) return;
        setErrorMessage(t('timeTracking.invalidPin'));
        setState('error');
        setTimeout(() => resetToPinEntry(), 2000);
        return;
      }

      if (pinStr.length === EMPLOYEE_PIN_LENGTH) {
        const emp = await getEmployeeByPin(pinStr);
        if (gen !== pinVerifyGen.current) return;

        if (emp) {
          await setEmployeeAndFetchActiveEntry(emp);
          return;
        }
        if (mp.startsWith(pinStr)) {
          return;
        }
        setErrorMessage(t('timeTracking.invalidPin'));
        setState('error');
        setTimeout(() => resetToPinEntry(), 2000);
        return;
      }

      if (pinStr.length === 5) {
        if (mp.startsWith(pinStr)) return;
        if (gen !== pinVerifyGen.current) return;
        setErrorMessage(t('timeTracking.invalidPin'));
        setState('error');
        setTimeout(() => resetToPinEntry(), 2000);
      }
    },
    [businessId, getEmployeeByPin, setEmployeeAndFetchActiveEntry, resetToPinEntry, t]
  );

  const handlePinInput = useCallback(
    (digit: string) => {
      setPin(prev => {
        if (prev.length >= KIOSK_MANAGER_PIN_LENGTH) return prev;
        const next = prev + digit;
        if (next.length >= EMPLOYEE_PIN_LENGTH) {
          queueMicrotask(() => {
            void tryVerifyPin(next);
          });
        }
        return next;
      });
    },
    [tryVerifyPin]
  );

  const handleManagerChoiceClockInOut = useCallback(async () => {
    if (!managerChoiceEmployee) return;
    setShowManagerChoice(false);
    await setEmployeeAndFetchActiveEntry(managerChoiceEmployee);
    setManagerChoiceEmployee(null);
  }, [managerChoiceEmployee, setEmployeeAndFetchActiveEntry]);

  const handleManagerChoiceCloseKiosk = useCallback(() => {
    setShowManagerChoice(false);
    setManagerChoiceEmployee(null);
    setKioskLocked(false);
    navigate(businessSlug ? `/${businessSlug}/dashboard` : '/');
  }, [businessSlug, navigate]);

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

        // Ensure payroll/report screens refresh their cached time entries.
        // TimeKiosk uses an RPC that bypasses the `useTimeEntries()` local mutations.
        window.dispatchEvent(new Event('timeentries:refetch'));
        
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
          setErrorMessage(result?.message || t('timeKiosk.geoLocationRequired'));
        } else {
          setErrorMessage(result?.message || result?.error || t('timeKiosk.failedClockInOut'));
        }
        setState('error');
        setTimeout(() => {
          resetToPinEntry();
        }, 5000); // Longer timeout for geofencing errors
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('timeKiosk.errorOccurred'));
      setState('error');
      setTimeout(() => {
        resetToPinEntry();
      }, 3000);
    }
  }, [employee, clockInOut, getCurrentLocation, resetToPinEntry, t]);

  const handleContinueOffSchedule = useCallback(() => {
    setState('success');
  }, []);

  const handleBackspace = useCallback(() => {
    bumpPinVerification();
    setPin(prev => prev.slice(0, -1));
  }, [bumpPinVerification]);

  const handleClear = useCallback(() => {
    bumpPinVerification();
    setPin('');
  }, [bumpPinVerification]);

  const getPinDigitFromKeyboard = useCallback((e: KeyboardEvent | ReactKeyboardEvent): string | null => {
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

  const handlePinCaptureKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      const digit = getPinDigitFromKeyboard(e);
      if (digit !== null) {
        setPin(prev => {
          if (prev.length >= KIOSK_MANAGER_PIN_LENGTH) return prev;
          const next = prev + digit;
          if (next.length >= EMPLOYEE_PIN_LENGTH) {
            queueMicrotask(() => {
              void tryVerifyPin(next);
            });
          }
          return next;
        });
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Backspace') {
        bumpPinVerification();
        setPin(prev => prev.slice(0, -1));
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [getPinDigitFromKeyboard, tryVerifyPin, bumpPinVerification]
  );

  // Focus capture field on PIN screen so the first physical key isn't lost to body/document.
  useEffect(() => {
    if (managerPinGate !== 'configured' || state !== 'pin_entry' || showManagerChoice) return;
    const t = window.setTimeout(() => pinCaptureInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [managerPinGate, state, showManagerChoice]);

  // Keyboard/numpad PIN entry: digits/backspace work even when focus is on keypad buttons (they stay focused after tap).
  useEffect(() => {
    if (managerPinGate !== 'configured' || state !== 'pin_entry' || showManagerChoice) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target === pinCaptureInputRef.current) return;

      const target = e.target as HTMLElement;
      const digit = getPinDigitFromKeyboard(e);
      const isPinKey = digit !== null || e.key === 'Backspace';

      if (!isPinKey) {
        if (
          target?.closest('button') ||
          target?.closest('a') ||
          (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
        ) {
          return;
        }
        return;
      }

      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (digit !== null) {
        setPin(prev => {
          if (prev.length >= KIOSK_MANAGER_PIN_LENGTH) return prev;
          const next = prev + digit;
          if (next.length >= EMPLOYEE_PIN_LENGTH) {
            queueMicrotask(() => {
              void tryVerifyPin(next);
            });
          }
          return next;
        });
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Backspace') {
        bumpPinVerification();
        setPin(prev => prev.slice(0, -1));
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    managerPinGate,
    state,
    showManagerChoice,
    getPinDigitFromKeyboard,
    tryVerifyPin,
    bumpPinVerification,
  ]);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4" role="status" aria-busy="true">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-muted-foreground/30 border-t-primary" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (!businessId) {
    if (!businessResolveTimedOut) {
      return (
        <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4" role="status" aria-busy="true">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-muted-foreground/30 border-t-primary" />
            <span className="sr-only">{t('common.loading')}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-8 space-y-4 text-center">
            <h1 className="text-xl font-bold">{t('timeKiosk.businessNotResolvedTitle')}</h1>
            <p className="text-muted-foreground text-sm">{t('timeKiosk.businessNotResolvedDescription')}</p>
            {businessSlug ? (
              <Button className="w-full" onClick={() => navigate(`/${businessSlug}/dashboard`)}>
                {t('timeKiosk.goToDashboard')}
              </Button>
            ) : (
              <Button className="w-full" onClick={() => navigate('/')}>
                {t('timeKiosk.goToDashboard')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (managerPinGate === 'loading') {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4" role="status" aria-busy="true">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-muted-foreground/30 border-t-primary" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (managerPinGate === 'missing') {
    const goToKioskPinSettings = () => {
      if (!businessSlug) return;
      navigate({
        pathname: `/${businessSlug}/settings/business`,
        hash: 'kiosk-manager-pin',
      });
    };

    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-8 space-y-4">
            <div className="flex justify-center">
              <Settings className="w-12 h-12 text-primary" aria-hidden />
            </div>
            <h1 className="text-2xl font-bold text-center">{t('timeKiosk.managerPinRequiredTitle')}</h1>
            <p className="text-muted-foreground text-center">{t('timeKiosk.managerPinRequiredDescription')}</p>
            <Alert variant="warning" className="text-left">
              <Info className="h-4 w-4" />
              <AlertDescription>{t('timeKiosk.managerPinRequiredToast')}</AlertDescription>
            </Alert>
            {businessSlug ? (
              <Button className="w-full" size="lg" onClick={goToKioskPinSettings}>
                <Settings className="w-5 h-5 mr-2" />
                {t('timeKiosk.goToBusinessSettings')}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render based on state
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <KioskManagerPinResetDialog
        open={managerPinResetOpen}
        onOpenChange={setManagerPinResetOpen}
        businessId={businessId}
        onSuccess={async () => {
          setKioskLocked(false);
          navigate(businessSlug ? `/${businessSlug}/dashboard` : '/');
        }}
      />
      {showManagerChoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Lock className="w-10 h-10 text-primary" />
                <h2 className="text-2xl font-bold">{t('timeKiosk.managerChoiceTitle')}</h2>
              </div>
              <div className="flex flex-col gap-3">
                {managerChoiceEmployee && (
                  <Button
                    size="lg"
                    className="h-14 text-lg"
                    onClick={handleManagerChoiceClockInOut}
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    {t('timeKiosk.managerChoiceClockInOut')}
                  </Button>
                )}
                <Button
                  size="lg"
                  variant={managerChoiceEmployee ? 'outline' : 'default'}
                  className="h-14 text-lg"
                  onClick={handleManagerChoiceCloseKiosk}
                >
                  <Lock className="w-5 h-5 mr-2" />
                  {t('timeKiosk.managerChoiceCloseKiosk')}
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12"
                  onClick={() => {
                    setShowManagerChoice(false);
                    setManagerChoiceEmployee(null);
                  }}
                >
                  {t('timeKiosk.managerChoiceCancel')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              {selectedBusinessLogoUrl ? (
                <img
                  src={selectedBusinessLogoUrl}
                  alt={t('timeTracking.title')}
                  className="h-12 w-auto max-w-[240px] object-contain"
                />
              ) : (
                <>
                  <Clock className="w-12 h-12 text-primary" />
                  <h1 className="text-4xl font-bold">{t('timeTracking.title')}</h1>
                </>
              )}
            </div>
            <p className="text-muted-foreground text-lg">
              {state === 'pin_entry' && t('timeTracking.description')}
              {state === 'employee_verified' && t('timeTracking.welcome', { name: employee?.name ?? '' })}
              {state === 'clocking' && t('timeKiosk.processing')}
              {state === 'success' &&
                (clockResult?.action === 'clock_in'
                  ? t('timeTracking.clockedIn', { name: employee?.name ?? '' })
                  : t('timeTracking.clockedOut', { name: employee?.name ?? '' }))}
            </p>
          </div>

          {/* Main Content */}
          <Card className="shadow-lg">
            <CardContent className="p-8">
              {state === 'pin_entry' && (
                <div className="space-y-6 relative">
                  <input
                    ref={pinCaptureInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label={t('timeTracking.enterPin')}
                    tabIndex={0}
                    className="absolute left-0 top-0 w-px h-px opacity-0 overflow-hidden"
                    onKeyDown={handlePinCaptureKeyDown}
                    readOnly
                  />
                  {/* PIN display: always 4 boxes; digits 5–6 of a manager PIN keep all four filled (no extra slots) */}
                  <div className="flex justify-center">
                    <div className="flex gap-2 justify-center">
                      {Array.from({ length: EMPLOYEE_PIN_LENGTH }, (_, i) => {
                        const showFilled =
                          pin.length > EMPLOYEE_PIN_LENGTH ? i < EMPLOYEE_PIN_LENGTH : i < pin.length;
                        return (
                          <div
                            key={i}
                            className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${
                              showFilled
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {showFilled ? '•' : ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Error Message */}
                  {errorMessage && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <Button
                        key={num}
                        size="lg"
                        variant="outline"
                        className="h-20 text-2xl font-bold"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handlePinInput(num.toString())}
                      >
                        {num}
                      </Button>
                    ))}
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-20 text-xl"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleClear}
                    >
                      {t('timeKiosk.clear')}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-20 text-2xl font-bold"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePinInput('0')}
                    >
                      0
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-20 text-xl"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleBackspace}
                    >
                      ←
                    </Button>
                  </div>

                  {canResetKioskManagerPin ? (
                    <div className="text-center text-sm mt-4">
                      <Button
                        type="button"
                        variant="link"
                        className="text-sm h-auto p-0 text-muted-foreground hover:text-primary"
                        onClick={() => setManagerPinResetOpen(true)}
                      >
                        {t('kioskManagerPinReset.forgotPinLink')}
                      </Button>
                    </div>
                  ) : null}
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
                      <p className="text-sm text-muted-foreground mb-2">{t('timeKiosk.currentlyClockedInSince')}</p>
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
                        t('timeKiosk.processing')
                      ) : (
                        <>
                          {activeTimeEntry ? (
                            <LogOut className="w-6 h-6 mr-2" />
                          ) : (
                            <LogIn className="w-6 h-6 mr-2" />
                          )}
                          {activeTimeEntry ? t('timeTracking.clockOut') : t('timeTracking.clockIn')}
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
                      {t('timeKiosk.cancel')}
                    </Button>
                  </div>
                </div>
              )}

              {state === 'clocking' && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-xl text-muted-foreground">{t('timeKiosk.processing')}</p>
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
                    {clockResult.action === 'clock_in' ? t('timeKiosk.clockedInTitle') : t('timeKiosk.clockedOutTitle')}
                  </h2>
                  <p className="text-xl text-muted-foreground">
                    {format(new Date(clockResult.clock_in || clockResult.clock_out), 'h:mm a')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('timeKiosk.returningToPin')}
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
    </div>
  );
}

