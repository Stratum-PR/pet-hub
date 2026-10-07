import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { CalendarCheck, Check, Loader2, MapPin, Phone, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Helmet } from 'react-helmet-async';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { dateToDayKey, isBusinessClosedOnDate, parseBusinessHours } from '@/lib/businessHours';
import { DEMO_WORKSPACE_SLUG } from '@/lib/demoWorkspace';
import {
  formatTime12h,
  freeStartsForAnyone,
  freeStartsForStaff,
  normalizeHHmm,
  priceRangeForService,
  quoteForStaff,
  staffOffersAll,
  timeToMinutesSafe,
  workingWindows,
  type BusyBlock,
  type Interval,
  type ShiftLike,
  type StaffServiceRate,
} from '@/lib/groomerAvailability';
import { devConsole } from '@/lib/clientDebug';

interface Options {
  business: { id: string; name: string; phone: string | null; address: string | null };
  business_hours: string | null;
  timezone: string;
  services: { id: string; name: string; description: string | null; price: number; duration_minutes: number }[];
  groomers: {
    id: string;
    display_name: string;
    photo_url?: string | null;
    offered_service_ids: string[];
    rates: { service_id: string; price: number | null; duration_minutes: number | null }[];
  }[];
}

interface DayAvailability {
  busy: { staff_id: string | null; start_time: string; end_time: string }[];
  shifts: { staff_id: string; start: string; end: string }[];
  uses_shifts: boolean;
}

const ANYONE = 'anyone';
const NO_RATES: StaffServiceRate[] = [];
const field = 'h-11 rounded-lg border border-foreground/15 bg-background shadow-none';

