import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  isSameWeek,
  max as maxDate,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { DOG_BREEDS } from '@/lib/dogBreeds';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import type { Appointment, BusinessClient, Pet, Service } from '@/hooks/useBusinessData';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { staffIdForBusinessOrNull } from '@/lib/staffFkGuard';
import { t } from '@/lib/translations';
import { devConsole } from '@/lib/clientDebug';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { isTerminalAppointmentStatus } from '@/lib/appointmentStatus';
import { isPastCalendarDay, isSlotStartInPast } from '@/lib/bookingPastSlots';
import {
  dateToDayKey,
  isBusinessClosedOnDate,
  minutesToHHmm,
  parseBusinessHours,
  timeToMinutes,
} from '@/lib/businessHours';
import {
  bookableStaff,
  businessUsesShifts,
  formatTime12h,
  freeStartsForAnyone,
  freeStartsForStaff,
  normalizeHHmm,
  pickLeastBusyStaff,
  quoteForStaff,
  staffOffersAll,
  workingWindows,
  type BusyBlock,
  type Interval,
} from '@/lib/groomerAvailability';
import { useEmployeeShifts, useEmployees, useSettings } from '@/hooks/useSupabaseData';
import { PastBookingConfirmDialog } from '@/components/PastBookingConfirmDialog';

const CAT_BREEDS = [
  'Mixed Breed - Shorthair',
  'Mixed Breed - Longhair',
  'Abyssinian',
  'American Shorthair',
  'Bengal',
  'British Shorthair',
  'Maine Coon',
  'Persian',
  'Ragdoll',
  'Siamese',
  'Sphynx',
  'Other',
];

const ANYONE = 'anyone';
/** Price and duration are set per service by the business; no per-groomer overrides. */
const NO_RATES: never[] = [];

const field = 'rounded-lg border border-foreground/15 bg-background shadow-none';

type ContactPref = 'email' | 'sms' | 'none';

export interface NewAppointmentPayload {
  client_id: string;
  pet_id: string;
  service_id: string;
  service_ids: string[];
  staff_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  scheduled_date: string;
  service_type: string;
  status: 'scheduled';
  total_price: number;
  price: number;
  notes: string | null;
  booked_by_staff_id: string | null;
  booking_source: 'staff';
}

export type NewClientInput = Omit<BusinessClient, 'id' | 'created_at' | 'updated_at'>;
export type NewPetInput = Omit<Pet, 'id' | 'created_at' | 'updated_at'>;
type SavedRow = { id: string } | null | undefined | void;

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients?: BusinessClient[];
  pets: Pet[];
  services: Service[];
  /** Existing appointments (used to compute free time). */
  appointments: Appointment[];
  onSuccess: (newAppointment?: SavedRow) => void;
  /** Creates the appointment row. Should return the saved row (or null on failure). */
  onAddAppointment?: (appointment: NewAppointmentPayload) => Promise<SavedRow> | SavedRow;
  /** Creates a client (hook-backed so demo mode and local state work). */
  onAddClient?: (client: NewClientInput) => Promise<BusinessClient | null>;
  /** Creates a pet (hook-backed so demo mode and local state work). */
  onAddPet?: (pet: NewPetInput) => Promise<Pet | null>;
  preselectedStaffId?: string | null;
  preselectedDate?: Date | null;
  /** "HH:mm" */
  preselectedTime?: string | null;
}

function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** Round photo when on file (and allowed), otherwise initials. */
function StaffAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {staffInitials(name)}
    </span>
  );
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
        {n}
      </span>
      {children}
    </h3>
  );
}

