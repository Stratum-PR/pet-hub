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
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
import { useEmployees } from '@/hooks/useSupabaseData';
import {
  convertAppointmentsToCalendar,
  convertAppointmentsToCalendarInRange,
  convertEmployeesToCalendar,
} from '@/lib/calendarHelpers';
import { BookingFormDialog } from '@/components/BookingFormDialog';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import { AppointmentBookListView } from '@/components/AppointmentBookListView';
import { PawStagedLoadingArea } from '@/components/PawStagedLoading';
import { PawRevealEnter } from '@/components/PawRevealEnter';
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

  const pathMode = apptBookPathMode(location.pathname);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{
    staffId: string | null;
    date: Date | null;
  }>({ staffId: null, date: null });

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
    if (date) setSelectedDate(date);
  };

  const stepDays = calendarScope === 'by-week' ? 7 : 1;

  const handlePreviousPeriod = () => {
    setSelectedDate((prev) => subDays(prev, stepDays));
  };

  const handleNextPeriod = () => {
    setSelectedDate((prev) => addDays(prev, stepDays));
  };

  const handleToolbarToday = () => {
    const n = new Date();
    if (calendarScope === 'by-week') {
      setSelectedDate(startOfWeek(n, { weekStartsOn: 0 }));
    } else {
      setSelectedDate(startOfDay(n));
    }
  };

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
    if (calendarScope === 'by-week' && filters.service !== 'Daycare') {
      return `${format(weekAnchor, 'MMM d, yyyy')} – ${format(weekEndDate, 'MMM d, yyyy')}`;
    }
    return format(selectedDate, 'EEEE, MMMM d, yyyy');
  }, [calendarScope, filters.service, weekAnchor, weekEndDate, selectedDate]);

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

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden bg-background -m-6">
      <AppointmentBookSidebar
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onToday={handleToolbarToday}
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

      <div className="flex flex-1 flex-col overflow-hidden">
        {fetchError && (
          <div className="mx-4 mt-2 flex flex-col items-start justify-between gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 sm:flex-row sm:items-center">
            <p className="text-sm font-medium text-destructive">Failed to load data. {fetchError}</p>
            <Button variant="outline" size="sm" onClick={() => refetchAll()}>
              Retry
            </Button>
          </div>
        )}

        <div className="page-toolbar-strip flex justify-end px-6 py-3">
          <Tabs value={tabsValue} onValueChange={onTabChange}>
            <TabsList className="bg-transparent">
              <TabsTrigger value="calendar">{t('appointments.calendar')}</TabsTrigger>
              <TabsTrigger value="list">{t('apptBook.appointmentList')}</TabsTrigger>
              <TabsTrigger value="requests" className="relative">
                {t('apptBook.onlineRequests')}
                <Badge className="ml-2 bg-destructive text-xs text-destructive-foreground">13</Badge>
              </TabsTrigger>
              <TabsTrigger value="settings">{t('apptBook.settings')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {showCalendarChrome && (
          <div className="shrink-0 border-b border-border bg-muted/30 px-6 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleToolbarToday}>
                  {t('appointments.today').toUpperCase()}
                </Button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePreviousPeriod}
                    className="rounded p-1 hover:bg-muted"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                  </button>
                  <span className="min-w-[200px] text-center text-sm font-medium text-foreground sm:text-base">
                    {toolbarDateLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextPeriod}
                    className="rounded p-1 hover:bg-muted"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                {filters.service !== 'Daycare' ? (
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
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={filters.service}
                  onValueChange={(value) => handleFilterChange('service', value)}
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

                {filters.service === 'Daycare' ? (
                  <Select
                    value={filters.staff || 'All Rooms'}
                    onValueChange={(value) => handleFilterChange('staff', value)}
                  >
                    <SelectTrigger className="w-[140px]">
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
                    <SelectTrigger className="w-[160px]">
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

        {tabsValue === 'calendar' && (
          <div className="relative flex flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="relative flex min-h-[320px] flex-1 flex-col">
                <PawStagedLoadingArea label={t('common.loading')} size="lg" className="min-h-0 flex-1" />
              </div>
            ) : (
              <PawRevealEnter className="h-full min-h-0">
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
                      console.log('Check in:', appointmentId);
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
                    onAppointmentClick={(apt) => openEditFromCalendarCard(apt.id)}
                    onCellClick={(employeeId, day) => openCreate({ staffId: employeeId, date: day })}
                  />
                ) : (
                  <AppointmentBookDayGrid
                    appointments={displayCalendarAppointments}
                    employees={calendarEmployees}
                    onAppointmentClick={(apt) => openEditFromCalendarCard(apt.id)}
                    canMarkNoShow={canMarkNoShow}
                    onMarkNoShow={handleMarkNoShow}
                    onStaffQuickBook={(employeeId) => openCreate({ staffId: employeeId })}
                  />
                )}
              </PawRevealEnter>
            )}
          </div>
        )}

        {tabsValue === 'list' && (
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="relative flex min-h-[320px] flex-1 flex-col">
                <PawStagedLoadingArea label={t('common.loading')} size="lg" className="min-h-0 flex-1" />
              </div>
            ) : (
              <PawRevealEnter className="h-full min-h-0">
                <AppointmentBookListView
                  appointments={appointments}
                  pets={pets}
                  clients={clients}
                  services={services}
                  employees={employees}
                  calendarEmployees={calendarEmployees}
                  selectedDate={selectedDate}
                  onSelectDate={(d) => setSelectedDate(startOfDay(d))}
                  onPreviousDay={() => setSelectedDate((p) => subDays(p, 1))}
                  onNextDay={() => setSelectedDate((p) => addDays(p, 1))}
                  onToday={() => setSelectedDate(startOfDay(new Date()))}
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
              </PawRevealEnter>
            )}
          </div>
        )}

        {tabsValue === 'requests' && (
          <div className="flex-1 p-6">
            <p className="text-gray-500">Online Requests view coming soon...</p>
          </div>
        )}

        {tabsValue === 'settings' && (
          <div className="flex-1 p-6">
            <p className="text-gray-500">Settings view coming soon...</p>
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
