import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Dog,
  Check,
  Plus,
  UserCircle,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfDay, setHours, setMinutes, addDays, isSameDay } from 'date-fns';
import { isSlotStartInPast, isPastCalendarDay } from '@/lib/bookingPastSlots';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { DOG_BREEDS } from '@/lib/dogBreeds';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { BusinessClient, Pet, Service } from '@/hooks/useBusinessData';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { ensureAppointmentServiceIds } from '@/lib/appointmentServiceResolution';
import { staffIdForBusinessOrNull } from '@/lib/staffFkGuard';
import { t, getLanguage, type Language } from '@/lib/translations';
import { devConsole } from '@/lib/clientDebug';
import {
  parseBusinessHours,
  dateToDayKey,
  appointmentStartSlotsForDuration,
  timeToMinutes,
  minutesToHHmm,
  isBusinessClosedOnDate,
  findFirstOpenDayWithSlotsFrom,
} from '@/lib/businessHours';
import {
  appointmentBlockEndMinutes,
  slotFreeForAnyone,
  slotFreeForStaff,
  type DayAppointmentRow,
} from '@/lib/bookingAvailability';
import { useSettings, useEmployees } from '@/hooks/useSupabaseData';
import { PastBookingConfirmDialog } from '@/components/PastBookingConfirmDialog';

/** Solid outline so fields read clearly on glass / tinted dialog backgrounds. */
const bookingFieldChrome =
  'rounded-lg border-2 border-solid border-border bg-background shadow-sm dark:bg-background';

const CAT_BREEDS = [
  'Mixed Breed - Shorthair',
  'Mixed Breed - Longhair',
  'Abyssinian',
  'American Shorthair',
  'Bengal',
  'Birman',
  'British Shorthair',
  'Burmese',
  'Devon Rex',
  'Exotic Shorthair',
  'Himalayan',
  'Maine Coon',
  'Norwegian Forest Cat',
  'Persian',
  'Ragdoll',
  'Russian Blue',
  'Scottish Fold',
  'Siamese',
  'Siberian',
  'Sphynx',
  'Other',
];

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function monthNamesForLang(lang: Language): string[] {
  return lang === 'es' ? MONTH_NAMES_ES : MONTH_NAMES_EN;
}

function bookingPlaceholders(lang: Language) {
  const es = lang === 'es';
  return {
    clientSearch: es ? 'Nombre o número de teléfono' : 'Name or phone number',
    firstName: es ? 'Nombre *' : 'First name *',
    lastName: es ? 'Apellido *' : 'Last name *',
    email: es ? 'Correo electrónico' : 'Email',
    phoneGroup: es ? 'Teléfono (requerido)' : 'Phone (required)',
    petName: es ? 'Nombre de la mascota *' : 'Pet name *',
    breedOther: es ? 'Raza o cruce' : 'Breed or mix',
    breedSelect: es ? 'Elegir raza' : 'Choose breed',
    selectMonth: es ? 'Seleccionar mes' : 'Select month',
    year: es ? 'Año' : 'Year',
    ageYears: es ? 'Edad en años' : 'Age in years',
    weight: es ? 'Peso (lb)' : 'Weight (lbs)',
    petDetailsGroup: es ? 'Características' : 'Characteristics',
    petAgeGroup: es ? 'Cumpleaños o edad' : 'Birthday or age',
    vacSubsection: es ? 'Vacunas' : 'Vaccination',
    addVaccine: es ? 'Agregar otra vacuna' : 'Add another vaccine',
    vaccineType: es ? 'Tipo de vacuna' : 'Vaccine type',
    rabiesLabel: es ? 'Rabia' : 'Rabies',
    notes: es ? 'Notas del turno…' : 'Appointment notes…',
    species: es ? 'Especie' : 'Species',
    selectPet: es ? 'Seleccionar mascota' : 'Select pet',
    speciesDog: es ? 'Perro' : 'Dog',
    speciesCat: es ? 'Gato' : 'Cat',
    speciesOther: es ? 'Otro' : 'Other',
  };
}

function petNameBreedLabel(pet: Pet): string {
  const b = pet.breed?.trim();
  return b ? `${pet.name} - ${b}` : pet.name;
}

function formatTime12H(time24: string): string {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function isValidUsPhone(digits: string): boolean {
  return unformatPhoneNumber(digits).length === 10;
}

function newVaccineRowId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type PetVaccineRowForm = { id: string; name: string; month: string; year: string };

function defaultVaccineRows(): PetVaccineRowForm[] {
  return [{ id: newVaccineRowId(), name: 'Rabies', month: '', year: '' }];
}

function buildVaccineSummary(rows: PetVaccineRowForm[], monthNames: string[]): string {
  const parts: string[] = [];
  const maxY = new Date().getFullYear() + 1;
  for (const row of rows) {
    const label = row.name.trim();
    const m = parseInt(row.month, 10);
    const y = parseInt(row.year, 10);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= maxY) {
      parts.push(`${label || 'Vaccine'}: ${monthNames[m - 1]} ${y}`);
    } else if (label || row.month.trim() || row.year.trim()) {
      parts.push(
        `${label || 'Vaccine'}${row.month || row.year ? ` (${row.month || '?'}/${row.year || '?'})` : ''}`,
      );
    }
  }
  return parts.join('; ');
}

function latestVaccineIsoDate(rows: PetVaccineRowForm[]): string | null {
  let best: { y: number; m: number } | null = null;
  const maxY = new Date().getFullYear() + 1;
  for (const r of rows) {
    const m = parseInt(r.month, 10);
    const y = parseInt(r.year, 10);
    if (m < 1 || m > 12 || y < 1900 || y > maxY) continue;
    if (!best || y > best.y || (y === best.y && m > best.m)) best = { y, m };
  }
  if (!best) return null;
  return `${best.y}-${String(best.m).padStart(2, '0')}-01`;
}

