import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  startOfDay,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
} from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, List, Loader2, Settings } from 'lucide-react';
import { CalendarFilters, CalendarView } from '@/types/calendar';
import { AppointmentBookSidebar } from '@/components/AppointmentBookSidebar';
import { DaycareCalendarView } from '@/components/DaycareCalendarView';
import { AppointmentBookDayGrid } from '@/components/AppointmentBookDayGrid';
import { AppointmentBookWeekView } from '@/components/AppointmentBookWeekView';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/lib/translations';
import { useAppointments, usePets, useServices, useClients, type Appointment } from '@/hooks/useBusinessData';
import { useEmployees, useSettings } from '@/hooks/useSupabaseData';
import {
  convertAppointmentsToCalendar,
  convertAppointmentsToCalendarInRange,
  convertEmployeesToCalendar,
} from '@/lib/calendarHelpers';
import { BookingFormDialog } from '@/components/BookingFormDialog';
import { devConsole } from '@/lib/clientDebug';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import { AppointmentBookListView } from '@/components/AppointmentBookListView';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import {
  getStoredApptBookServiceFilter,
  setStoredApptBookServiceFilter,
  getStoredApptBookCalendarScope,
  setStoredApptBookCalendarScope,
  getStoredSidebarFilterMode,
  setStoredSidebarFilterMode,
  getStoredSelectedServiceIds,
  setStoredSelectedServiceIds,
  getStoredSelectedEmployeeIds,
  setStoredSelectedEmployeeIds,
  clearApptBookCategoryFilterStorage,
  clearStoredSelectedServiceIds,
  clearStoredSelectedEmployeeIds,
  type ApptBookCalendarScope,
  type ApptBookSidebarFilterMode,
} from '@/lib/apptBookCalendarPrefs';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { firstOpenDayInWeek, isOpenBusinessDay, parseBusinessHours } from '@/lib/businessHours';
import type { ApptBookWeekJumpOffset } from '@/components/AppointmentBookSidebar';
import { useLanguage } from '@/contexts/LanguageContext';

function apptBookPathMode(pathname: string): 'calendar' | 'list' {
  const parts = pathname.split('/').filter(Boolean);
  const i = parts.indexOf('appt-book');
  if (i < 0) return 'calendar';
  return parts[i + 1] === 'appointments' ? 'list' : 'calendar';
}