/** Public page where clients request an appointment. Requests arrive as "pending" for staff to confirm. */
export function PublicBookingPage() {
  const { businessSlug = '' } = useParams<{ businessSlug: string }>();
  const { language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;
  const isDemo = businessSlug === DEMO_WORKSPACE_SLUG;

  const [options, setOptions] = useState<Options | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [groomer, setGroomer] = useState<string>(ANYONE);
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [day, setDay] = useState<DayAvailability | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [time, setTime] = useState('');
  const [form, setForm] = useState({
    first: '',
    last: '',
    phone: '',
    email: '',
    pref: 'email' as 'email' | 'sms',
    pet: '',
    species: 'dog' as 'dog' | 'cat' | 'other',
    breed: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ time: string; date: Date } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc('get_public_booking_options' as never, { p_slug: businessSlug } as never);
      if (cancelled) return;
      if (error) {
        devConsole.warn('[PublicBookingPage] options', error.message);
        setLoadState('error');
        return;
      }
      if (!data) {
        setLoadState('notfound');
        return;
      }
      setOptions(data as unknown as Options);
      setLoadState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [businessSlug]);

  const dateKey = format(date, 'yyyy-MM-dd');
  useEffect(() => {
    if (loadState !== 'ready') return;
    let cancelled = false;
    setDayLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc(
        'get_public_day_availability' as never,
        { p_slug: businessSlug, p_date: dateKey } as never,
      );
      if (cancelled) return;
      if (error) devConsole.warn('[PublicBookingPage] availability', error.message);
      setDay((data as unknown as DayAvailability) ?? { busy: [], shifts: [], uses_shifts: false });
      setDayLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [businessSlug, dateKey, loadState]);

  const hoursPerDay = useMemo(() => parseBusinessHours(options?.business_hours ?? undefined), [options]);
  // Price and duration are set per service by the business; per-groomer overrides are not used.
  const rates: StaffServiceRate[] = NO_RATES;
  const eligible = useMemo(
    () => (options?.groomers ?? []).filter((g) => staffOffersAll({ id: g.id, offered_service_ids: g.offered_service_ids }, serviceIds)),
    [options, serviceIds],
  );
  useEffect(() => {
    if (groomer !== ANYONE && !eligible.some((g) => g.id === groomer)) setGroomer(ANYONE);
  }, [eligible, groomer]);

  const quote = useMemo(
    () => quoteForStaff(serviceIds, options?.services ?? [], rates, groomer === ANYONE ? null : groomer),
    [serviceIds, options, rates, groomer],
  );

  const slots = useMemo(() => {
    if (!options || !day || serviceIds.length === 0) return [];
    const dayHours = hoursPerDay[dateToDayKey(date)];
    // Shift times come back as local wall-clock "HH:mm" for that date.
    const shifts: ShiftLike[] = day.shifts.map((s) => ({
      staff_id: s.staff_id,
      start_time: new Date(`${dateKey}T${s.start}:00`).toISOString(),
      end_time: new Date(`${dateKey}T${s.end}:00`).toISOString(),
    }));
    const windowsByStaff: Record<string, Interval[]> = {};
    for (const g of options.groomers) {
      windowsByStaff[g.id] = workingWindows({ staffId: g.id, day: date, dayHours, shifts, usesShifts: day.uses_shifts });
    }
    const blocks: BusyBlock[] = day.busy
      .map((b) => {
        const s = timeToMinutesSafe(normalizeHHmm(b.start_time));
        const e = timeToMinutesSafe(normalizeHHmm(b.end_time));
        return s == null ? null : { staffId: b.staff_id, start: s, end: e != null && e > s ? e : s + 60 };
      })
      .filter((b): b is BusyBlock => !!b);
    const duration = Math.max(quote.duration, 15);
    const list =
      groomer === ANYONE
        ? freeStartsForAnyone({ staffIds: eligible.map((g) => g.id), duration, windowsByStaff, blocks })
        : freeStartsForStaff({ staffId: groomer, duration, windowsByStaff, blocks });
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes() + 60; // at least 1 hour notice
    return isSameDay(date, now) ? list.filter((s) => (timeToMinutesSafe(s) ?? 0) >= nowMin) : list;
  }, [options, day, serviceIds.length, hoursPerDay, date, dateKey, quote.duration, groomer, eligible]);

  useEffect(() => {
    if (time && !slots.includes(time)) setTime('');
  }, [slots, time]);

  const submit = async () => {
    const err: Record<string, string> = {};
    if (serviceIds.length === 0) err.services = t('publicBooking.errServices');
    if (!time) err.time = t('publicBooking.errTime');
    if (!form.first.trim()) err.first = t('bookingDialog.errRequired');
    if (!form.last.trim()) err.last = t('bookingDialog.errRequired');
    if (unformatPhoneNumber(form.phone).length !== 10) err.phone = t('bookingDialog.errPhone');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = t('bookingDialog.errEmail');
    if (form.pref === 'email' && !form.email.trim()) err.email = t('bookingDialog.errEmailForPref');
    if (!form.pet.trim()) err.pet = t('bookingDialog.errRequired');
    setErrors(err);
    if (Object.keys(err).length) return;

    if (isDemo) {
      setDone({ time, date });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('submit_booking_request' as never, {
      p_slug: businessSlug,
      p_first_name: form.first.trim(),
      p_last_name: form.last.trim(),
      p_phone: unformatPhoneNumber(form.phone),
      p_email: form.email.trim() || null,
      p_contact_preference: form.pref,
      p_pet_name: form.pet.trim(),
      p_pet_species: form.species,
      p_pet_breed: form.breed.trim() || null,
      p_service_ids: serviceIds,
      p_staff_id: groomer === ANYONE ? null : groomer,
      p_date: dateKey,
      p_start_time: time,
      p_notes: form.notes.trim() || null,
    } as never);
    setSubmitting(false);
    if (error) {
      const code = ['slot_taken', 'too_many_requests', 'invalid_phone', 'invalid_email', 'time_in_past'].find((c) =>
        error.message?.includes(c),
      );
      setErrors({ submit: t(code ? `publicBooking.err_${code}` : 'publicBooking.errGeneric') });
      if (code === 'slot_taken') setTime('');
      return;
    }
    setDone({ time, date });
  };

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (loadState !== 'ready' || !options) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">{t('publicBooking.notFoundTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {loadState === 'notfound' ? t('publicBooking.notFoundBody') : t('publicBooking.errGeneric')}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <CalendarCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-xl font-semibold">{t('publicBooking.sentTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('publicBooking.sentBody', {
              business: options.business.name,
              when: `${format(done.date, 'EEEE d MMMM', { locale })} · ${formatTime12h(done.time)}`,
              channel: form.pref === 'sms' ? t('publicBooking.bySms') : t('publicBooking.byEmail'),
            })}
          </p>
          {isDemo ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{t('publicBooking.demoNotice')}</p> : null}
          <Button className="mt-6" variant="outline" onClick={() => { setDone(null); setTime(''); }}>
            {t('publicBooking.another')}
          </Button>
        </div>
      </div>
    );
  }

  const maxDate = addDays(startOfDay(new Date()), 90);

  return (
    <div className="min-h-screen bg-muted/30">
      <Helmet>
        <title>{`${t('publicBooking.title')} · ${options.business.name}`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-4 py-5">
          <div>
            <h1 className="text-xl font-semibold">{options.business.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {options.business.address ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {options.business.address}
                </span>
              ) : null}
              {options.business.phone ? (
                <a className="inline-flex items-center gap-1 hover:text-foreground" href={`tel:${options.business.phone}`}>
                  <Phone className="h-3.5 w-3.5" /> {formatPhoneNumber(options.business.phone)}
                </a>
              ) : null}
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h2 className="text-lg font-semibold">{t('publicBooking.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('publicBooking.subtitle')}</p>
          {isDemo ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('publicBooking.demoNotice')}</p> : null}
        </div>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 font-semibold">{t('publicBooking.stepServices')}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.services.map((s) => {
              const on = serviceIds.includes(s.id);
              const range = priceRangeForService(s, options.groomers.map((g) => g.id), rates);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setServiceIds((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                  className={cn('flex items-start gap-3 rounded-lg border p-3 text-left', on ? 'border-primary bg-primary/10' : 'hover:bg-muted/60')}
                >
                  <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50')}>
                    {on ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{s.name}</span>
                    {s.description ? <span className="block text-xs text-muted-foreground">{s.description}</span> : null}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t('bookingDialog.minutes', { n: s.duration_minutes })} ·{' '}
                      {range.min === range.max ? `$${range.min.toFixed(0)}` : t('publicBooking.from', { price: `$${range.min.toFixed(0)}` })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.services ? <p className="mt-2 text-sm text-destructive">{errors.services}</p> : null}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 font-semibold">{t('publicBooking.stepGroomer')}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setGroomer(ANYONE)}
              className={cn('flex items-center gap-3 rounded-lg border p-3 text-left', groomer === ANYONE ? 'border-primary bg-primary/10' : 'hover:bg-muted/60')}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </span>
              <span className="font-medium">{t('publicBooking.anyGroomer')}</span>
            </button>
            {eligible.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroomer(g.id)}
                className={cn('flex items-center gap-3 rounded-lg border p-3 text-left', groomer === g.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/60')}
              >
                {g.photo_url ? (
                  <img src={g.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {g.display_name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="font-medium">{g.display_name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 font-semibold">{t('publicBooking.stepTime')}</h3>
          <div className="flex flex-col gap-4 md:flex-row">
            <Calendar
              mode="single"
              selected={date}
              locale={locale}
              onSelect={(d) => d && setDate(startOfDay(d))}
              disabled={(d) => d < startOfDay(new Date()) || d > maxDate || isBusinessClosedOnDate(d, hoursPerDay)}
              className="rounded-lg border"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-2 text-sm font-medium capitalize">{format(date, 'EEEE d MMMM', { locale })}</div>
              {serviceIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('bookingDialog.pickServicesFirst')}</p>
              ) : dayLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('publicBooking.noSlots')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTime(s)}
                      className={cn('rounded-md border px-3 py-1.5 text-sm tabular-nums', time === s ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50')}
                    >
                      {formatTime12h(s)}
                    </button>
                  ))}
                </div>
              )}
              {errors.time ? <p className="mt-2 text-sm text-destructive">{errors.time}</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 font-semibold">{t('publicBooking.stepDetails')}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['first', 'bookingDialog.firstName', 'given-name'],
                ['last', 'bookingDialog.lastName', 'family-name'],
              ] as const
            ).map(([k, label, ac]) => (
              <div key={k}>
                <Label htmlFor={`pb-${k}`} className="mb-1 block text-xs">{t(label)}</Label>
                <Input id={`pb-${k}`} autoComplete={ac} className={field} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} maxLength={80} />
                {errors[k] ? <p className="mt-1 text-sm text-destructive">{errors[k]}</p> : null}
              </div>
            ))}
            <div>
              <Label htmlFor="pb-phone" className="mb-1 block text-xs">{t('bookingDialog.phone')}</Label>
              <Input id="pb-phone" autoComplete="tel-national" inputMode="tel" className={field} value={formatPhoneNumber(form.phone)} onChange={(e) => setForm((f) => ({ ...f, phone: unformatPhoneNumber(e.target.value).slice(0, 10) }))} />
              {errors.phone ? <p className="mt-1 text-sm text-destructive">{errors.phone}</p> : null}
            </div>
            <div>
              <Label htmlFor="pb-email" className="mb-1 block text-xs">{t('bookingDialog.email')}</Label>
              <Input id="pb-email" type="email" autoComplete="email" className={field} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} maxLength={120} />
              {errors.email ? <p className="mt-1 text-sm text-destructive">{errors.email}</p> : null}
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs">{t('publicBooking.howToReach')}</Label>
              <div className="flex gap-2">
                {(['email', 'sms'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, pref: p }))}
                    className={cn('rounded-full border px-3 py-1 text-sm', form.pref === p ? 'border-primary bg-primary/10 font-medium' : 'text-muted-foreground hover:bg-muted')}
                  >
                    {t(`bookingDialog.pref_${p}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="pb-pet" className="mb-1 block text-xs">{t('bookingDialog.petName')}</Label>
              <Input id="pb-pet" className={field} value={form.pet} onChange={(e) => setForm((f) => ({ ...f, pet: e.target.value }))} maxLength={80} />
              {errors.pet ? <p className="mt-1 text-sm text-destructive">{errors.pet}</p> : null}
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-2">
              <div>
                <Label className="mb-1 block text-xs">{t('bookingDialog.species')}</Label>
                <Select value={form.species} onValueChange={(v: 'dog' | 'cat' | 'other') => setForm((f) => ({ ...f, species: v }))}>
                  <SelectTrigger className={field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dog">{t('bookingDialog.dog')}</SelectItem>
                    <SelectItem value="cat">{t('bookingDialog.cat')}</SelectItem>
                    <SelectItem value="other">{t('bookingDialog.otherSpecies')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pb-breed" className="mb-1 block text-xs">{t('bookingDialog.breed')}</Label>
                <Input id="pb-breed" className={field} value={form.breed} onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))} maxLength={80} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pb-notes" className="mb-1 block text-xs">{t('publicBooking.notes')}</Label>
              <Textarea id="pb-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={1000} className="min-h-[72px] border border-foreground/15 bg-background" />
            </div>
          </div>
        </section>

        <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0 text-sm">
            <div className="font-medium">
              {serviceIds.length ? `$${quote.price.toFixed(2)} · ${t('bookingDialog.minutes', { n: quote.duration })}` : t('publicBooking.pickToStart')}
            </div>
            <div className="truncate text-xs text-muted-foreground capitalize">
              {time ? `${format(date, 'EEE d MMM', { locale })} · ${formatTime12h(time)}` : ''}
            </div>
            {errors.submit ? <p className="text-sm text-destructive">{errors.submit}</p> : null}
          </div>
          <Button onClick={() => void submit()} disabled={submitting} size="lg">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('publicBooking.send')}
          </Button>
        </div>
        <p className="pb-6 text-center text-xs text-muted-foreground">{t('publicBooking.pendingNote')}</p>
      </main>
    </div>
  );
}

export default PublicBookingPage;
