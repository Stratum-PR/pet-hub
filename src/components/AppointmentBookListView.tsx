import { useEffect, useMemo, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import {
  ArrowUpDown,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Edit,
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

function matchesStatusFilter(status: string | undefined, filter: string): boolean {
  if (filter === 'all') return true;
  const s = normalizeAppointmentStatus(status);
  const f = normalizeAppointmentStatus(filter);
  if (f === 'canceled') return s === 'canceled' || s === 'cancelled';
  return s === f;
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
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  filters: CalendarFilters;
  onFilterChange: (key: keyof CalendarFilters, value: string | CalendarView) => void;
  canMarkNoShow?: boolean;
  onMarkNoShow?: (id: string) => void | Promise<void>;
  onEdit: (apt: Appointment) => void;
  onClearFilters?: () => void;
  /** Start in "all dates" (history) mode. */
  initialScope?: 'day' | 'all';
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
  selectedDate,
  onSelectDate,
  onPreviousDay,
  onNextDay,
  onToday,
  filters,
  onFilterChange,
  canMarkNoShow = false,
  onMarkNoShow,
  onEdit,
  onClearFilters,
  initialScope = 'day',
  petFilterId = null,
  onClearPetFilter,
}: AppointmentBookListViewProps) {
  const { language } = useLanguage();
  const dateFnsLocale = language === 'es' ? esLocale : enUS;
  const [search, setSearch] = useState('');
  const [dateScope, setDateScope] = useState<'day' | 'all'>(petFilterId ? 'all' : initialScope);
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateSortDir, setDateSortDir] = useState<'asc' | 'desc'>('desc');
  // History can hold thousands of rows; render in pages to keep the page fast.
  const PAGE_SIZE = 100;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const formatDateHeader = (date: Date) =>
    format(date, 'EEEE, d MMMM yyyy', { locale: dateFnsLocale });

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

    if (dateScope === 'day') {
      list = list.filter((apt) => {
        const d = parseAppointmentDate(apt);
        return d != null && isSameDay(d, selectedDate);
      });
    }

    if (statusFilter !== 'all') {
      list = list.filter((apt) => matchesStatusFilter(apt.status, statusFilter));
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

    list.sort((a, b) => {
      const da = parseAppointmentDate(a)?.getTime() ?? 0;
      const db = parseAppointmentDate(b)?.getTime() ?? 0;
      const cmp = da - db;
      return dateSortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [
    baseFiltered,
    dateScope,
    selectedDate,
    statusFilter,
    search,
    pets,
    clients,
    services,
    dateSortDir,
  ]);

  const toggleDateSort = () => {
    setDateSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, dateScope, staffFilter, statusFilter, petFilterId, dateSortDir, selectedDate]);

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
      const idShort = apt.id.replace(/-/g, '').slice(0, 8).toUpperCase();

      return {
        apt,
        idShort,
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
{dateScope === 'day' ? (
              <>
            <Button variant="outline" size="sm" onClick={onToday} className="shrink-0 font-medium">
              {t('appointments.today')}
            </Button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:flex-initial sm:justify-start">
              <button
                type="button"
                onClick={onPreviousDay}
                className="rounded p-1 hover:bg-muted"
                aria-label={t('apptBook.navigatePrevious')}
              >
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
              <span className="min-w-0 flex-1 px-1 text-center text-xs font-medium text-foreground sm:flex-initial sm:text-sm md:text-base">
                {formatDateHeader(selectedDate)}
              </span>
              <button
                type="button"
                onClick={onNextDay}
                className="rounded p-1 hover:bg-muted"
                aria-label={t('apptBook.navigateNext')}
              >
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label={t('appointments.selectDate')}>
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && onSelectDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
              </>
            ) : null}
            <Select value={dateScope} onValueChange={(v) => setDateScope(v as 'day' | 'all')}>
              <SelectTrigger className="w-full min-w-0 sm:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t('apptBook.dateScopeDay')}</SelectItem>
                <SelectItem value="all">{t('apptBook.dateScopeAll')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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
            <div className="flex flex-wrap items-center gap-2">
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger className="w-full min-w-0 sm:w-[170px]" aria-label={t('apptBook.columnEmployee')}>
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full min-w-0 sm:w-[168px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('apptBook.allStatuses')}</SelectItem>
                  <SelectItem value="pending">{t('apptStatus.pending')}</SelectItem>
                  <SelectItem value="scheduled">{t('apptStatus.scheduled')}</SelectItem>
                  <SelectItem value="confirmed">{t('apptStatus.confirmed')}</SelectItem>
                  <SelectItem value="in_progress">{t('apptStatus.inProgress')}</SelectItem>
                  <SelectItem value="completed">{t('apptStatus.completed')}</SelectItem>
                  <SelectItem value="canceled">{t('apptStatus.canceled')}</SelectItem>
                  <SelectItem value="no_show">{t('apptStatus.noShow')}</SelectItem>
                </SelectContent>
              </Select>
              {staffFilter !== 'all' || statusFilter !== 'all' || search ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setStaffFilter('all');
                    setStatusFilter('all');
                    setSearch('');
                    onClearFilters?.();
                  }}
                >
                  {t('apptBook.clearFilters')}
                </Button>
              ) : null}
            </div>
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
            <div className="space-y-3 md:hidden">
              {listViewRows.map((row) => (
                <Card key={row.apt.id} className="border border-border p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={row.statusClass}>{row.statusLabel}</Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">{row.idShort}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{row.petLabel}</p>
                      <p className="text-xs text-muted-foreground">{row.clientName}</p>
                      <p className="text-xs text-foreground">
                        {row.dateStr} · {row.timeStr || '—'}
                      </p>
                      <p className="text-xs text-foreground">{row.serviceLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('apptBook.columnEmployee')}: {row.staffName}
                      </p>
                      <div className="flex items-center justify-between gap-2 pt-1 text-sm">
                        <span className="text-muted-foreground">{row.paymentLabel}</span>
                        <span className="font-semibold">{row.totalStr}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(row.apt)}
                        aria-label={t('common.edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
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
                            className={cn('h-4 w-4', dateSortDir === 'asc' && 'text-primary')}
                          />
                        </div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">{t('apptBook.columnTime')}</TableHead>
                      <TableHead className="min-w-[140px]">{t('apptBook.columnServices')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('apptBook.columnEmployee')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('apptBook.columnPayment')}</TableHead>
                      <TableHead className="whitespace-nowrap text-right">{t('apptBook.columnTotal')}</TableHead>
                      <TableHead className="whitespace-nowrap text-right">{t('apptBook.columnActions')}</TableHead>
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
                        <TableCell className="whitespace-nowrap">{row.dateStr}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.timeStr || '—'}</TableCell>
                        <TableCell className="max-w-[200px] break-words text-sm [overflow-wrap:anywhere]">
                          {row.serviceLabel}
                        </TableCell>
                        <TableCell className="max-w-[120px] break-words text-sm [overflow-wrap:anywhere]">
                          {row.staffName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.paymentLabel}</TableCell>
                        <TableCell className="text-right font-medium">{row.totalStr}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onEdit(row.apt)}
                              aria-label={t('common.edit')}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
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