export function AppointmentBook() {
  const location = useLocation();
  const navigate = useNavigate();
  const businessSlug = useResolvedBusinessSlug();
  const apptBookBase = `${businessSlug ? `/${businessSlug}` : ''}/appt-book`;
  const { language } = useLanguage();
  const dateFnsLocale = language === 'es' ? esLocale : enUS;

  const pathMode = apptBookPathMode(location.pathname);

  /** Canonical URL: /…/appt-book → /…/appt-book/calendar (replaces old nested index route). */
  useEffect(() => {
    const segs = location.pathname.split('/').filter(Boolean);
    const idx = segs.indexOf('appt-book');
    if (idx < 0) return;
    const rest = segs[idx + 1];
    if (rest == null || rest === '') {
      navigate(`${apptBookBase}/calendar`, { replace: true });
    }
  }, [location.pathname, apptBookBase, navigate]);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekJumpOffset, setWeekJumpOffset] = useState<ApptBookWeekJumpOffset | null>(null);
  const [weekJumpNoAvailability, setWeekJumpNoAvailability] = useState(false);
  const [overlayTab, setOverlayTab] = useState<'requests' | 'settings' | null>(null);

  const [filters, setFilters] = useState<CalendarFilters>(() => {
    const svc = getStoredApptBookServiceFilter();
    return {
      service: svc,
      staff: svc === 'Daycare' ? 'All Rooms' : 'All Employees',
      view: 'day',
    };
  });

  const [calendarScope, setCalendarScope] = useState<ApptBookCalendarScope>(() =>
    getStoredApptBookCalendarScope(),
  );
  const [sidebarFilterMode, setSidebarFilterMode] = useState<ApptBookSidebarFilterMode>(() =>
    getStoredSidebarFilterMode(),
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string> | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string> | null>(null);
  const [categorySearch, setCategorySearch] = useState('');

  const [waitlistCollapsed, setWaitlistCollapsed] = useState(false);

  const { role, profile } = useAuth();
  const {
    appointments,
    loading: appointmentsLoading,
    error: appointmentsError,
    addAppointment,
    updateAppointment,
    refetch: refetchAppointments,
  } = useAppointments();
  const canMarkNoShow =
    role === 'manager' || role === 'super_admin' || !!profile?.is_super_admin;

  const handleMarkNoShow = async (id: string) => {
    const r = await updateAppointment(id, { status: 'no_show' });
    if (r) toast.success(t('appointments.markedNoShow'));
    else toast.error(t('appointments.noShowFailed'));
  };
  const { pets, loading: petsLoading, error: petsError, refetch: refetchPets } = usePets();
  const { employees, loading: employeesLoading, error: employeesError, refetch: refetchEmployees } =
    useEmployees();
  const { services, loading: servicesLoading, error: servicesError, refetch: refetchServices } =
    useServices();
  const { clients, error: clientsError, refetch: refetchClients } = useClients();
  const { settings } = useSettings();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{
    staffId: string | null;
    date: Date | null;
  }>({ staffId: null, date: null });

  const clearWeekJump = useCallback(() => {
    setWeekJumpOffset(null);
    setWeekJumpNoAvailability(false);
  }, []);

  const openCreate = useCallback(
    (opts?: { staffId?: string | null; date?: Date | null }) => {
      const day =
        opts?.date != null ? startOfDay(opts.date) : startOfDay(selectedDate);
      setCreatePrefill({
        staffId: opts?.staffId ?? null,
        date: day,
      });
      setCreateDialogOpen(true);
    },
    [selectedDate],
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const loading = appointmentsLoading || petsLoading || employeesLoading || servicesLoading;
  const fetchError = appointmentsError ?? petsError ?? employeesError ?? servicesError ?? clientsError;
  const refetchAll = () => {
    refetchAppointments();
    refetchPets();
    refetchEmployees();
    refetchServices();
    refetchClients();
  };

  const calendarEmployees = useMemo(() => convertEmployeesToCalendar(employees), [employees]);
  const hoursPerDay = useMemo(
    () => parseBusinessHours(settings?.business_hours),
    [settings?.business_hours],
  );
  const activeServices = useMemo(
    () => services.filter((s) => s.is_active !== false),
    [services],
  );
  const allServiceIds = useMemo(() => activeServices.map((s) => s.id), [activeServices]);
  const allEmployeeIds = useMemo(() => calendarEmployees.map((e) => e.id), [calendarEmployees]);

  const filterPrefHydrated = useRef(false);
  useEffect(() => {
    if (loading || filterPrefHydrated.current || allServiceIds.length === 0) return;
    filterPrefHydrated.current = true;
    const ss = getStoredSelectedServiceIds();
    if (ss && ss.length > 0) {
      const v = new Set(ss.filter((id) => allServiceIds.includes(id)));
      if (v.size > 0 && v.size < allServiceIds.length) setSelectedServiceIds(v);
    }
    const se = getStoredSelectedEmployeeIds();
    if (se && se.length > 0) {
      const v = new Set(se.filter((id) => allEmployeeIds.includes(id)));
      if (v.size > 0 && v.size < allEmployeeIds.length) setSelectedEmployeeIds(v);
    }
  }, [loading, allServiceIds, allEmployeeIds]);

  useEffect(() => {
    if (!filterPrefHydrated.current || allServiceIds.length === 0) return;
    if (!selectedServiceIds || selectedServiceIds.size === allServiceIds.length) {
      clearStoredSelectedServiceIds();
    } else {
      setStoredSelectedServiceIds([...selectedServiceIds]);
    }
  }, [selectedServiceIds, allServiceIds.length]);

  useEffect(() => {
    if (!filterPrefHydrated.current || allEmployeeIds.length === 0) return;
    if (!selectedEmployeeIds || selectedEmployeeIds.size === allEmployeeIds.length) {
      clearStoredSelectedEmployeeIds();
    } else {
      setStoredSelectedEmployeeIds([...selectedEmployeeIds]);
    }
  }, [selectedEmployeeIds, allEmployeeIds.length]);

  useEffect(() => {
    setStoredApptBookServiceFilter(filters.service);
  }, [filters.service]);

  useEffect(() => {
    setStoredApptBookCalendarScope(calendarScope);
  }, [calendarScope]);

  useEffect(() => {
    setStoredSidebarFilterMode(sidebarFilterMode);
  }, [sidebarFilterMode]);

  useEffect(() => {
    setOverlayTab(null);
  }, [pathMode]);

  useEffect(() => {
    if (filters.service === 'Daycare') clearWeekJump();
  }, [filters.service, clearWeekJump]);

  const weekAnchor = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 0 }),
    [selectedDate],
  );
  const weekEndDate = useMemo(() => endOfWeek(selectedDate, { weekStartsOn: 0 }), [selectedDate]);
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekAnchor, end: weekEndDate }),
    [weekAnchor, weekEndDate],
  );

  const baseCalendarAppointments = useMemo(() => {
    if (loading) return [];
    const weekGrooming = calendarScope === 'by-week' && filters.service !== 'Daycare';
    if (weekGrooming) {
      return convertAppointmentsToCalendarInRange(
        appointments,
        pets,
        employees,
        services,
        weekAnchor,
        weekEndDate,
      );
    }
    return convertAppointmentsToCalendar(
      appointments,
      pets,
      employees,
      services,
      selectedDate,
    );
  }, [
    loading,
    calendarScope,
    filters.service,
    appointments,
    pets,
    employees,
    services,
    selectedDate,
    weekAnchor,
    weekEndDate,
  ]);

  const serviceStaffFiltered = useMemo(() => {
    let filtered = baseCalendarAppointments;

    if (filters.service !== 'All Services') {
      filtered = filtered.filter((apt) => {
        const serviceName = apt.service.toLowerCase();
        if (filters.service === 'Grooming') {
          return !serviceName.includes('daycare');
        }
        if (filters.service === 'Daycare') {
          return serviceName.includes('daycare');
        }
        return true;
      });
    }

    if (filters.service === 'Daycare') {
      if (filters.staff !== 'All Rooms') {
        /* room filter placeholder */
      }
    } else {
      if (filters.staff !== 'All Employees' && filters.staff !== 'All Rooms') {
        const staffMember = calendarEmployees.find((e) => e.name === filters.staff);
        if (staffMember) {
          filtered = filtered.filter((apt) => apt.staffId === staffMember.id);
        }
      }
    }

    return filtered;
  }, [baseCalendarAppointments, calendarEmployees, filters]);

  const displayCalendarAppointments = useMemo(() => {
    let rows = serviceStaffFiltered;
    if (sidebarFilterMode === 'specialist') {
      if (
        selectedEmployeeIds &&
        selectedEmployeeIds.size > 0 &&
        selectedEmployeeIds.size < calendarEmployees.length
      ) {
        rows = rows.filter((a) => a.staffId && selectedEmployeeIds.has(a.staffId));
      }
    } else {
      if (
        selectedServiceIds &&
        selectedServiceIds.size > 0 &&
        selectedServiceIds.size < allServiceIds.length
      ) {
        rows = rows.filter((a) => {
          const sid = a.serviceId ?? appointments.find((x) => x.id === a.id)?.service_id;
          return sid && selectedServiceIds.has(sid);
        });
      }
      if (categorySearch.trim()) {
        const q = categorySearch.trim().toLowerCase();
        rows = rows.filter((a) => (a.service || '').toLowerCase().includes(q));
      }
    }
    return rows;
  }, [
    serviceStaffFiltered,
    sidebarFilterMode,
    selectedEmployeeIds,
    selectedServiceIds,
    calendarEmployees.length,
    allServiceIds.length,
    categorySearch,
    appointments,
  ]);

  const handleDateChange = (date: Date | undefined) => {
    if (!date) return;
    const d = startOfDay(date);
    if (!isOpenBusinessDay(d, hoursPerDay)) return;
    clearWeekJump();
    setSelectedDate(d);
  };

  const stepDays = calendarScope === 'by-week' ? 7 : 1;

  const handlePreviousPeriod = () => {
    clearWeekJump();
    setSelectedDate((prev) => subDays(prev, stepDays));
  };

  const handleNextPeriod = () => {
    clearWeekJump();
    setSelectedDate((prev) => addDays(prev, stepDays));
  };

  const handleToolbarToday = () => {
    clearWeekJump();
    const n = new Date();
    setSelectedDate(startOfDay(n));
  };

  const isBookableCalendarDate = useCallback(
    (d: Date) => isOpenBusinessDay(startOfDay(d), hoursPerDay),
    [hoursPerDay],
  );

  const applyWeekJump = useCallback(
    (offset: ApptBookWeekJumpOffset) => {
      const today = startOfDay(new Date());
      const thisWeekSunday = startOfWeek(today, { weekStartsOn: 0 });
      const targetWeekSunday = addWeeks(thisWeekSunday, offset);
      const firstOpen = firstOpenDayInWeek(targetWeekSunday, hoursPerDay);
      setWeekJumpOffset(offset);
      if (firstOpen) {
        setSelectedDate(startOfDay(firstOpen));
        setWeekJumpNoAvailability(false);
      } else {
        setWeekJumpNoAvailability(true);
        setSelectedDate(startOfDay(targetWeekSunday));
      }
    },
    [hoursPerDay],
  );

  const handleWeekCellClick = useCallback(
    (employeeId: string, day: Date) => {
      clearWeekJump();
      openCreate({ staffId: employeeId, date: day });
    },
    [clearWeekJump, openCreate],
  );

  const handleFilterChange = (key: keyof CalendarFilters, value: string | CalendarView) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'service') {
        const v = value as string;
        if (v === 'Daycare') next.staff = 'All Rooms';
        else next.staff = 'All Employees';
        setStoredApptBookServiceFilter(v);
      }
      return next;
    });
  };

  const toolbarDateLabel = useMemo(() => {
    const opts = { locale: dateFnsLocale };
    if (calendarScope === 'by-week' && filters.service !== 'Daycare') {
      return `${format(weekAnchor, 'd MMM yyyy', opts)} – ${format(weekEndDate, 'd MMM yyyy', opts)}`;
    }
    return format(selectedDate, 'EEEE, d MMMM yyyy', opts);
  }, [calendarScope, filters.service, weekAnchor, weekEndDate, selectedDate, dateFnsLocale]);

  const toggleServiceId = useCallback(
    (id: string) => {
      setSelectedServiceIds((prev) => {
        const all = !prev || prev.size === allServiceIds.length;
        if (all) {
          const next = new Set(allServiceIds);
          next.delete(id);
          return next;
        }
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (next.size === 0 || next.size === allServiceIds.length) return null;
        return next;
      });
    },
    [allServiceIds],
  );

  const selectAllServices = useCallback(() => setSelectedServiceIds(null), []);

  const toggleEmployeeId = useCallback(
    (id: string) => {
      setSelectedEmployeeIds((prev) => {
        const all = !prev || prev.size === calendarEmployees.length;
        if (all) {
          const next = new Set(calendarEmployees.map((e) => e.id));
          next.delete(id);
          return next;
        }
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (next.size === 0 || next.size === calendarEmployees.length) return null;
        return next;
      });
    },
    [calendarEmployees],
  );

  const selectAllEmployees = useCallback(() => setSelectedEmployeeIds(null), []);

  const clearFilters = useCallback(() => {
    setSelectedServiceIds(null);
    setSelectedEmployeeIds(null);
    setCategorySearch('');
    setFilters((prev) => ({
      ...prev,
      service: 'All Services',
      staff: 'All Employees',
    }));
    setStoredApptBookServiceFilter('All Services');
    clearApptBookCategoryFilterStorage();
  }, []);

  const openEditFromCalendarCard = useCallback(
    (aptId: string) => {
      const row = appointments.find((a) => a.id === aptId) ?? null;
      if (!row) {
        toast.error(t('apptBook.openAppointmentFailed'));
        return;
      }
      setEditingAppointment(row);
      setEditDialogOpen(true);
    },
    [appointments],
  );

  const tabsValue: 'calendar' | 'list' | 'requests' | 'settings' =
    overlayTab ?? (pathMode === 'list' ? 'list' : 'calendar');

  const onTabChange = (v: string) => {
    if (v === 'calendar') {
      navigate(`${apptBookBase}/calendar`);
      setOverlayTab(null);
      return;
    }
    if (v === 'list') {
      navigate(`${apptBookBase}/appointments`);
      setOverlayTab(null);
      return;
    }
    if (v === 'requests') setOverlayTab('requests');
    if (v === 'settings') setOverlayTab('settings');
  };

  const showCalendarChrome = tabsValue === 'calendar';
  const showWeekJumpControls = showCalendarChrome && filters.service !== 'Daycare' && !loading;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-background -mx-4 max-sm:pb-2 sm:-mx-6 sm:flex-row sm:items-stretch sm:overflow-hidden">
      <AppointmentBookSidebar
        className="max-sm:order-2 max-sm:border-t max-sm:border-border"
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onToday={handleToolbarToday}
        dateLocale={dateFnsLocale}
        showWeekJumpControls={showWeekJumpControls}
        weekJumpOffset={weekJumpOffset}
        onWeekJump={applyWeekJump}
        weekJumpNoAvailability={weekJumpNoAvailability}
        isBookableDate={isBookableCalendarDate}
        waitlist={[]}
        waitlistCollapsed={waitlistCollapsed}
        onWaitlistToggle={() => setWaitlistCollapsed(!waitlistCollapsed)}
        onCreateClick={() => openCreate()}
        showCalendarFilters={showCalendarChrome && !loading}
        sidebarFilterMode={sidebarFilterMode}
        onSidebarFilterModeChange={setSidebarFilterMode}
        activeServices={activeServices}
        selectedServiceIds={selectedServiceIds}
        onToggleServiceId={toggleServiceId}
        onSelectAllServices={selectAllServices}
        categorySearch={categorySearch}
        onCategorySearchChange={setCategorySearch}
        calendarEmployees={calendarEmployees}
        selectedEmployeeIds={selectedEmployeeIds}
        onToggleEmployeeId={toggleEmployeeId}
        onSelectAllEmployees={selectAllEmployees}
        onClearFilters={clearFilters}
      />

      <div className="flex min-h-0 min-w-0 max-w-full flex-col overflow-visible max-sm:order-1 max-sm:min-h-0 sm:flex-1 sm:overflow-hidden">
        {fetchError && (
          <div className="mx-4 mt-2 flex flex-col items-start justify-between gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 sm:flex-row sm:items-center">
            <p className="text-sm font-medium text-destructive">
              {t('apptBook.loadError')} {fetchError}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchAll()}>
              {t('apptBook.retry')}
            </Button>
          </div>
        )}

        <div className="page-toolbar-strip -mx-px flex w-full min-w-0 justify-start overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 py-3 touch-pan-x [-webkit-overflow-scrolling:touch] sm:mx-0 sm:justify-end sm:px-6">
          <Tabs value={tabsValue} onValueChange={onTabChange} className="w-max min-w-0 shrink-0 sm:w-auto">
            <TabsList className="inline-flex h-auto w-max shrink-0 flex-nowrap items-center justify-start gap-1 rounded-lg border border-border/60 bg-muted/40 p-1 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
              <TabsTrigger
                value="calendar"
                className="shrink-0 gap-1.5 px-2.5 py-2 text-xs sm:px-3 sm:text-sm"
                aria-label={t('appointments.calendar')}
                title={t('appointments.calendar')}
              >
                <CalendarDays className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">{t('appointments.calendar')}</span>
              </TabsTrigger>
              <TabsTrigger
                value="list"
                className="shrink-0 gap-1.5 px-2.5 py-2 text-xs sm:px-3 sm:text-sm"
                aria-label={t('apptBook.appointmentList')}
                title={t('apptBook.appointmentList')}
              >
                <List className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">{t('apptBook.appointmentList')}</span>
              </TabsTrigger>
              <TabsTrigger
                value="requests"
                className="relative shrink-0 gap-1.5 px-2.5 py-2 text-xs sm:px-3 sm:text-sm"
                aria-label={t('apptBook.onlineRequests')}
                title={t('apptBook.onlineRequests')}
              >
                <span className="relative inline-flex sm:hidden">
                  <Inbox className="h-4 w-4 shrink-0" aria-hidden />
                  <Badge className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center border-2 border-background bg-destructive px-0.5 text-[9px] text-destructive-foreground sm:hidden">
                    13
                  </Badge>
                </span>
                <span className="hidden sm:inline">{t('apptBook.onlineRequests')}</span>
                <Badge className="ml-2 hidden bg-destructive text-xs text-destructive-foreground sm:inline-flex">13</Badge>
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="shrink-0 gap-1.5 px-2.5 py-2 text-xs sm:px-3 sm:text-sm"
                aria-label={t('apptBook.settings')}
                title={t('apptBook.settings')}
              >
                <Settings className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">{t('apptBook.settings')}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {showCalendarChrome && (
          <div className="shrink-0 border-b border-border bg-muted/30 px-3 py-3 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                <Button variant="outline" size="sm" onClick={handleToolbarToday} className="shrink-0">
                  {t('appointments.today')}
                </Button>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:flex-initial sm:justify-start">
                  <button
                    type="button"
                    onClick={handlePreviousPeriod}
                    className="rounded p-1 hover:bg-muted"
                    aria-label={t('apptBook.navigatePrevious')}
                  >
                    <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                  </button>
                  <span className="min-w-0 flex-1 px-1 text-center text-xs font-medium capitalize text-foreground sm:flex-initial sm:text-sm md:text-base">
                    {toolbarDateLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextPeriod}
                    className="rounded p-1 hover:bg-muted"
                    aria-label={t('apptBook.navigateNext')}
                  >
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                {filters.service !== 'Daycare' ? (
                  <>
                    <div className="hidden sm:block">
                      <Tabs
                        value={calendarScope}
                        onValueChange={(v) => setCalendarScope(v as ApptBookCalendarScope)}
                      >
                        <TabsList className="h-9">
                          <TabsTrigger value="by-day" className="px-3 text-xs sm:text-sm">
                            {t('apptBook.byDay')}
                          </TabsTrigger>
                          <TabsTrigger value="by-week" className="px-3 text-xs sm:text-sm">
                            {t('apptBook.byWeek')}
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="w-full min-w-0 sm:hidden">
                      <Select
                        value={calendarScope}
                        onValueChange={(v) => setCalendarScope(v as ApptBookCalendarScope)}
                      >
                        <SelectTrigger className="h-9 w-full" aria-label={t('apptBook.calendarViewScope')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="by-day">{t('apptBook.byDay')}</SelectItem>
                          <SelectItem value="by-week">{t('apptBook.byWeek')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Select
                  value={filters.service}
                  onValueChange={(value) => handleFilterChange('service', value)}
                >
                  <SelectTrigger className="w-full min-w-0 sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Grooming">{t('apptBook.filterGrooming')}</SelectItem>
                    <SelectItem value="Daycare">{t('apptBook.filterDaycare')}</SelectItem>
                    <SelectItem value="All Services">{t('apptBook.filterAllServices')}</SelectItem>
                  </SelectContent>
                </Select>

                {filters.service === 'Daycare' ? (
                  <Select
                    value={filters.staff || 'All Rooms'}
                    onValueChange={(value) => handleFilterChange('staff', value)}
                  >
                    <SelectTrigger className="w-full min-w-0 sm:w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Rooms">{t('apptBook.allRooms')}</SelectItem>
                      <SelectItem value="HighEnergy">HighEnergy</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                      <SelectItem value="Puppy">Puppy</SelectItem>
                      <SelectItem value="Small Dogs">Small Dogs</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={filters.staff || 'All Employees'}
                    onValueChange={(value) => handleFilterChange('staff', value)}
                  >
                    <SelectTrigger className="w-full min-w-0 sm:w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Employees">{t('apptBook.allEmployees')}</SelectItem>
                      {calendarEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.name}>
                          {formatStaffNameAggregated(emp.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  {t('apptBook.clearFilters')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {(tabsValue === 'calendar' || tabsValue === 'list') && (
          <div className="relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden max-sm:flex-none max-sm:overflow-visible sm:flex-1 sm:overflow-hidden">
            {loading ? (
              <div className="relative flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 text-muted-foreground max-sm:min-h-[240px]">
                <Loader2 className="h-8 w-8 animate-spin shrink-0" aria-hidden />
                <span className="text-sm">{t('common.loading')}</span>
              </div>
            ) : (
              <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden max-sm:flex-none max-sm:overflow-visible sm:flex-1 sm:overflow-hidden">
                {tabsValue === 'calendar' ? (
                  <>
                    {weekJumpNoAvailability && filters.service !== 'Daycare' ? (
                      <div
                        className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-900 sm:px-6 dark:text-amber-100"
                        role="status"
                      >
                        {t('apptBook.noAvailabilityInWeek')}
                      </div>
                    ) : null}
                    {filters.service === 'Daycare' ? (
                      <DaycareCalendarView
                        selectedDate={selectedDate}
                        appointments={displayCalendarAppointments}
                        pets={pets}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onPreviousDay={handlePreviousPeriod}
                        onNextDay={handleNextPeriod}
                        onToday={handleToolbarToday}
                        onCheckIn={(appointmentId) => {
                          devConsole.log('Check in:', appointmentId);
                        }}
                        onCreateClick={() => openCreate()}
                        canMarkNoShow={canMarkNoShow}
                        onMarkNoShow={handleMarkNoShow}
                        suppressHeader
                      />
                    ) : calendarScope === 'by-week' ? (
                      <AppointmentBookWeekView
                        weekDays={weekDays}
                        employees={calendarEmployees}
                        appointments={displayCalendarAppointments}
                        selectedDate={selectedDate}
                        dateLocale={dateFnsLocale}
                        onAppointmentClick={(apt) => openEditFromCalendarCard(apt.id)}
                        onCellClick={handleWeekCellClick}
                      />
                    ) : (
                      <AppointmentBookDayGrid
                        appointments={displayCalendarAppointments}
                        employees={calendarEmployees}
                        hoursPerDay={hoursPerDay}
                        selectedDate={selectedDate}
                        onAppointmentClick={(apt) => openEditFromCalendarCard(apt.id)}
                        canMarkNoShow={canMarkNoShow}
                        onMarkNoShow={handleMarkNoShow}
                        onStaffQuickBook={(employeeId) => openCreate({ staffId: employeeId })}
                      />
                    )}
                  </>
                ) : (
                  <AppointmentBookListView
                    appointments={appointments}
                    pets={pets}
                    clients={clients}
                    services={services}
                    employees={employees}
                    calendarEmployees={calendarEmployees}
                    selectedDate={selectedDate}
                    onSelectDate={(d) => {
                      clearWeekJump();
                      setSelectedDate(startOfDay(d));
                    }}
                    onPreviousDay={() => {
                      clearWeekJump();
                      setSelectedDate((p) => subDays(p, 1));
                    }}
                    onNextDay={() => {
                      clearWeekJump();
                      setSelectedDate((p) => addDays(p, 1));
                    }}
                    onToday={() => {
                      clearWeekJump();
                      setSelectedDate(startOfDay(new Date()));
                    }}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    canMarkNoShow={canMarkNoShow}
                    onMarkNoShow={handleMarkNoShow}
                    onEdit={(apt) => {
                      setEditingAppointment(apt);
                      setEditDialogOpen(true);
                    }}
                    onClearFilters={clearFilters}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {tabsValue === 'requests' && (
          <div className="flex-1 p-4 sm:p-6 max-sm:flex-none">
            <p className="text-gray-500">{t('apptBook.onlineRequestsComingSoon')}</p>
          </div>
        )}

        {tabsValue === 'settings' && (
          <div className="flex-1 p-4 sm:p-6 max-sm:flex-none">
            <p className="text-gray-500">{t('apptBook.settingsViewComingSoon')}</p>
          </div>
        )}
      </div>

      <BookingFormDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setCreatePrefill({ staffId: null, date: null });
        }}
        clients={clients}
        pets={pets}
        services={services}
        appointments={appointments}
        preselectedStaffId={createPrefill.staffId}
        preselectedDate={createPrefill.date}
        onSuccess={() => {
          refetchAppointments();
          setCreateDialogOpen(false);
          setCreatePrefill({ staffId: null, date: null });
        }}
        onAddAppointment={addAppointment}
      />

      <EditAppointmentDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingAppointment(null);
        }}
        appointment={editingAppointment}
        clients={clients}
        pets={pets}
        services={services}
        employees={employees}
        appointments={appointments}
        onUpdate={updateAppointment}
        onSuccess={() => {
          void refetchAppointments();
          setEditDialogOpen(false);
          setEditingAppointment(null);
        }}
      />
    </div>
  );
}
