import { useMemo, useState } from 'react';
import { format, isSameDay } from 'date-fns';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
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
  normalizeAppointmentStatus,
} from '@/lib/appointmentStatus';
import { AppointmentNoShowControl } from '@/components/AppointmentNoShowControl';
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
  const s = normalizeAppointmentStatus(status);
  if (s === 'no-show') return t('appointments.statusNoShow');
  return status || 'scheduled';
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
}

export function AppointmentBookListView({
  appointments,
  pets,
  clients,
  services,
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
}: AppointmentBookListViewProps) {
  const [search, setSearch] = useState('');
  const [dateScope, setDateScope] = useState<'day' | 'all'>('day');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateSortDir, setDateSortDir] = useState<'asc' | 'desc'>('desc');

  const formatDateHeader = (date: Date) => format(date, 'EEEE, MMMM d, yyyy');

  const baseFiltered = useMemo(() => {
    let list = [...appointments];

    if (filters.service !== 'All Services') {
      list = list.filter((apt) => {
        const svc = services.find((s) => s.id === apt.service_id);
        const serviceName = (svc?.name ?? (apt as any).service_type ?? '').toLowerCase();
        if (filters.service === 'Grooming') return !serviceName.includes('daycare');
        if (filters.service === 'Daycare') return serviceName.includes('daycare');
        return true;
      });
    }

    if (filters.service === 'Daycare') {
      if (filters.staff !== 'All Rooms') {
        // Room filter not implemented yet — same as calendar.
      }
    } else {
      if (filters.staff !== 'All Employees' && filters.staff !== 'All Rooms') {
        const staffMember = calendarEmployees.find((e) => e.name === filters.staff);
        if (staffMember) {
          list = list.filter((apt) => {
            const ref = staffRecordIdFromRow(apt) ?? (apt as any).staff_id;
            return ref === staffMember.id;
          });
        }
      }
    }

    return list;
  }, [appointments, filters, services, calendarEmployees]);

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
        const client = clients.find((c) => c.id === pet?.client_id);
        const clientName = `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim().toLowerCase();
        const petLine = `${pet?.name ?? ''} ${pet?.breed ?? ''}`.toLowerCase();
        const svc = services.find((s) => s.id === apt.service_id);
        const svcName = (svc?.name ?? (apt as any).service_type ?? '').toLowerCase();
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

  const staffTriggerWidth = filters.service === 'Daycare' ? 'w-[160px]' : 'w-[160px]';

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border bg-muted/30 px-6 py-4 shrink-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={onToday} className="font-medium">
              {t('appointments.today').toUpperCase()}
            </Button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPreviousDay}
                className="rounded p-1 hover:bg-muted"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
              <span className="min-w-[200px] text-center text-sm font-medium text-foreground sm:text-base">
                {formatDateHeader(selectedDate)}
              </span>
              <button
                type="button"
                onClick={onNextDay}
                className="rounded p-1 hover:bg-muted"
                aria-label="Next day"
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
            <Select value={dateScope} onValueChange={(v) => setDateScope(v as 'day' | 'all')}>
              <SelectTrigger className="w-[140px]">
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
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filters.service}
                onValueChange={(value) => onFilterChange('service', value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Grooming">Grooming</SelectItem>
                  <SelectItem value="Daycare">Daycare</SelectItem>
                  <SelectItem value="All Services">All Services</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.staff || (filters.service === 'Daycare' ? 'All Rooms' : 'All Employees')}
                onValueChange={(value) => onFilterChange('staff', value)}
              >
                <SelectTrigger className={staffTriggerWidth}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filters.service === 'Daycare' ? (
                    <SelectItem value="All Rooms">{t('apptBook.allRooms')}</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="All Employees">{t('apptBook.allEmployees')}</SelectItem>
                      {calendarEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.name}>
                          {formatStaffNameAggregated(emp.name)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[168px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('apptBook.allStatuses')}</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="no_show">{t('appointments.statusNoShow')}</SelectItem>
                </SelectContent>
              </Select>
              {onClearFilters ? (
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={onClearFilters}>
                  {t('apptBook.clearFilters')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {displayRows.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">{t('apptBook.noMatchingRows')}</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[88px]">{t('apptBook.columnId')}</TableHead>
                  <TableHead>{t('apptBook.columnStatus')}</TableHead>
                  <TableHead>{t('apptBook.columnPet')}</TableHead>
                  <TableHead>{t('apptBook.columnClient')}</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={toggleDateSort}
                  >
                    <div className="flex items-center gap-2">
                      {t('apptBook.columnDate')}
                      <ArrowUpDown
                        className={cn('h-4 w-4', dateSortDir === 'asc' && 'text-primary')}
                      />
                    </div>
                  </TableHead>
                  <TableHead>{t('apptBook.columnTime')}</TableHead>
                  <TableHead>{t('apptBook.columnServices')}</TableHead>
                  <TableHead>{t('apptBook.columnEmployee')}</TableHead>
                  <TableHead>{t('apptBook.columnPayment')}</TableHead>
                  <TableHead className="text-right">{t('apptBook.columnTotal')}</TableHead>
                  <TableHead className="text-right">{t('apptBook.columnActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.map((apt) => {
                  const aptAny = apt as any;
                  const pet = pets.find((p) => p.id === apt.pet_id);
                  const client = clients.find((c) => c.id === pet?.client_id);
                  const clientName =
                    `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() ||
                    t('appointments.unknownClient');
                  const breed = pet?.breed ? ` (${pet.breed})` : '';
                  const svc = services.find((s) => s.id === apt.service_id);
                  const serviceLabel = svc?.name ?? aptAny.service_type ?? t('appointments.noService');
                  const staffRef = staffRecordIdFromRow(apt) ?? aptAny.staff_id;
                  const employee = employees.find((e) => e.id === staffRef);
                  const staffName = employee?.name
                    ? formatStaffNameAggregated(employee.name)
                    : t('apptBook.unassigned');
                  const aptDate = parseAppointmentDate(apt);
                  const dateStr = aptDate ? format(aptDate, 'MM/dd/yyyy') : '—';
                  const timeStr = formatTime12H(apt.start_time);
                  const total =
                    typeof aptAny.price === 'number'
                      ? aptAny.price
                      : typeof apt.total_price === 'number'
                        ? apt.total_price
                        : null;
                  const totalStr =
                    total != null && !Number.isNaN(total)
                      ? `$${total.toFixed(2)}`
                      : '—';
                  const hasPayment = Boolean(aptAny.transaction_id || aptAny.billed);
                  const paymentLabel =
                    hasPayment
                      ? t('apptBook.paymentPaid')
                      : normalizeAppointmentStatus(apt.status) === 'completed'
                        ? t('apptBook.paymentUnpaid')
                        : t('apptBook.paymentDash');

                  return (
                    <TableRow key={apt.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {apt.id.replace(/-/g, '').slice(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(apt.status)}>{formatStatusLabel(apt.status)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {pet ? `${pet.name}${breed}` : t('appointments.unknownPet')}
                      </TableCell>
                      <TableCell>{clientName}</TableCell>
                      <TableCell>{dateStr}</TableCell>
                      <TableCell>{timeStr || '—'}</TableCell>
                      <TableCell>{serviceLabel}</TableCell>
                      <TableCell>{staffName}</TableCell>
                      <TableCell className="text-muted-foreground">{paymentLabel}</TableCell>
                      <TableCell className="text-right font-medium">{totalStr}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {canMarkNoShow && onMarkNoShow ? (
                            <AppointmentNoShowControl
                              status={apt.status}
                              compact
                              onMarkNoShow={() => onMarkNoShow(apt.id)}
                            />
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(apt)}
                            aria-label={t('common.edit')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