export function BookingFormDialog({
  open,
  onOpenChange,
  clients,
  pets,
  services,
  appointments,
  onSuccess,
  onAddAppointment,
  onAddClient,
  onAddPet,
  preselectedStaffId = null,
  preselectedDate = null,
  preselectedTime = null,
}: BookingFormDialogProps) {
  const businessId = useBusinessId();
  const { staffId: myStaffId, role } = useAuth();
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? esLocale : enUS;
  const staffMayBookPast = role === 'employee' || role === 'manager' || role === 'super_admin';

  const { settings } = useSettings();
  const { employees } = useEmployees({ includeSensitive: false });
  const hoursPerDay = useMemo(() => parseBusinessHours(settings.business_hours), [settings.business_hours]);

  const activeServices = useMemo(
    () => (Array.isArray(services) ? services : []).filter((s) => s.is_active !== false),
    [services],
  );
  const safeClients = useMemo(() => (Array.isArray(clients) ? clients : []), [clients]);
  const safePets = useMemo(() => (Array.isArray(pets) ? pets : []), [pets]);

  // ---------------- state ----------------
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientSearch, setClientSearch] = useState('');
  const [clientListOpen, setClientListOpen] = useState(false);
  const clientBoxRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState('');
  const [newClient, setNewClient] = useState({ first: '', last: '', email: '', phone: '', pref: 'email' as ContactPref });

  const [petId, setPetId] = useState('');
  const [creatingPet, setCreatingPet] = useState(false);
  const [newPet, setNewPet] = useState({
    name: '',
    species: 'dog' as 'dog' | 'cat' | 'other',
    breed: '',
    weight: '',
    birthMonth: '',
    birthYear: '',
    rabiesMonth: '',
    rabiesYear: '',
  });

  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [groomer, setGroomer] = useState<string>(ANYONE);
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pastConfirm, setPastConfirm] = useState<{ open: boolean; onConfirm: () => void }>({
    open: false,
    onConfirm: () => {},
  });

  const reset = useCallback(() => {
    setClientMode('existing');
    setClientSearch('');
    setClientListOpen(false);
    setClientId('');
    setNewClient({ first: '', last: '', email: '', phone: '', pref: 'email' });
    setPetId('');
    setCreatingPet(false);
    setNewPet({ name: '', species: 'dog', breed: '', weight: '', birthMonth: '', birthYear: '', rabiesMonth: '', rabiesYear: '' });
    setServiceIds([]);
    setGroomer(ANYONE);
    setDate(startOfDay(new Date()));
    setTime('');
    setNotes('');
    setErrors({});
  }, []);

  // Apply prefill on open; reset on close.
  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (preselectedDate && !Number.isNaN(preselectedDate.getTime())) setDate(startOfDay(preselectedDate));
    if (preselectedStaffId) setGroomer(preselectedStaffId);
    if (preselectedTime) setTime(normalizeHHmm(preselectedTime));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!clientListOpen) return;
    const onDown = (e: MouseEvent) => {
      if (clientBoxRef.current && !clientBoxRef.current.contains(e.target as Node)) setClientListOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [clientListOpen]);

  // ---------------- derived: client & pets ----------------
  const selectedClient = safeClients.find((c) => c.id === clientId) ?? null;
  const clientPets = useMemo(() => safePets.filter((p) => p.client_id === clientId), [safePets, clientId]);
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return safeClients.slice(0, 8);
    const qd = q.replace(/\D/g, '');
    return safeClients
      .filter((c) => {
        const name = `${c.first_name} ${c.last_name}`.toLowerCase();
        const phone = unformatPhoneNumber(c.phone || '');
        return name.includes(q) || (qd.length >= 3 && phone.includes(qd));
      })
      .slice(0, 20);
  }, [clientSearch, safeClients]);

  // Auto-pick the only pet.
  useEffect(() => {
    if (clientMode === 'existing' && clientId && clientPets.length === 1 && !petId && !creatingPet) {
      setPetId(clientPets[0].id);
    }
  }, [clientMode, clientId, clientPets, petId, creatingPet]);

  const needsNewPet = clientMode === 'new' || creatingPet || (!!clientId && clientPets.length === 0);

  // ---------------- derived: groomers, shifts, availability ----------------
  const weekStart = useMemo(() => startOfWeek(date, { weekStartsOn: 0 }), [date]);
  const weekEnd = useMemo(() => endOfWeek(date, { weekStartsOn: 0 }), [date]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  // Shifts for the selected week and the next 9, so week browsing and "next available" use real schedules.
  const shiftRange = useMemo(
    () => ({ start: weekStart, end: endOfWeek(addDays(weekStart, 7 * 9), { weekStartsOn: 0 }) }),
    [weekStart],
  );
  const { shifts } = useEmployeeShifts({ dateRange: shiftRange });

  const showPhotos = settings.booking_show_staff_photos !== 'false';
  const activeStaff = useMemo(() => bookableStaff(employees), [employees]);
  const eligibleStaff = useMemo(
    () => activeStaff.filter((e) => staffOffersAll(e, serviceIds)),
    [activeStaff, serviceIds],
  );
  const eligibleIds = useMemo(() => eligibleStaff.map((e) => e.id), [eligibleStaff]);

  // A preselected groomer who doesn't offer the chosen services falls back to "Next available groomer".
  useEffect(() => {
    if (groomer !== ANYONE && serviceIds.length > 0 && !eligibleIds.includes(groomer)) {
      setGroomer(ANYONE);
      toast.message(t('bookingDialog.groomerResetNotice'));
    }
  }, [groomer, eligibleIds, serviceIds.length]);

  /** Busy blocks per day (yyyy-MM-dd), ignoring canceled/no-show/etc. */
  const blocksByDay = useMemo(() => {
    const map = new Map<string, BusyBlock[]>();
    for (const a of appointments ?? []) {
      if (isTerminalAppointmentStatus(a.status)) continue;
      const key = String(a.appointment_date ?? '').slice(0, 10);
      const s = normalizeHHmm(a.start_time);
      if (!key || !s) continue;
      const start = timeToMinutes(s);
      const e = normalizeHHmm(a.end_time);
      const end = e && timeToMinutes(e) > start ? timeToMinutes(e) : start + 60;
      const list = map.get(key) ?? [];
      list.push({ staffId: a.staff_id ?? null, start, end, appointmentId: a.id });
      map.set(key, list);
    }
    return map;
  }, [appointments]);

  const windowsFor = useCallback(
    (d: Date): Record<string, Interval[]> => {
      const usesShifts = businessUsesShifts(
        shifts,
        startOfWeek(d, { weekStartsOn: 0 }),
        endOfWeek(d, { weekStartsOn: 0 }),
      );
      const dh = hoursPerDay[dateToDayKey(d)];
      const out: Record<string, Interval[]> = {};
      for (const e of activeStaff) out[e.id] = workingWindows({ staffId: e.id, day: d, dayHours: dh, shifts, usesShifts });
      return out;
    },
    [shifts, hoursPerDay, activeStaff],
  );

  const windowsByStaff = useMemo(() => windowsFor(date), [windowsFor, date]);
  const blocks: BusyBlock[] = useMemo(() => blocksByDay.get(format(date, 'yyyy-MM-dd')) ?? [], [blocksByDay, date]);

  const quote = useMemo(
    () => quoteForStaff(serviceIds, activeServices, NO_RATES, groomer === ANYONE ? null : groomer),
    [serviceIds, activeServices, groomer],
  );
  const duration = Math.max(quote.duration, serviceIds.length ? 15 : 0);

  /** Free start times on a day for the current selection (groomer or anyone eligible). */
  const slotsOn = useCallback(
    (d: Date, allowPast = false): string[] => {
      if (serviceIds.length === 0 || duration <= 0) return [];
      if (isBusinessClosedOnDate(d, hoursPerDay)) return [];
      const win = isSameDay(d, date) ? windowsByStaff : windowsFor(d);
      const dayBlocks = blocksByDay.get(format(d, 'yyyy-MM-dd')) ?? [];
      const list =
        groomer === ANYONE
          ? freeStartsForAnyone({ staffIds: eligibleIds, duration, windowsByStaff: win, blocks: dayBlocks })
          : freeStartsForStaff({ staffId: groomer, duration, windowsByStaff: win, blocks: dayBlocks });
      return allowPast ? list : list.filter((s) => !isSlotStartInPast(d, s));
    },
    [serviceIds.length, duration, hoursPerDay, date, windowsByStaff, windowsFor, blocksByDay, groomer, eligibleIds],
  );

  const visibleSlots = useMemo(() => slotsOn(date, staffMayBookPast), [slotsOn, date, staffMayBookPast]);

  // Drop a chosen time that is no longer available (unless it was a prefill still being validated).
  useEffect(() => {
    if (time && serviceIds.length > 0 && !visibleSlots.includes(time)) setTime('');
  }, [time, visibleSlots, serviceIds.length]);

  /** Which days of the shown week still have room (dot under the day). */
  const dayHasRoom = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const d of weekDays) out[format(d, 'yyyy-MM-dd')] = slotsOn(d).length > 0;
    return out;
  }, [weekDays, slotsOn]);

  /** When the chosen day is full (or the groomer is off), the next day with room. */
  const nextAvailable = useMemo((): Date | null => {
    if (serviceIds.length === 0 || visibleSlots.length > 0) return null;
    const from = maxDate([addDays(date, 1), startOfDay(new Date())]);
    for (let i = 0; i < 63; i++) {
      const d = addDays(from, i);
      if (slotsOn(d).length > 0) return d;
    }
    return null;
  }, [serviceIds.length, visibleSlots.length, date, slotsOn]);

  const isDayDisabled = (d: Date) =>
    isBusinessClosedOnDate(d, hoursPerDay) || (!staffMayBookPast && isPastCalendarDay(d));

  const pickDate = (d: Date) => {
    setDate(startOfDay(d));
    setTime('');
    setErrors((e) => ({ ...e, time: '' }));
  };

  /** Move a week; land on the first day there with room (else the first open day). */
  const goWeek = (delta: number) => {
    const ws = addDays(weekStart, 7 * delta);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).filter((d) => !isDayDisabled(d));
    pickDate(days.find((d) => slotsOn(d).length > 0) ?? days[0] ?? ws);
  };
  const canGoBackWeek = staffMayBookPast || !isSameWeek(weekStart, new Date(), { weekStartsOn: 0 });

  const slotGroups = useMemo(() => {
    const groups: { key: string; label: string; items: string[] }[] = [
      { key: 'am', label: t('bookingDialog.morning'), items: [] },
      { key: 'pm', label: t('bookingDialog.afternoon'), items: [] },
      { key: 'eve', label: t('bookingDialog.evening'), items: [] },
    ];
    for (const s of visibleSlots) {
      const m = timeToMinutes(s);
      (m < 12 * 60 ? groups[0] : m < 17 * 60 ? groups[1] : groups[2]).items.push(s);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [visibleSlots]);

  // ---------------- actions ----------------
  const toggleService = (id: string) => {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setErrors((e) => ({ ...e, services: '' }));
  };

  const pickClient = (c: BusinessClient) => {
    setClientId(c.id);
    setClientSearch(`${c.first_name} ${c.last_name}`);
    setClientListOpen(false);
    setPetId('');
    setCreatingPet(false);
    setErrors((e) => ({ ...e, client: '' }));
  };

  const validate = (): boolean => {
    const err: Record<string, string> = {};
    if (clientMode === 'existing') {
      if (!clientId) err.client = t('bookingDialog.errClient');
    } else {
      if (!newClient.first.trim()) err.first = t('bookingDialog.errRequired');
      if (!newClient.last.trim()) err.last = t('bookingDialog.errRequired');
      if (unformatPhoneNumber(newClient.phone).length !== 10) err.phone = t('bookingDialog.errPhone');
      if (newClient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email)) err.email = t('bookingDialog.errEmail');
      if (newClient.pref === 'email' && !newClient.email.trim()) err.email = t('bookingDialog.errEmailForPref');
    }
    if (needsNewPet) {
      if (!newPet.name.trim()) err.petName = t('bookingDialog.errRequired');
      const m = newPet.birthMonth ? Number(newPet.birthMonth) : null;
      const y = newPet.birthYear ? Number(newPet.birthYear) : null;
      if ((m && !y) || (y && (y < 1990 || y > new Date().getFullYear()))) err.petBirth = t('bookingDialog.errBirth');
    } else if (!petId) {
      err.pet = t('bookingDialog.errPet');
    }
    if (serviceIds.length === 0) err.services = t('bookingDialog.errServices');
    if (!time) err.time = t('bookingDialog.errTime');
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const resolveClient = async (): Promise<string | null> => {
    if (clientMode === 'existing') return clientId || null;
    const payload: NewClientInput = {
      business_id: businessId as string,
      first_name: newClient.first.trim(),
      last_name: newClient.last.trim(),
      email: newClient.email.trim() || null,
      phone: unformatPhoneNumber(newClient.phone),
      address: null,
      city: null,
      state: null,
      zip_code: null,
      notes: null,
      contact_preference: newClient.pref,
    };
    if (onAddClient) {
      const row = await onAddClient(payload);
      return row?.id ?? null;
    }
    const { data, error } = await supabase
      .from('clients')
      .insert({ id: crypto.randomUUID(), ...payload } as never)
      .select('id')
      .single();
    if (error) devConsole.error('[BookingFormDialog] client insert', error.message);
    return (data as { id: string } | null)?.id ?? null;
  };

  const resolvePet = async (cid: string): Promise<string | null> => {
    if (!needsNewPet) return petId || null;
    const rabies =
      newPet.rabiesMonth && newPet.rabiesYear
        ? `${newPet.rabiesYear}-${String(newPet.rabiesMonth).padStart(2, '0')}-01`
        : null;
    const payload: NewPetInput = {
      business_id: businessId,
      client_id: cid,
      name: newPet.name.trim(),
      species: newPet.species,
      breed: newPet.breed.trim() || 'Unknown',
      birth_month: newPet.birthMonth ? Number(newPet.birthMonth) : null,
      birth_year: newPet.birthYear ? Number(newPet.birthYear) : null,
      weight: newPet.weight ? Number(newPet.weight) : 0,
      color: null,
      notes: null,
      special_instructions: rabies ? `Rabies: ${rabies.slice(0, 7)}` : null,
      vaccination_status: rabies ? ('up_to_date' as const) : ('unknown' as const),
      last_vaccination_date: rabies,
      photo_url: null,
    };
    if (onAddPet) {
      const row = await onAddPet(payload);
      return row?.id ?? null;
    }
    const { data, error } = await supabase
      .from('pets')
      .insert({ id: crypto.randomUUID(), ...payload } as never)
      .select('id')
      .single();
    if (error) devConsole.error('[BookingFormDialog] pet insert', error.message);
    return (data as { id: string } | null)?.id ?? null;
  };

  const runSubmit = async () => {
    if (!businessId) {
      toast.error(t('bookingDialog.errBusiness'));
      return;
    }
    setSaving(true);
    try {
      const startMin = timeToMinutes(time);
      let staffId: string | null = groomer === ANYONE ? null : groomer;
      if (!staffId) {
        staffId = pickLeastBusyStaff({ staffIds: eligibleIds, start: startMin, duration, windowsByStaff, blocks });
      }
      const finalQuote = quoteForStaff(serviceIds, activeServices, NO_RATES, staffId);
      const endMin = Math.min(startMin + Math.max(finalQuote.duration, 15), 24 * 60 - 1);

      const cid = await resolveClient();
      if (!cid) {
        toast.error(t('bookingDialog.errSaveClient'));
        return;
      }
      const pid = await resolvePet(cid);
      if (!pid) {
        toast.error(t('bookingDialog.errSavePet'));
        return;
      }

      const [h, m] = time.split(':').map(Number);
      const local = new Date(date);
      local.setHours(h, m, 0, 0);
      const names = serviceIds
        .map((id) => activeServices.find((s) => s.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      const payload: NewAppointmentPayload = {
        client_id: cid,
        pet_id: pid,
        service_id: serviceIds[0],
        service_ids: serviceIds,
        staff_id: staffId,
        appointment_date: format(date, 'yyyy-MM-dd'),
        start_time: time,
        end_time: minutesToHHmm(endMin),
        scheduled_date: local.toISOString(),
        service_type: names,
        status: 'scheduled',
        total_price: finalQuote.price,
        price: finalQuote.price,
        notes: notes.trim() || null,
        booked_by_staff_id: await staffIdForBusinessOrNull(myStaffId, businessId),
        booking_source: 'staff',
      };

      let saved: SavedRow = null;
      if (onAddAppointment) {
        saved = await Promise.resolve(onAddAppointment(payload));
      } else {
        const { data, error } = await supabase
          .from('appointments')
          .insert({ id: crypto.randomUUID(), business_id: businessId, ...payload } as never)
          .select()
          .single();
        if (error) devConsole.error('[BookingFormDialog] appointment insert', error.message);
        saved = data;
      }
      if (!saved) {
        toast.error(t('bookingDialog.errSave'));
        return;
      }
      const who = staffId ? formatStaffNameAggregated(activeStaff.find((e) => e.id === staffId)?.name ?? '') : null;
      toast.success(
        who
          ? t('bookingDialog.savedWith', { name: who, time: formatTime12h(time) })
          : t('bookingDialog.saved', { time: formatTime12h(time) }),
      );
      onSuccess(saved);
      onOpenChange(false);
    } catch (err) {
      devConsole.error('[BookingFormDialog] submit', err);
      toast.error(t('bookingDialog.errSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (staffMayBookPast && isSlotStartInPast(date, time)) {
      setPastConfirm({ open: true, onConfirm: () => void runSubmit() });
      return;
    }
    void runSubmit();
  };

  // ---------------- render ----------------
  const petLabel = needsNewPet
    ? newPet.name.trim()
    : safePets.find((p) => p.id === petId)?.name ?? '';
  const groomerLabel =
    groomer === ANYONE
      ? t('bookingDialog.anyone')
      : formatStaffNameAggregated(activeStaff.find((e) => e.id === groomer)?.name ?? '');
  const monthNames = Array.from({ length: 12 }, (_, i) => format(new Date(2026, i, 1), 'LLLL', { locale: dateLocale }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 pb-4 pt-6">
            <DialogTitle className="text-xl">{t('bookingDialog.title')}</DialogTitle>
            <DialogDescription>{t('bookingDialog.subtitle')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-5">
              {/* 1. Client & pet */}
              <section>
                <SectionTitle n={1}>{t('bookingDialog.stepClient')}</SectionTitle>
                <div className="mb-3 inline-flex rounded-lg bg-muted p-1 text-sm">
                  {(['existing', 'new'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setClientMode(m);
                        setErrors({});
                        if (m === 'new') {
                          setClientId('');
                          setPetId('');
                        }
                      }}
                      className={cn(
                        'rounded-md px-3 py-1.5 font-medium transition-colors',
                        clientMode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {m === 'existing' ? t('bookingDialog.existingClient') : t('bookingDialog.newClient')}
                    </button>
                  ))}
                </div>

                {clientMode === 'existing' ? (
                  <div ref={clientBoxRef} className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className={cn('h-10 pl-9', field)}
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setClientListOpen(true);
                        if (clientId) setClientId('');
                      }}
                      onFocus={() => setClientListOpen(true)}
                      placeholder={t('bookingDialog.searchClient')}
                      aria-label={t('bookingDialog.searchClient')}
                      autoComplete="off"
                    />
                    {clientListOpen ? (
                      <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-md">
                        {filteredClients.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">{t('bookingDialog.noClientMatch')}</div>
                        ) : (
                          filteredClients.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => pickClient(c)}
                            >
                              <span className="font-medium">
                                {c.first_name} {c.last_name}
                              </span>
                              <span className="text-xs text-muted-foreground">{formatPhoneNumber(c.phone || '')}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                    {errors.client ? <p className="mt-1 text-sm text-destructive">{errors.client}</p> : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Input className={cn('h-10', field)} placeholder={t('bookingDialog.firstName')} aria-label={t('bookingDialog.firstName')} value={newClient.first} onChange={(e) => setNewClient((p) => ({ ...p, first: e.target.value }))} />
                      {errors.first ? <p className="mt-1 text-sm text-destructive">{errors.first}</p> : null}
                    </div>
                    <div>
                      <Input className={cn('h-10', field)} placeholder={t('bookingDialog.lastName')} aria-label={t('bookingDialog.lastName')} value={newClient.last} onChange={(e) => setNewClient((p) => ({ ...p, last: e.target.value }))} />
                      {errors.last ? <p className="mt-1 text-sm text-destructive">{errors.last}</p> : null}
                    </div>
                    <div>
                      <Input
                        className={cn('h-10', field)}
                        inputMode="tel"
                        placeholder={t('bookingDialog.phone')}
                        aria-label={t('bookingDialog.phone')}
                        value={formatPhoneNumber(newClient.phone)}
                        onChange={(e) => setNewClient((p) => ({ ...p, phone: unformatPhoneNumber(e.target.value).slice(0, 10) }))}
                      />
                      {errors.phone ? <p className="mt-1 text-sm text-destructive">{errors.phone}</p> : null}
                    </div>
                    <div>
                      <Input className={cn('h-10', field)} type="email" placeholder={t('bookingDialog.email')} aria-label={t('bookingDialog.email')} value={newClient.email} onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))} />
                      {errors.email ? <p className="mt-1 text-sm text-destructive">{errors.email}</p> : null}
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="mb-1.5 block text-xs text-muted-foreground">{t('bookingDialog.contactPref')}</Label>
                      <div className="flex flex-wrap gap-2">
                        {(['email', 'sms', 'none'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNewClient((c) => ({ ...c, pref: p }))}
                            className={cn(
                              'rounded-full border px-3 py-1 text-sm',
                              newClient.pref === p ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {t(`bookingDialog.pref_${p}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pet */}
                {(clientId || clientMode === 'new') && (
                  <div className="mt-4">
                    <Label className="mb-2 block text-sm font-medium">{t('bookingDialog.pet')}</Label>
                    {!needsNewPet || (creatingPet && clientPets.length > 0) ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {clientPets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setPetId(p.id);
                              setCreatingPet(false);
                              setErrors((e) => ({ ...e, pet: '' }));
                            }}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                              !creatingPet && petId === p.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted',
                            )}
                          >
                            {!creatingPet && petId === p.id ? <Check className="h-4 w-4 text-primary" /> : null}
                            <span className="font-medium">{p.name}</span>
                            {p.breed ? <span className="text-muted-foreground">· {p.breed}</span> : null}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setCreatingPet(true);
                            setPetId('');
                          }}
                          className={cn(
                            'flex items-center gap-1 rounded-lg border border-dashed px-3 py-2 text-sm',
                            creatingPet ? 'border-primary bg-primary/10' : 'border-border text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <Plus className="h-4 w-4" /> {t('bookingDialog.newPet')}
                        </button>
                      </div>
                    ) : null}
                    {errors.pet ? <p className="mb-2 text-sm text-destructive">{errors.pet}</p> : null}

                    {needsNewPet ? (
                      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
                          <div>
                            <Input className={cn('h-10', field)} placeholder={t('bookingDialog.petName')} aria-label={t('bookingDialog.petName')} value={newPet.name} onChange={(e) => setNewPet((p) => ({ ...p, name: e.target.value }))} />
                            {errors.petName ? <p className="mt-1 text-sm text-destructive">{errors.petName}</p> : null}
                          </div>
                          <Select value={newPet.species} onValueChange={(v: 'dog' | 'cat' | 'other') => setNewPet((p) => ({ ...p, species: v, breed: '' }))}>
                            <SelectTrigger className={cn('h-10', field)} aria-label={t('bookingDialog.species')}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dog">{t('bookingDialog.dog')}</SelectItem>
                              <SelectItem value="cat">{t('bookingDialog.cat')}</SelectItem>
                              <SelectItem value="other">{t('bookingDialog.otherSpecies')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
                          {newPet.species === 'other' ? (
                            <Input className={cn('h-10', field)} placeholder={t('bookingDialog.breed')} aria-label={t('bookingDialog.breed')} value={newPet.breed} onChange={(e) => setNewPet((p) => ({ ...p, breed: e.target.value }))} />
                          ) : (
                            <Select value={newPet.breed || undefined} onValueChange={(v) => setNewPet((p) => ({ ...p, breed: v }))}>
                              <SelectTrigger className={cn('h-10', field)} aria-label={t('bookingDialog.breed')}>
                                <SelectValue placeholder={t('bookingDialog.breed')} />
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                {(newPet.species === 'dog' ? DOG_BREEDS : CAT_BREEDS).map((b) => (
                                  <SelectItem key={b} value={b}>
                                    {b}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Input className={cn('h-10', field)} inputMode="numeric" placeholder={t('bookingDialog.weight')} aria-label={t('bookingDialog.weight')} value={newPet.weight} onChange={(e) => setNewPet((p) => ({ ...p, weight: e.target.value.replace(/\D/g, '').slice(0, 3) }))} />
                        </div>
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                            <ChevronDown className="h-4 w-4" /> {t('bookingDialog.moreDetails')}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-3 space-y-3">
                            <div>
                              <Label className="mb-1 block text-xs text-muted-foreground">{t('bookingDialog.birthday')}</Label>
                              <div className="flex gap-2">
                                <Select value={newPet.birthMonth || undefined} onValueChange={(v) => setNewPet((p) => ({ ...p, birthMonth: v }))}>
                                  <SelectTrigger className={cn('h-10 w-40 capitalize', field)}>
                                    <SelectValue placeholder={t('bookingDialog.month')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {monthNames.map((n, i) => (
                                      <SelectItem key={n} value={String(i + 1)} className="capitalize">
                                        {n}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input className={cn('h-10 w-24', field)} inputMode="numeric" placeholder={t('bookingDialog.year')} value={newPet.birthYear} onChange={(e) => setNewPet((p) => ({ ...p, birthYear: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                              </div>
                              {errors.petBirth ? <p className="mt-1 text-sm text-destructive">{errors.petBirth}</p> : null}
                            </div>
                            <div>
                              <Label className="mb-1 block text-xs text-muted-foreground">{t('bookingDialog.rabies')}</Label>
                              <div className="flex gap-2">
                                <Select value={newPet.rabiesMonth || undefined} onValueChange={(v) => setNewPet((p) => ({ ...p, rabiesMonth: v }))}>
                                  <SelectTrigger className={cn('h-10 w-40 capitalize', field)}>
                                    <SelectValue placeholder={t('bookingDialog.month')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {monthNames.map((n, i) => (
                                      <SelectItem key={n} value={String(i + 1)} className="capitalize">
                                        {n}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input className={cn('h-10 w-24', field)} inputMode="numeric" placeholder={t('bookingDialog.year')} value={newPet.rabiesYear} onChange={(e) => setNewPet((p) => ({ ...p, rabiesYear: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              {/* 2. Services */}
              <section>
                <SectionTitle n={2}>{t('bookingDialog.stepServices')}</SectionTitle>
                {activeServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('bookingDialog.noServices')}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {activeServices.map((s) => {
                      const on = serviceIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleService(s.id)}
                          aria-pressed={on}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                            on ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                              on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50',
                            )}
                          >
                            {on ? <Check className="h-3.5 w-3.5" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{s.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {t('bookingDialog.minutes', { n: s.duration_minutes })} · ${Number(s.price).toFixed(2)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.services ? <p className="mt-2 text-sm text-destructive">{errors.services}</p> : null}
              </section>

              {/* 3. Groomer */}
              <section>
                <SectionTitle n={3}>{t('bookingDialog.stepGroomer')}</SectionTitle>
                {serviceIds.length > 0 && eligibleStaff.length === 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">{t('bookingDialog.noGroomerOffers')}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setGroomer(ANYONE)}
                      aria-pressed={groomer === ANYONE}
                      className={cn(
                        'flex min-h-[3.25rem] items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                        groomer === ANYONE ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60',
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </span>
                      <span className="min-w-0 text-sm font-medium leading-tight">{t('bookingDialog.anyone')}</span>
                    </button>
                    {(serviceIds.length ? eligibleStaff : activeStaff).map((e) => {
                      const name = formatStaffNameAggregated(e.name);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setGroomer(e.id)}
                          aria-pressed={groomer === e.id}
                          className={cn(
                            'flex min-h-[3.25rem] items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                            groomer === e.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60',
                          )}
                        >
                          <StaffAvatar name={e.name} photoUrl={showPhotos ? e.photo_url : null} />
                          <span className="min-w-0 truncate text-sm font-medium">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 4. Date & time */}
              <section>
                <SectionTitle n={4}>{t('bookingDialog.stepTime')}</SectionTitle>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goWeek(-1)}
                    disabled={!canGoBackWeek}
                    aria-label={t('bookingDialog.prevWeek')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-0 flex-1 text-center text-sm font-medium capitalize">
                    {format(weekStart, 'd MMM', { locale: dateLocale })} – {format(weekEnd, 'd MMM yyyy', { locale: dateLocale })}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goWeek(1)}
                    aria-label={t('bookingDialog.nextWeek')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label={t('bookingDialog.pickDate')}>
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={date}
                        defaultMonth={date}
                        locale={dateLocale}
                        onSelect={(d) => d && pickDate(d)}
                        disabled={isDayDisabled}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {isSameDay(date, new Date()) ? null : (
                    <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => pickDate(new Date())}>
                      {t('appointments.today')}
                    </Button>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1.5">
                  {weekDays.map((d) => {
                    const key = format(d, 'yyyy-MM-dd');
                    const disabled = isDayDisabled(d);
                    const selected = isSameDay(d, date);
                    const room = !disabled && serviceIds.length > 0 && dayHasRoom[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={disabled}
                        onClick={() => pickDate(d)}
                        aria-pressed={selected}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-lg border py-1.5 transition-colors',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/50 hover:bg-primary/5',
                          disabled && 'cursor-not-allowed border-dashed opacity-40 hover:border-border hover:bg-transparent',
                        )}
                      >
                        <span className={cn('text-[11px] uppercase', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          {format(d, 'EEE', { locale: dateLocale })}
                        </span>
                        <span className="text-base font-semibold leading-none tabular-nums">{format(d, 'd')}</span>
                        <span
                          className={cn(
                            'mt-0.5 h-1.5 w-1.5 rounded-full',
                            room ? (selected ? 'bg-primary-foreground' : 'bg-emerald-500') : 'bg-transparent',
                          )}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3">
                  {serviceIds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('bookingDialog.pickServicesFirst')}</p>
                  ) : slotGroups.length === 0 ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      <span>
                        {groomer === ANYONE
                          ? t('bookingDialog.noSlots')
                          : t('bookingDialog.groomerNotAvailable', { name: groomerLabel })}
                      </span>
                      {nextAvailable ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => pickDate(nextAvailable)}>
                          {t('bookingDialog.nextAvailableOn', {
                            date: format(nextAvailable, 'EEEE d MMM', { locale: dateLocale }).replace(/^./, (c) => c.toUpperCase()),
                          })}
                        </Button>
                      ) : (
                        <span>{t('bookingDialog.noSlotsSoon')}</span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {slotGroups.map((g) => (
                        <div key={g.key}>
                          <div className="mb-1.5 text-xs font-medium text-muted-foreground">{g.label}</div>
                          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                            {g.items.map((s) => {
                              const past = isSlotStartInPast(date, s);
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => {
                                    setTime(s);
                                    setErrors((e) => ({ ...e, time: '' }));
                                  }}
                                  title={past ? t('booking.pastTimeHoverHint') : undefined}
                                  className={cn(
                                    'rounded-md border px-2 py-1.5 text-sm tabular-nums transition-colors',
                                    time === s
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-border hover:border-primary/50 hover:bg-primary/5',
                                    past && time !== s && 'text-muted-foreground',
                                  )}
                                >
                                  {formatTime12h(s)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {errors.time ? <p className="mt-2 text-sm text-destructive">{errors.time}</p> : null}
                </div>
              </section>

              {/* 5. Notes */}
              <section>
                <SectionTitle n={5}>{t('bookingDialog.stepNotes')}</SectionTitle>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('bookingDialog.notesPlaceholder')}
                  className={cn('min-h-[72px]', field)}
                  aria-label={t('bookingDialog.stepNotes')}
                  maxLength={1000}
                />
              </section>
            </div>

            {/* Summary bar */}
            <div className="flex flex-col gap-3 border-t bg-muted/30 px-6 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-medium">
                  {[petLabel, serviceIds.length ? t('bookingDialog.servicesCount', { n: serviceIds.length }) : null, groomerLabel]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="truncate text-muted-foreground">
                  <span className="capitalize">{format(date, 'EEE d MMM', { locale: dateLocale })}</span>
                  {time ? ` · ${formatTime12h(time)}` : ''}
                  {serviceIds.length ? ` · ${t('bookingDialog.minutes', { n: duration })}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{t('bookingDialog.total')}</div>
                  <div className="text-lg font-semibold tabular-nums">${quote.price.toFixed(2)}</div>
                </div>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t('bookingDialog.book')}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <PastBookingConfirmDialog
        open={pastConfirm.open}
        onOpenChange={(o) => setPastConfirm((p) => ({ ...p, open: o }))}
        title={t('booking.pastConfirmTitle')}
        description={t('booking.pastTimeConfirm')}
        onConfirm={pastConfirm.onConfirm}
      />
    </>
  );
}