function UsPhoneFields({
  value,
  onChange,
  error,
  disabled,
  groupAriaLabel,
}: {
  value: string;
  onChange: (digits10: string) => void;
  error?: string;
  disabled?: boolean;
  groupAriaLabel?: string;
}) {
  const d = unformatPhoneNumber(value).slice(0, 10);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  const refB = useRef<HTMLInputElement>(null);
  const refC = useRef<HTMLInputElement>(null);

  const merge = (nextA: string, nextB: string, nextC: string) => {
    onChange((nextA + nextB + nextC).slice(0, 10));
  };

  const phoneInputClass =
    'h-10 shrink-0 rounded-md border-2 border-border bg-background px-1 text-center text-base tabular-nums shadow-sm focus-visible:border-ring focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none';

  return (
    <div className="space-y-1" role="group" aria-label={groupAriaLabel}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-1 gap-y-2 rounded-lg px-3 py-2.5 font-mono text-base text-foreground tabular-nums shadow-sm',
          bookingFieldChrome,
        )}
      >
        <span className="select-none text-muted-foreground">(</span>
        <Input
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          className={cn(phoneInputClass, 'w-[4.5rem] tracking-widest')}
          maxLength={3}
          value={a}
          placeholder={a ? undefined : '_ _ _'}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '').slice(0, 3);
            merge(raw, b, c);
            if (raw.length >= 3) refB.current?.focus();
          }}
          aria-label="Area code (3 digits)"
        />
        <span className="select-none text-muted-foreground">)</span>
        <Input
          ref={refB}
          inputMode="numeric"
          disabled={disabled}
          className={cn(phoneInputClass, 'ml-1 w-[4.5rem] tracking-widest')}
          maxLength={3}
          value={b}
          placeholder={b ? undefined : '_ _ _'}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '').slice(0, 3);
            merge(a, raw, c);
            if (raw.length >= 3) refC.current?.focus();
          }}
          aria-label="Phone prefix (3 digits)"
        />
        <span className="select-none px-0.5 text-muted-foreground">-</span>
        <Input
          ref={refC}
          inputMode="numeric"
          disabled={disabled}
          className={cn(phoneInputClass, 'w-[6rem] tracking-widest')}
          maxLength={4}
          value={c}
          placeholder={c ? undefined : '_ _ _ _'}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
            merge(a, b, raw);
          }}
          aria-label="Phone line (4 digits)"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients?: BusinessClient[];
  pets: Pet[];
  services: Service[];
  appointments: any[];
  onSuccess: (newAppointment?: any) => void;
  onAddAppointment?: (appointment: any) => void;
  /** When opening the dialog, pre-select this staff member (must be active). */
  preselectedStaffId?: string | null;
  /** When opening the dialog, set the visit date (local calendar day). */
  preselectedDate?: Date | null;
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
  preselectedStaffId = null,
  preselectedDate = null,
}: BookingFormDialogProps) {
  const businessId = useBusinessId();
  const { staffId, role } = useAuth();
  /** Staff can pick greyed past dates/times to log visits after the fact (not public self-serve). */
  const staffMayBookPast =
    role === 'employee' || role === 'manager' || role === 'super_admin';
  const { settings } = useSettings();
  const { employees } = useEmployees();

  const [uiLang, setUiLang] = useState<Language>(() => getLanguage());
  useEffect(() => {
    const onLang = () => setUiLang(getLanguage());
    window.addEventListener('languagechange', onLang);
    return () => window.removeEventListener('languagechange', onLang);
  }, []);

  const bc = useMemo(() => bookingPlaceholders(uiLang), [uiLang]);
  const monthNames = useMemo(() => monthNamesForLang(uiLang), [uiLang]);

  const safeClients: BusinessClient[] = Array.isArray(clients) ? clients : [];
  const safePets = Array.isArray(pets) ? pets : [];
  const safeServices = Array.isArray(services) ? services : [];

  const hoursPerDay = useMemo(
    () => parseBusinessHours(settings.business_hours),
    [settings.business_hours],
  );

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const [createNewPet, setCreateNewPet] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    clientFirstName: '',
    clientLastName: '',
    clientEmail: '',
    clientPhoneDigits: '',
    petId: '',
    petName: '',
    petBreed: '',
    petSpecies: 'dog' as 'dog' | 'cat' | 'other',
    petAgeMode: 'birthday' as 'age' | 'birthday',
    petAgeYears: '',
    petBirthMonth: '',
    petBirthYear: '',
    petWeight: '',
    vaccineRows: defaultVaccineRows(),
    services: [] as string[],
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [dayAppointmentRows, setDayAppointmentRows] = useState<DayAppointmentRow[]>([]);
  const [preferredStaffId, setPreferredStaffId] = useState<'anyone' | string>('anyone');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const autoDayJumpRef = useRef(0);
  /** User already acknowledged past calendar day via confirm (avoids duplicate submit prompt). */
  const warnedPastDateRef = useRef(false);
  /** User already acknowledged today's past time slot via confirm. */
  const warnedPastTimeRef = useRef(false);

  const [pastConfirm, setPastConfirm] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const resetForm = useCallback(() => {
    setFormData({
      clientId: '',
      clientFirstName: '',
      clientLastName: '',
      clientEmail: '',
      clientPhoneDigits: '',
      petId: '',
      petName: '',
      petBreed: '',
      petSpecies: 'dog',
      petAgeMode: 'birthday',
      petAgeYears: '',
      petBirthMonth: '',
      petBirthYear: '',
      petWeight: '',
      vaccineRows: defaultVaccineRows(),
      services: [],
      notes: '',
    });
    setSelectedDate(new Date());
    setSelectedTime('');
    setClientMode('existing');
    setClientSearch('');
    setClientSearchOpen(false);
    setCreateNewPet(false);
    setPreferredStaffId('anyone');
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  useEffect(() => {
    if (!clientSearchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setClientSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [clientSearchOpen]);

  useEffect(() => {
    if (!selectedDate || !open || !businessId) {
      setDayAppointmentRows([]);
      return;
    }
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    void (async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('staff_id, start_time, end_time, service_id, status')
        .eq('business_id', businessId)
        .eq('appointment_date', dateStr);
      if (error) {
        devConsole.warn('[BookingFormDialog] day appointments fetch:', error.message);
        setDayAppointmentRows([]);
        return;
      }
      setDayAppointmentRows((data ?? []) as DayAppointmentRow[]);
    })();
  }, [selectedDate, open, businessId]);

  const activeStaffIds = useMemo(
    () => employees.filter((e) => e.status === 'active').map((e) => e.id),
    [employees],
  );

  useEffect(() => {
    if (!open) return;
    if (preselectedDate && !Number.isNaN(preselectedDate.getTime())) {
      setSelectedDate(startOfDay(preselectedDate));
    }
  }, [open, preselectedDate]);

  useEffect(() => {
    if (!open || !preselectedStaffId) return;
    if (!activeStaffIds.includes(preselectedStaffId)) return;
    setPreferredStaffId(preselectedStaffId);
  }, [open, preselectedStaffId, activeStaffIds]);

  const serviceById = useMemo(
    () => new Map(safeServices.map((s) => [s.id, s])),
    [safeServices],
  );

  const dayBlocks = useMemo(() => {
    const blocks: { staffId: string | null; start: number; end: number }[] = [];
    for (const row of dayAppointmentRows) {
      const b = appointmentBlockEndMinutes(row, serviceById);
      if (b) blocks.push(b);
    }
    return blocks;
  }, [dayAppointmentRows, serviceById]);

  const bookingDurationMinutes = useMemo(() => {
    if (formData.services.length === 0) return 0;
    let sum = 0;
    for (const name of formData.services) {
      const s = safeServices.find((x) => x.name === name);
      sum += s?.duration_minutes ?? 60;
    }
    return Math.max(30, sum);
  }, [formData.services, safeServices]);

  const dayHours = useMemo(() => {
    if (!selectedDate) return null;
    return hoursPerDay[dateToDayKey(selectedDate)];
  }, [selectedDate, hoursPerDay]);

  const candidateSlots = useMemo(() => {
    if (!dayHours || bookingDurationMinutes <= 0) return [];
    return appointmentStartSlotsForDuration(dayHours, bookingDurationMinutes);
  }, [dayHours, bookingDurationMinutes]);

  const slotRows = useMemo(() => {
    return candidateSlots.map((hhmm) => {
      const sm = timeToMinutes(hhmm);
      const available =
        preferredStaffId === 'anyone'
          ? slotFreeForAnyone(sm, bookingDurationMinutes, activeStaffIds, dayBlocks)
          : slotFreeForStaff(sm, bookingDurationMinutes, preferredStaffId, dayBlocks);
      const isPast = selectedDate ? isSlotStartInPast(selectedDate, hhmm) : false;
      return { hhmm, available, isPast };
    });
  }, [candidateSlots, bookingDurationMinutes, preferredStaffId, activeStaffIds, dayBlocks, selectedDate]);

  const firstSelectableHhmm = useMemo(() => {
    const row = slotRows.find((r) => r.available && (!r.isPast || staffMayBookPast));
    return row?.hhmm ?? null;
  }, [slotRows, staffMayBookPast]);

  const isClosedDay = dayHours?.closed === true;

  useEffect(() => {
    if (!open) autoDayJumpRef.current = 0;
    else {
      warnedPastDateRef.current = false;
      warnedPastTimeRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !businessId) return;
    if (formData.services.length === 0 || bookingDurationMinutes <= 0) return;
    if (!selectedDate) return;
    if (autoDayJumpRef.current > 90) return;

    const closed = Boolean(dayHours?.closed);
    const noSlotsForDuration = candidateSlots.length === 0;
    const hasSelectable = slotRows.some(
      (r) => r.available && (!r.isPast || staffMayBookPast),
    );

    if (!closed && !noSlotsForDuration && hasSelectable) return;

    const next =
      closed || noSlotsForDuration
        ? findFirstOpenDayWithSlotsFrom(
            startOfDay(selectedDate),
            hoursPerDay,
            bookingDurationMinutes,
          )
        : findFirstOpenDayWithSlotsFrom(
            addDays(startOfDay(selectedDate), 1),
            hoursPerDay,
            bookingDurationMinutes,
          );

    if (!next) {
      autoDayJumpRef.current = 100;
      return;
    }
    if (!isSameDay(startOfDay(next), startOfDay(selectedDate))) {
      autoDayJumpRef.current += 1;
      setSelectedDate(next);
    }
  }, [
    open,
    businessId,
    formData.services.length,
    bookingDurationMinutes,
    selectedDate,
    dayHours?.closed,
    candidateSlots.length,
    slotRows,
    staffMayBookPast,
    hoursPerDay,
  ]);
  useEffect(() => {
    if (!selectedDate || isClosedDay || candidateSlots.length === 0 || bookingDurationMinutes <= 0) {
      setSelectedTime('');
      return;
    }
    if (selectedTime) {
      const row = slotRows.find((r) => r.hhmm === selectedTime);
      if (!row || !row.available) setSelectedTime('');
      else if (row.isPast && !staffMayBookPast) setSelectedTime('');
    }
  }, [
    selectedDate,
    isClosedDay,
    candidateSlots.length,
    bookingDurationMinutes,
    selectedTime,
    slotRows,
    staffMayBookPast,
  ]);

  const clientPets = useMemo(() => {
    if (!formData.clientId) return [];
    return safePets.filter((p) => p.client_id === formData.clientId);
  }, [formData.clientId, safePets]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return safeClients.slice(0, 8);
    return safeClients.filter((c) => {
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      const phone = unformatPhoneNumber(c.phone || '');
      const qd = q.replace(/\D/g, '');
      return name.includes(q) || (qd.length >= 3 && phone.includes(qd));
    });
  }, [clientSearch, safeClients]);

  const showPetPicker =
    clientMode === 'existing' &&
    !!formData.clientId &&
    clientPets.length > 0 &&
    !createNewPet;

  const showNewPetForm =
    clientMode === 'new' ||
    !formData.clientId ||
    (clientMode === 'existing' && !!formData.clientId && (clientPets.length === 0 || createNewPet));

  useEffect(() => {
    if (!showPetPicker || createNewPet) return;
    if (clientPets.length > 0 && !formData.petId) {
      const first = clientPets[0];
      setFormData((prev) => ({
        ...prev,
        petId: first.id,
        petName: first.name,
        petBreed: first.breed || '',
        petSpecies: first.species,
      }));
    }
  }, [showPetPicker, createNewPet, clientPets, formData.petId]);

  const breedOptionsForSpecies = useMemo(() => {
    if (formData.petSpecies === 'dog') return DOG_BREEDS;
    if (formData.petSpecies === 'cat') return CAT_BREEDS;
    return [];
  }, [formData.petSpecies]);

  const handleServiceToggle = (serviceName: string) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.includes(serviceName)
        ? prev.services.filter((s) => s !== serviceName)
        : [...prev.services, serviceName],
    }));
    setFieldErrors((e) => ({ ...e, services: '' }));
  };

  const selectExistingClient = (c: BusinessClient) => {
    setFormData((prev) => ({
      ...prev,
      clientId: c.id,
      clientFirstName: c.first_name,
      clientLastName: c.last_name,
      clientEmail: c.email || '',
      clientPhoneDigits: unformatPhoneNumber(c.phone || ''),
      petId: '',
      petName: '',
      petBreed: '',
    }));
    setClientSearch(`${c.first_name} ${c.last_name}`);
    setClientSearchOpen(false);
    setCreateNewPet(false);
  };

  const handlePetChange = (petId: string) => {
    const pet = safePets.find((p) => p.id === petId);
    if (pet) {
      setFormData((prev) => ({
        ...prev,
        petId,
        petName: pet.name,
        petBreed: pet.breed || '',
        petSpecies: pet.species,
      }));
    }
  };

  const handleBookingDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      warnedPastDateRef.current = false;
      return;
    }
    if (staffMayBookPast && isPastCalendarDay(date)) {
      setPastConfirm({
        open: true,
        title: t('booking.pastConfirmTitle'),
        description: t('booking.pastDateConfirm'),
        onConfirm: () => {
          warnedPastDateRef.current = true;
          warnedPastTimeRef.current = false;
          setSelectedDate(date);
        },
      });
      return;
    }
    warnedPastDateRef.current = false;
    setSelectedDate(date);
  };

  const handleBookingTimeSelect = (hhmm: string) => {
    if (!selectedDate) {
      setSelectedTime(hhmm);
      return;
    }
    const slotPast = isSlotStartInPast(selectedDate, hhmm);
    if (staffMayBookPast && !isPastCalendarDay(selectedDate) && slotPast) {
      setPastConfirm({
        open: true,
        title: t('booking.pastConfirmTitle'),
        description: t('booking.pastTimeSlotConfirm'),
        onConfirm: () => {
          warnedPastTimeRef.current = true;
          setSelectedTime(hhmm);
        },
      });
      return;
    }
    if (!slotPast) {
      warnedPastTimeRef.current = false;
    }
    setSelectedTime(hhmm);
  };

  const validate = (): boolean => {
    const err: Record<string, string> = {};

    if (!selectedDate) err.date = 'Date is required.';
    if (!selectedTime) err.time = 'Time is required.';
    else {
      const slot = slotRows.find((r) => r.hhmm === selectedTime);
      if (!slot?.available) err.time = 'Choose an available time slot.';
      else if (slot.isPast && !staffMayBookPast) err.time = 'Choose a future time slot.';
    }
    if (isClosedDay) err.time = 'Business is closed on this date.';

    if (clientMode === 'existing') {
      if (!formData.clientId) err.client = 'Select a client.';
    } else {
      if (!formData.clientFirstName.trim()) err.clientFirstName = 'Required.';
      if (!formData.clientLastName.trim()) err.clientLastName = 'Required.';
      if (!isValidUsPhone(formData.clientPhoneDigits)) err.clientPhone = 'Enter a valid 10-digit US phone number.';
    }

    if (showNewPetForm) {
      if (!formData.petName.trim()) err.petName = 'Required.';
      if (!formData.petBreed.trim()) err.petBreed = 'Choose a breed.';
      if (formData.petAgeMode === 'birthday') {
        const m = parseInt(formData.petBirthMonth, 10);
        const y = parseInt(formData.petBirthYear, 10);
        if (!m || m < 1 || m > 12) err.petBirth = 'Valid birth month required.';
        if (!y || y < 1900 || y > new Date().getFullYear()) err.petBirth = 'Valid birth year required.';
      } else {
        const y = formData.petAgeYears.trim();
        if (!y || !/^\d+$/.test(y)) err.petAge = 'Enter age in whole years.';
        else if (parseInt(y, 10) > 50) err.petAge = 'Enter a realistic age in years.';
      }
    } else if (!formData.petId) {
      err.pet = 'Select a pet.';
    }

    if (formData.services.length === 0) {
      err.services = 'Please select at least one service.';
    }

    setFieldErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const runSubmit = async () => {
    if (!businessId) {
      alert('Business not loaded. Please refresh and try again.');
      return;
    }

    setLoading(true);
    try {
      let clientId = formData.clientId;

      if (clientMode === 'new') {
        const phoneDigits = formData.clientPhoneDigits;
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            first_name: formData.clientFirstName.trim(),
            last_name: formData.clientLastName.trim(),
            email: formData.clientEmail.trim() || null,
            phone: phoneDigits,
            address: null,
          })
          .select()
          .single();

        if (newClient) clientId = (newClient as { id: string }).id;
      }

      if (!clientId) {
        alert('Could not resolve client.');
        setLoading(false);
        return;
      }

      let petId = formData.petId;
      if (showNewPetForm) {
        const weightNum =
          formData.petWeight.trim() === '' ? null : parseFloat(formData.petWeight);
        const w =
          weightNum != null && !Number.isNaN(weightNum) ? weightNum : null;

        let birthMonth: number | null = null;
        let birthYear: number | null = null;
        let notesParts: string[] = [];
        if (formData.petAgeMode === 'birthday') {
          birthMonth = parseInt(formData.petBirthMonth, 10);
          birthYear = parseInt(formData.petBirthYear, 10);
        } else {
          const y = formData.petAgeYears.trim();
          if (y) notesParts.push(`Approx. age: ${y} years`);
        }
        const vaccineSummary = buildVaccineSummary(formData.vaccineRows, monthNames);
        if (vaccineSummary) {
          notesParts.push(`Vaccination: ${vaccineSummary}`);
        }
        const lastVac = latestVaccineIsoDate(formData.vaccineRows);

        const { data: newPet } = await supabase
          .from('pets')
          .insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            client_id: clientId,
            name: formData.petName.trim(),
            species: formData.petSpecies,
            breed: formData.petBreed.trim() || 'Unknown',
            birth_month: birthMonth,
            birth_year: birthYear,
            weight: w ?? 0,
            color: null,
            notes: notesParts.length ? notesParts.join('\n') : null,
            special_instructions: vaccineSummary || null,
            vaccination_status: lastVac ? 'up_to_date' : 'unknown',
            last_vaccination_date: lastVac,
            photo_url: null,
          })
          .select()
          .single();

        if (newPet) petId = (newPet as { id: string }).id;
      }

      if (!petId || !selectedDate || !selectedTime) {
        setLoading(false);
        return;
      }

      const [hours, minutes] = selectedTime.split(':');
      const appointmentDate = setMinutes(
        setHours(selectedDate, parseInt(hours, 10)),
        parseInt(minutes, 10),
      );

      const svcResolve = await ensureAppointmentServiceIds(
        businessId,
        formData.services,
        safeServices.map((s) => ({ id: s.id, name: s.name, price: s.price })),
      );
      if (!svcResolve.ok) {
        alert(svcResolve.error);
        setLoading(false);
        return;
      }

      const { data: priceRows } = await supabase
        .from('services')
        .select('price')
        .in('id', svcResolve.serviceIds);
      const estimatedPrice = (priceRows ?? []).reduce(
        (sum, r) => sum + Number((r as { price?: number }).price ?? 0),
        0,
      );

      const bookedByStaffId = await staffIdForBusinessOrNull(staffId, businessId);

      const endMin = timeToMinutes(selectedTime) + bookingDurationMinutes;
      const endTimeStr = minutesToHHmm(Math.min(endMin, 23 * 60 + 59));

      const clientLabel =
        clientMode === 'new'
          ? `${formData.clientFirstName} ${formData.clientLastName}`.trim()
          : `${formData.clientFirstName} ${formData.clientLastName}`.trim() || 'Client';

      const { data: newAppointment, error } = await supabase
        .from('appointments')
        .insert({
          id: crypto.randomUUID(),
          business_id: businessId,
          client_id: clientId,
          pet_id: petId,
          service_id: svcResolve.primaryServiceId,
          staff_id: preferredStaffId === 'anyone' ? null : preferredStaffId,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: selectedTime,
          end_time: endTimeStr,
          scheduled_date: appointmentDate.toISOString(),
          service_type: svcResolve.serviceType,
          status: 'scheduled',
          total_price: estimatedPrice,
          price: estimatedPrice,
          booked_by_staff_id: bookedByStaffId,
          notes:
            formData.notes.trim() ||
            `Client: ${clientLabel}\nPet: ${formData.petName}\nServices: ${svcResolve.serviceType}`,
        })
        .select()
        .single();

      if (error) {
        devConsole.error('[BookingFormDialog] Appointment insert error:', error.message, error.code);
        alert('Error creating appointment. Please try again.');
      } else {
        onAddAppointment?.(newAppointment);
        resetForm();
        onSuccess(newAppointment);
        onOpenChange(false);
      }
    } catch (err) {
      devConsole.error('Error:', err);
      alert('Error creating appointment. Please try again.');
    } finally {
      setLoading(false);
    }
    };

    if (
      staffMayBookPast &&
      selectedDate &&
      selectedTime &&
      isSlotStartInPast(selectedDate, selectedTime)
    ) {
      const acknowledged = isPastCalendarDay(selectedDate)
        ? warnedPastDateRef.current
        : warnedPastTimeRef.current;
      if (!acknowledged) {
        setPastConfirm({
          open: true,
          title: t('booking.pastConfirmTitle'),
          description: t('booking.pastTimeConfirm'),
          onConfirm: () => {
            void runSubmit();
          },
        });
        return;
      }
    }

    await runSubmit();
  };

  const timePlaceholder = !selectedDate
    ? 'Select a date first'
    : formData.services.length === 0
      ? 'Select services first'
      : isClosedDay
        ? 'Closed'
        : candidateSlots.length === 0
          ? 'No slots fit this duration'
          : 'Select time';

  const timeSelectDisabled =
    !selectedDate ||
    isClosedDay ||
    formData.services.length === 0 ||
    bookingDurationMinutes <= 0 ||
    candidateSlots.length === 0;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl min-h-0 flex-col gap-0 overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-12">
        <DialogHeader className="pr-10 sm:pr-12">
          <DialogTitle className="text-2xl">Book New Appointment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 border-b pb-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <UserCircle className="h-5 w-5" />
              Staff for this visit
            </h3>
            <Select
              value={preferredStaffId}
              onValueChange={(v) => {
                setPreferredStaffId(v);
                setSelectedTime('');
              }}
            >
              <SelectTrigger className={cn('w-full max-w-md', bookingFieldChrome)}>
                <SelectValue placeholder="Anyone (best availability)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anyone">Anyone (best availability)</SelectItem>
                {employees
                  .filter((e) => e.status === 'active')
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {formatStaffNameAggregated(e.name)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Services <span className="text-destructive">*</span>
            </Label>
            {safeServices.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {safeServices.map((service) => {
                  const selected = formData.services.includes(service.name);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => handleServiceToggle(service.name)}
                      className={cn(
                        'flex min-h-10 w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-normal transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-background hover:bg-muted/80',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 shadow-sm',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/70 bg-background',
                        )}
                        aria-hidden
                      >
                        {selected ? (
                          <Check className="h-4 w-4 stroke-[3]" strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 leading-snug">{service.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No services available.</p>
            )}
            {fieldErrors.services ? (
              <p className="text-sm text-destructive">{fieldErrors.services}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Date <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      bookingFieldChrome,
                      !selectedDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleBookingDateSelect}
                    disabled={(date) => {
                      if (isBusinessClosedOnDate(date, hoursPerDay)) return true;
                      if (staffMayBookPast) return false;
                      return date < startOfDay(new Date());
                    }}
                    modifiers={{
                      ...(staffMayBookPast
                        ? { pastDay: (d: Date) => isPastCalendarDay(d) }
                        : {}),
                      closedDay: (d: Date) => isBusinessClosedOnDate(d, hoursPerDay),
                    }}
                    modifiersClassNames={{
                      ...(staffMayBookPast
                        ? {
                            pastDay:
                              'opacity-50 text-muted-foreground aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:opacity-100',
                          }
                        : {}),
                      closedDay:
                        'opacity-45 text-muted-foreground line-through decoration-muted-foreground/50',
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {fieldErrors.date ? (
                <p className="text-sm text-destructive">{fieldErrors.date}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Time <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedTime || undefined}
                onValueChange={handleBookingTimeSelect}
                disabled={timeSelectDisabled}
                onOpenChange={(opened) => {
                  if (!opened || !firstSelectableHhmm) return;
                  const id = `booking-time-slot-${firstSelectableHhmm.replace(':', '-')}`;
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      document.getElementById(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    });
                  });
                }}
              >
                <SelectTrigger className={cn('w-full', bookingFieldChrome)}>
                  <SelectValue placeholder={timePlaceholder} />
                </SelectTrigger>
                <SelectContent className="max-h-[min(60vh,320px)]">
                  {slotRows.map(({ hhmm, available, isPast }) => {
                    const itemDisabled = !available || (isPast && !staffMayBookPast);
                    return (
                      <SelectItem
                        key={hhmm}
                        id={`booking-time-slot-${hhmm.replace(':', '-')}`}
                        value={hhmm}
                        disabled={itemDisabled}
                        title={
                          isPast && staffMayBookPast && (available || selectedTime === hhmm)
                            ? t('booking.pastTimeHoverHint')
                            : undefined
                        }
                        className={cn((!available || isPast) && 'text-muted-foreground opacity-60')}
                      >
                        {formatTime12H(hhmm)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {fieldErrors.time ? (
                <p className="text-sm text-destructive">{fieldErrors.time}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <User className="h-5 w-5" />
              {t('form.clientInformation')}
            </h3>

            <Tabs
              value={clientMode}
              onValueChange={(v) => {
                const m = v as 'existing' | 'new';
                setClientMode(m);
                setFieldErrors({});
                if (m === 'new') {
                  setFormData((p) => ({
                    ...p,
                    clientId: '',
                    petId: '',
                    petName: '',
                    petBreed: '',
                    petAgeMode: 'birthday',
                    vaccineRows: defaultVaccineRows(),
                    clientFirstName: '',
                    clientLastName: '',
                    clientEmail: '',
                    clientPhoneDigits: '',
                  }));
                  setClientSearch('');
                  setCreateNewPet(false);
                }
              }}
            >
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="existing">Existing client</TabsTrigger>
                <TabsTrigger value="new">New client</TabsTrigger>
              </TabsList>
            </Tabs>

            {clientMode === 'existing' ? (
              <div ref={clientSearchRef} className="relative space-y-2">
                <Label className="text-base font-semibold" htmlFor="booking-client-search">
                  {t('form.searchClient')}
                </Label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="booking-client-search"
                    className={cn('relative z-0 h-10 pl-9', bookingFieldChrome)}
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setClientSearchOpen(true);
                    }}
                    onFocus={() => setClientSearchOpen(true)}
                    placeholder={bc.clientSearch}
                    autoComplete="off"
                    aria-label={bc.clientSearch}
                  />
                </div>
                {clientSearchOpen && filteredClients.length > 0 ? (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => selectExistingClient(c)}
                      >
                        <span className="font-medium">
                          {c.first_name} {c.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatPhoneNumber(c.phone || '')}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {fieldErrors.client ? (
                  <p className="text-sm text-destructive">{fieldErrors.client}</p>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Input
                    className={cn('h-10', bookingFieldChrome)}
                    value={formData.clientFirstName}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, clientFirstName: e.target.value }))
                    }
                    placeholder={bc.firstName}
                    required
                    aria-label={bc.firstName}
                  />
                  {fieldErrors.clientFirstName ? (
                    <p className="text-sm text-destructive">{fieldErrors.clientFirstName}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Input
                    className={cn('h-10', bookingFieldChrome)}
                    value={formData.clientLastName}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, clientLastName: e.target.value }))
                    }
                    placeholder={bc.lastName}
                    required
                    aria-label={bc.lastName}
                  />
                  {fieldErrors.clientLastName ? (
                    <p className="text-sm text-destructive">{fieldErrors.clientLastName}</p>
                  ) : null}
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Input
                    className={cn('h-10', bookingFieldChrome)}
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData((p) => ({ ...p, clientEmail: e.target.value }))}
                    placeholder={bc.email}
                    aria-label={bc.email}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <UsPhoneFields
                    value={formatPhoneNumber(formData.clientPhoneDigits)}
                    onChange={(d) => setFormData((p) => ({ ...p, clientPhoneDigits: d }))}
                    error={fieldErrors.clientPhone}
                    groupAriaLabel={bc.phoneGroup}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 border-t pt-4">
            {showNewPetForm && !showPetPicker ? (
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Dog className="h-5 w-5" />
                {t('form.addPet')}
              </h3>
            ) : null}

            {showPetPicker ? (
              <div className="space-y-2">
                <Label className="text-base font-semibold">{bc.selectPet}</Label>
                <div className="flex flex-wrap gap-2">
                  <Select value={formData.petId} onValueChange={handlePetChange}>
                    <SelectTrigger
                      className={cn(
                        'h-10 min-w-[200px] flex-1 justify-start font-normal md:max-w-md',
                        bookingFieldChrome,
                      )}
                    >
                      <SelectValue placeholder={bc.selectPet} />
                    </SelectTrigger>
                    <SelectContent>
                      {clientPets.map((pet) => (
                        <SelectItem key={pet.id} value={pet.id}>
                          {petNameBreedLabel(pet)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateNewPet(true);
                      setFormData((p) => ({
                        ...p,
                        petId: '',
                        petName: '',
                        petBreed: '',
                        petAgeMode: 'birthday',
                        vaccineRows: defaultVaccineRows(),
                      }));
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    New pet
                  </Button>
                </div>
                {fieldErrors.pet ? (
                  <p className="text-sm text-destructive">{fieldErrors.pet}</p>
                ) : null}
              </div>
            ) : null}

            {showNewPetForm ? (
              <div className="space-y-5 rounded-xl border-2 border-border bg-card/50 p-5 shadow-sm">
                <div className="space-y-1">
                  <Input
                    className={cn('h-10', bookingFieldChrome)}
                    value={formData.petName}
                    onChange={(e) => setFormData((p) => ({ ...p, petName: e.target.value }))}
                    placeholder={bc.petName}
                    aria-label={bc.petName}
                  />
                  {fieldErrors.petName ? (
                    <p className="text-sm text-destructive">{fieldErrors.petName}</p>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-lg border-2 border-border bg-muted/15 p-4">
                  <p className="text-sm font-semibold text-foreground">{bc.petDetailsGroup}</p>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 min-[480px]:flex-row min-[480px]:items-end">
                      <div className="min-w-0 shrink-0 space-y-1 min-[480px]:w-[min(100%,9.5rem)]">
                        <Select
                          value={formData.petSpecies}
                          onValueChange={(value: 'dog' | 'cat' | 'other') =>
                            setFormData((p) => ({
                              ...p,
                              petSpecies: value,
                              petBreed: '',
                            }))
                          }
                        >
                          <SelectTrigger className={cn('h-10 w-full', bookingFieldChrome)} aria-label={bc.species}>
                            <SelectValue placeholder={bc.species} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dog">{bc.speciesDog}</SelectItem>
                            <SelectItem value="cat">{bc.speciesCat}</SelectItem>
                            <SelectItem value="other">{bc.speciesOther}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        {formData.petSpecies === 'other' ? (
                          <Input
                            className={cn('h-10 w-full', bookingFieldChrome)}
                            value={formData.petBreed}
                            onChange={(e) => setFormData((p) => ({ ...p, petBreed: e.target.value }))}
                            placeholder={bc.breedOther}
                            aria-label={bc.breedOther}
                          />
                        ) : (
                          <Select
                            value={formData.petBreed || undefined}
                            onValueChange={(b) => setFormData((p) => ({ ...p, petBreed: b }))}
                          >
                            <SelectTrigger className={cn('h-10 w-full', bookingFieldChrome)}>
                              <SelectValue placeholder={bc.breedSelect} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[min(50vh,280px)]">
                              {breedOptionsForSpecies.map((b) => (
                                <SelectItem key={b} value={b}>
                                  {b}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {fieldErrors.petBreed ? (
                          <p className="text-sm text-destructive">{fieldErrors.petBreed}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="w-full shrink-0 space-y-1 lg:w-[5.5rem]">
                      <Input
                        className={cn('h-10 w-full lg:max-w-[5.5rem]', bookingFieldChrome)}
                        inputMode="numeric"
                        maxLength={3}
                        value={formData.petWeight}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                          setFormData((p) => ({ ...p, petWeight: v }));
                        }}
                        placeholder={bc.weight}
                        aria-label={bc.weight}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border-2 border-border bg-muted/15 p-4">
                  <p className="text-sm font-semibold text-foreground">{bc.petAgeGroup}</p>
                  <Tabs
                    value={formData.petAgeMode}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, petAgeMode: v as 'age' | 'birthday' }))
                    }
                  >
                    <TabsList className={cn('grid w-full max-w-xs grid-cols-2', bookingFieldChrome, 'p-1')}>
                      <TabsTrigger value="birthday">Birthday</TabsTrigger>
                      <TabsTrigger value="age">Age</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {formData.petAgeMode === 'birthday' ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Select
                          value={formData.petBirthMonth || undefined}
                          onValueChange={(m) => setFormData((p) => ({ ...p, petBirthMonth: m }))}
                        >
                          <SelectTrigger className={cn('h-10 w-[200px]', bookingFieldChrome)}>
                            <SelectValue placeholder={bc.selectMonth} />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((name, i) => (
                              <SelectItem key={name} value={String(i + 1)}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Input
                          className={cn('h-10 w-28', bookingFieldChrome)}
                          inputMode="numeric"
                          value={formData.petBirthYear}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, petBirthYear: e.target.value }))
                          }
                          placeholder={bc.year}
                          aria-label={bc.year}
                        />
                      </div>
                      {fieldErrors.petBirth ? (
                        <p className="w-full text-sm text-destructive">{fieldErrors.petBirth}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        className={cn('h-10 max-w-[160px]', bookingFieldChrome)}
                        inputMode="numeric"
                        placeholder={bc.ageYears}
                        value={formData.petAgeYears}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, petAgeYears: e.target.value }))
                        }
                        aria-label={bc.ageYears}
                      />
                      {fieldErrors.petAge ? (
                        <p className="text-sm text-destructive">{fieldErrors.petAge}</p>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border-2 border-border bg-muted/15 p-4">
                  <p className="text-sm font-semibold text-foreground">{bc.vacSubsection}</p>
                  <div className="space-y-3">
                    {formData.vaccineRows.map((row, rowIndex) => (
                      <div
                        key={row.id}
                        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
                      >
                        <div className="min-w-[140px] flex-1 sm:max-w-[220px]">
                          {rowIndex === 0 ? (
                            <div
                              className={cn(
                                'flex h-10 items-center rounded-md px-3 text-sm font-medium',
                                bookingFieldChrome,
                                'bg-muted/40',
                              )}
                            >
                              {bc.rabiesLabel}
                            </div>
                          ) : (
                            <Input
                              className={cn('h-10', bookingFieldChrome)}
                              value={row.name}
                              onChange={(e) => {
                                const v = e.target.value;
                                setFormData((p) => ({
                                  ...p,
                                  vaccineRows: p.vaccineRows.map((r) =>
                                    r.id === row.id ? { ...r, name: v } : r,
                                  ),
                                }));
                              }}
                              placeholder={bc.vaccineType}
                              aria-label={bc.vaccineType}
                            />
                          )}
                        </div>
                        <Select
                          value={row.month || undefined}
                          onValueChange={(m) =>
                            setFormData((p) => ({
                              ...p,
                              vaccineRows: p.vaccineRows.map((r) =>
                                r.id === row.id ? { ...r, month: m } : r,
                              ),
                            }))
                          }
                        >
                          <SelectTrigger className={cn('h-10 w-full sm:w-[200px]', bookingFieldChrome)}>
                            <SelectValue placeholder={bc.selectMonth} />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((name, i) => (
                              <SelectItem key={name} value={String(i + 1)}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-end gap-2">
                          <Input
                            className={cn('h-10 w-28', bookingFieldChrome)}
                            inputMode="numeric"
                            value={row.year}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                              setFormData((p) => ({
                                ...p,
                                vaccineRows: p.vaccineRows.map((r) =>
                                  r.id === row.id ? { ...r, year: v } : r,
                                ),
                              }));
                            }}
                            placeholder={bc.year}
                            aria-label={bc.year}
                          />
                          {rowIndex > 0 ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className={cn('h-10 w-10 shrink-0', bookingFieldChrome)}
                              onClick={() =>
                                setFormData((p) => ({
                                  ...p,
                                  vaccineRows: p.vaccineRows.filter((r) => r.id !== row.id),
                                }))
                              }
                              aria-label="Remove vaccine row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="hidden w-10 sm:block" aria-hidden />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={bookingFieldChrome}
                    onClick={() =>
                      setFormData((p) => ({
                        ...p,
                        vaccineRows: [
                          ...p.vaccineRows,
                          { id: newVaccineRowId(), name: '', month: '', year: '' },
                        ],
                      }))
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {bc.addVaccine}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2 border-t pt-4">
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              placeholder={bc.notes}
              className={cn('min-h-[100px]', bookingFieldChrome)}
              aria-label={bc.notes}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1" size="lg" disabled={loading}>
              {loading ? 'Creating...' : 'Create Appointment'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="lg">
              Cancel
            </Button>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
    <PastBookingConfirmDialog
      open={pastConfirm.open}
      onOpenChange={(o) => setPastConfirm((p) => ({ ...p, open: o }))}
      title={pastConfirm.title}
      description={pastConfirm.description}
      onConfirm={pastConfirm.onConfirm}
    />
    </>
  );
}
