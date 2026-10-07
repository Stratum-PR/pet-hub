import { useEffect, useMemo, useState } from 'react';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { enUS, es as esLocale } from 'date-fns/locale';
import {
  ArrowUpDown,
  Calendar as CalendarIcon,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Appointment,
  BusinessClient,
  Pet,
  Service,
} from '@/hooks/useBusinessData';
import { Employee } from '@/types';
import { CalendarFilters, CalendarStaff, CalendarView } from '@/types/calendar';
import { parseAppointmentDate } from '@/lib/calendarHelpers';
import { staffRecordIdFromRow } from '@/lib/staffRecordCompat';
import {
  appointmentStatusLabelKey,
  normalizeAppointmentStatus,
} from '@/lib/appointmentStatus';
import { UNASSIGNED_STAFF_ID } from '@/lib/groomerAvailability';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';

function formatTime12H(timeRaw: string | null | undefined): string {
  if (!timeRaw) return '';
  const s = String(timeRaw).split(':').slice(0, 2).join(':');
  const [hStr, mStr] = s.split(':');
  const hour = parseInt(hStr, 10);
  const minutes = mStr ?? '00';
  if (Number.isNaN(hour)) return s;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

const DATE_PRESETS = ['today', 'thisWeek', 'thisMonth', 'last30', 'next30'] as const;
type DatePreset = (typeof DATE_PRESETS)[number];

function presetRange(p: DatePreset): DateRange {
  const now = new Date();
  switch (p) {
    case 'today':
      return { from: startOfDay(now), to: startOfDay(now) };
    case 'thisWeek':
      return { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfWeek(now, { weekStartsOn: 0 }) };
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last30':
      return { from: subDays(startOfDay(now), 29), to: startOfDay(now) };
    case 'next30':
      return { from: startOfDay(now), to: subDays(startOfDay(now), -29) };
  }
}

function getStatusColor(status: string) {
  const s = normalizeAppointmentStatus(status);
  switch (s) {
    case 'pending':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200';
    case 'scheduled':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'confirmed':
      return 'bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-200';
    case 'in-progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'cancelled':
    case 'canceled':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'no-show':
      return 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
}

function formatStatusLabel(status: string | undefined) {
  return t(appointmentStatusLabelKey(status));
}

export interface AppointmentBookListViewProps {
  appointments: Appointment[];
  pets: Pet[];
  clients: BusinessClient[];
  services: Service[];
  employees: Employee[];
  calendarEmployees: CalendarStaff[];
  filters: CalendarFilters;
  onFilterChange: (key: keyof CalendarFilters, value: string | CalendarView) => void;
  canMarkNoShow?: boolean;
  onMarkNoShow?: (id: string) => void | Promise<void>;
  onEdit: (apt: Appointment) => void;
  /** Only show this pet's appointments (from ?pet= deep links); clearable. */
  petFilterId?: string | null;
  onClearPetFilter?: () => void;
}

export function AppointmentBookListView({
  appointments,
  pets,
  clients,
  services,
  employees,
  calendarEmployees,
  filters,
  onFilterChange,
  canMarkNoShow = false,
  onMarkNoShow,
  onEdit,
  petFilterId = null,
  onClearPetFilter,
}: AppointmentBookListViewProps) {
  const { language } = useLanguage();
  const dateFnsLocale = language === 'es' ? esLocale : enUS;
  const [search, setSearch] = useState('');
  // undefined = all dates; otherwise one day (from only) or a range.
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dateOpen, setDateOpen] = useState(false);
  const [staffFilter, setStaffFilter] = useState<string>('all');
  // History opens on "recently booked" so a just-created appointment is at the top,
  // even when the business already has many future-dated bookings.
  const [sortMode, setSortMode] = useState<'recent' | 'dateDesc' | 'dateAsc'>('recent');

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from) return t('apptBook.dateScopeAll');
    const f = (d: Date, withYear: boolean) => format(d, withYear ? 'd MMM yyyy' : 'd MMM', { locale: dateFnsLocale });
    if (!dateRange.to || isSameDay(dateRange.from, dateRange.to)) return f(dateRange.from, true);
    return `${f(dateRange.from, false)} – ${f(dateRange.to, true)}`;
  }, [dateRange, dateFnsLocale]);
  // History can hold thousands of rows; render in pages to keep the page fast.
  const PAGE_SIZE = 100;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const baseFiltered = useMemo(() => {
    let list = [...appointments];
    if (petFilterId) list = list.filter((apt) => apt.pet_id === petFilterId);
    if (staffFilter !== 'all') {
      list = list.filter((apt) => {
        const ref = staffRecordIdFromRow(apt) ?? apt.staff_id ?? null;
        return staffFilter === UNASSIGNED_STAFF_ID ? !ref : ref === staffFilter;
      });
    }
    return list;
  }, [appointments, petFilterId, staffFilter]);

  const displayRows = useMemo(() => {
    let list = baseFiltered;

    if (dateRange?.from) {
      const from = startOfDay(dateRange.from).getTime();
      const to = endOfDay(dateRange.to ?? dateRange.from).getTime();
      list = list.filter((apt) => {
        const d = parseAppointmentDate(apt)?.getTime();
        return d != null && d >= from && d <= to;
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((apt) => {
        const pet = pets.find((p) => p.id === apt.pet_id);
        const client = clients.find((c) => c.id === (apt.client_id || pet?.client_id));
        const clientName = `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim().toLowerCase();
        const petLine = `${pet?.name ?? ''} ${pet?.breed ?? ''}`.toLowerCase();
        const svc = services.find((s) => s.id === apt.service_id);
        const svcName = (svc?.name ?? apt.service_type ?? '').toLowerCase();
        return (
          petLine.includes(q) ||
          clientName.includes(q) ||
          svcName.includes(q) ||
          (apt.notes ?? '').toLowerCase().includes(q)
        );
      });
    }

    const dateKey = (apt: Appointment) =>
      `${String(apt.appointment_date ?? '').slice(0, 10)} ${String(apt.start_time ?? '').slice(0, 5)}`;
    list = [...list].sort((a, b) => {
      if (sortMode === 'recent') {
        const ca = a.created_at ? Date.parse(a.created_at) : 0;
        const cb = b.created_at ? Date.parse(b.created_at) : 0;
        if (ca !== cb) return cb - ca;
        return dateKey(b).localeCompare(dateKey(a));
      }
      const cmp = dateKey(a).localeCompare(dateKey(b));
      return sortMode === 'dateAsc' ? cmp : -cmp;
    });

    return list;
  }, [
    baseFiltered,
    dateRange,
    search,
    pets,
    clients,
    services,
    sortMode,
  ]);

  const toggleDateSort = () => {
    setSortMode((m) => (m === 'dateAsc' ? 'dateDesc' : 'dateAsc'));
  };

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, dateRange, staffFilter, petFilterId, sortMode]);

  const listViewRows = useMemo(() => {
    return displayRows.slice(0, visibleCount).map((apt) => {
      const aptAny = apt as unknown as Record<string, unknown>;
      const pet = pets.find((p) => p.id === apt.pet_id);
      const client = clients.find((c) => c.id === (apt.client_id || pet?.client_id));
      const clientName =
        `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() || t('appointments.unknownClient');
      const breed = pet?.breed ? ` (${pet.breed})` : '';
      const svc = services.find((s) => s.id === apt.service_id);
      const serviceLabel = (svc?.name as string | undefined) ?? (aptAny.service_type as string | undefined) ?? t('appointments.noService');
      const staffRef = staffRecordIdFromRow(apt) ?? (aptAny.staff_id as string | undefined);
      const employee = employees.find((e) => e.id === staffRef);
      const staffName = employee?.name
        ? formatStaffNameAggregated(employee.name)
        : t('apptBook.unassigned');
      const aptDate = parseAppointmentDate(apt);
      const dateStr = aptDate ? format(aptDate, 'd MMM yyyy', { locale: dateFnsLocale }) : '—';
      const timeStr = formatTime12H(apt.start_time);
      const rawTotal = apt.total_price ?? (aptAny.price as number | null | undefined) ?? null;
      const total = rawTotal == null ? null : Number(rawTotal);
      const totalStr =
        total != null && !Number.isNaN(total as number) ? `$${(total as number).toFixed(2)}` : '—';
      const hasPayment = Boolean(aptAny.transaction_id || aptAny.billed);
      const paymentLabel = hasPayment
        ? t('apptBook.paymentPaid')
        : normalizeAppointmentStatus(apt.status) === 'completed'
          ? t('apptBook.paymentUnpaid')
          : t('apptBook.paymentDash');
      const petLabel = pet ? `${pet.name}${breed}` : t('appointments.unknownPet');

      return {
        apt,
        petLabel,
        clientName,
        dateStr,
        timeStr,
        serviceLabel,
        staffName,
        paymentLabel,
        totalStr,
        statusLabel: formatStatusLabel(apt.status),
        statusClass: getStatusColor(apt.status ?? ''),
      };
    });
  }, [displayRows, visibleCount, pets, clients, services, employees, dateFnsLocale]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background max-sm:h-auto max-sm:min-h-0">
      <div className="shrink-0 border-b border-border bg-muted/30 px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('apptBook.listSearchPlaceholder')}
              className="h-9 rounded-lg border-border/50 bg-white/70 pl-10 pr-10 backdrop-blur-sm dark:bg-background/50"
            />
            {search ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setSearch('')}
                aria-label={t('apptBook.clearFilters')}
              >
                <X className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:flex-wrap sm:items-center">
            {/* Dates: all, a quick period, one day or a custom range */}
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('h-10 justify-start gap-2 font-normal', dateRange && 'border-primary/50 text-foreground')}
                >
                  <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{dateRangeLabel}</span>
                  {dateRange ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={t('apptBook.clearFilters')}
                      className="-mr-1 ml-auto rounded p-0.5 hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDateRange(undefined);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          setDateRange(undefined);
                        }
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex flex-col sm:flex-row">
                  <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:border-b-0 sm:border-r">
                    {DATE_PRESETS.map((p) => (
                      <Button
                        key={p}
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => {
                          setDateRange(presetRange(p));
                          setDateOpen(false);
                        }}
                      >
                        {t(`apptBook.datePreset.${p}`)}
                      </Button>
                    ))}
                  </div>
                  <div>
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(r) => setDateRange(r?.from ? r : undefined)}
                      defaultMonth={dateRange?.from}
                      locale={dateFnsLocale}
                      initialFocus
                    />
                    <p className="px-3 pb-3 text-xs text-muted-foreground">{t('apptBook.dateRangeHint')}</p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="w-full min-w-0 gap-2 sm:w-auto" aria-label={t('apptBook.columnEmployee')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('apptBook.allEmployees')}</SelectItem>
                {calendarEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {formatStaffNameAggregated(emp.name)}
                  </SelectItem>
                ))}
                <SelectItem value={UNASSIGNED_STAFF_ID}>{t('apptBook.unassigned')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortMode} onValueChange={(v) => setSortMode(v as typeof sortMode)}>
              <SelectTrigger className="col-span-2 w-full min-w-0 gap-2 sm:col-span-1 sm:w-auto" aria-label={t('apptBook.sortBy')}>
                <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                  <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="shrink-0 text-muted-foreground">{t('apptBook.sortBy')}:</div>
                  <div className="min-w-0 truncate font-medium">
                    <SelectValue />
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t('apptBook.sortRecent')}</SelectItem>
                <SelectItem value="dateDesc">{t('apptBook.sortDateDesc')}</SelectItem>
                <SelectItem value="dateAsc">{t('apptBook.sortDateAsc')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto px-3 py-3 max-sm:flex-none max-sm:overflow-visible sm:px-6 sm:py-4">
        {petFilterId ? (
          <div className="mb-3 flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1">
              {t('apptBook.historyForPet', { name: pets.find((p) => p.id === petFilterId)?.name ?? '—' })}
            </Badge>
            {onClearPetFilter ? (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClearPetFilter}>
                <X className="mr-1 h-3 w-3" /> {t('apptBook.clearFilters')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {displayRows.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">{t('apptBook.noMatchingRows')}</p>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {listViewRows.map((row) => (
                <button
                  key={row.apt.id}
                  type="button"
                  onClick={() => onEdit(row.apt)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.petLabel}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.clientName}</p>
                    </div>
                    <Badge className={cn('shrink-0', row.statusClass)}>{row.statusLabel}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-foreground">
                    {row.dateStr} · {row.timeStr || '—'} · {row.staffName}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{row.serviceLabel}</span>
                    <span className="shrink-0 text-sm font-semibold">{row.totalStr}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden min-w-0 rounded-md border md:block">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{t('apptBook.columnStatus')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('apptBook.columnPet')}</TableHead>
                      <TableHead className="min-w-[120px]">{t('apptBook.columnClient')}</TableHead>
                      <TableHead
                        className="cursor-pointer select-none whitespace-nowrap hover:bg-muted/50"
                        onClick={toggleDateSort}
                      >
                        <div className="flex items-center gap-2">
                          {t('apptBook.columnDate')}
                          <ArrowUpDown
                            className={cn('h-4 w-4', sortMode !== 'recent' && 'text-primary')}
                          />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[140px]">{t('apptBook.columnServices')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('apptBook.columnEmployee')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('apptBook.columnPayment')}</TableHead>
                      <TableHead className="whitespace-nowrap text-right">{t('apptBook.columnTotal')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listViewRows.map((row) => (
                      <TableRow key={row.apt.id} className="cursor-pointer" onClick={() => onEdit(row.apt)}>
                        <TableCell>
                          <Badge className={row.statusClass}>{row.statusLabel}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate font-medium" title={row.petLabel}>
                          {row.petLabel}
                        </TableCell>
                        <TableCell className="max-w-[160px] break-words [overflow-wrap:anywhere]">
                          {row.clientName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.dateStr}
                          <span className="text-muted-foreground"> · {row.timeStr || '—'}</span>
                        </TableCell>
                        <TableCell className="max-w-[200px] break-words text-sm [overflow-wrap:anywhere]">
                          {row.serviceLabel}
                        </TableCell>
                        <TableCell className="max-w-[120px] break-words text-sm [overflow-wrap:anywhere]">
                          {row.staffName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.paymentLabel}</TableCell>
                        <TableCell className="text-right font-medium">{row.totalStr}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {displayRows.length > visibleCount ? (
              <div className="flex flex-col items-center gap-1 pt-3">
                <Button variant="outline" size="sm" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                  {t('apptBook.showMore')}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {t('apptBook.showingCount', { shown: String(Math.min(visibleCount, displayRows.length)), total: String(displayRows.length) })}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
