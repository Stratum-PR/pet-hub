import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar as CalendarDateRange } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, Clock, Users, Dog, Calendar, ChevronDown, LayoutDashboard } from 'lucide-react';
import { Pet, Employee, TimeEntry, Appointment } from '@/types';
import {
  format,
  subDays,
  eachDayOfInterval,
  differenceInMinutes,
  startOfDay,
  addDays,
  differenceInDays,
  differenceInCalendarDays,
  addMonths,
  min as minDate,
  max as maxDate,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { es as dateFnsEs } from 'date-fns/locale';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTransactions } from '@/hooks/useTransactions';
import { timeEntryCountsTowardPayroll } from '@/lib/timeEntryStatus';
import {
  DASHBOARD_PERIOD_KEY,
  loadSavedCustomRange,
  loadSavedPeriod,
  persistCustomRange,
  sumSaleCentsInInclusiveDayRange,
  type DashboardPeriodType,
} from '@/lib/dashboardPeriodRange';
import { DashboardRevenueChart, type DashboardRevenueChartPoint } from '@/components/DashboardRevenueChart';
import { useMinWidthSm } from '@/hooks/useMinWidthSm';
import { cn } from '@/lib/utils';

interface ReportsProps {
  pets: Pet[];
  employees: Employee[];
  timeEntries: TimeEntry[];
  appointments: Appointment[];
}

const COLORS = ['hsl(168, 60%, 45%)', 'hsl(200, 55%, 55%)', 'hsl(145, 50%, 45%)', 'hsl(180, 45%, 50%)'];

const SALE_STATUSES = ['paid', 'partial'];

export function Reports({ pets, employees, timeEntries, appointments }: ReportsProps) {
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? dateFnsEs : undefined;
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const isWide = useMinWidthSm();
  const { transactions } = useTransactions();

  const [dashboardPeriod, setDashboardPeriodState] = useState<DashboardPeriodType>('monthly');
  const [customRangeStart, setCustomRangeStart] = useState<Date | null>(null);
  const [customRangeEnd, setCustomRangeEnd] = useState<Date | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [rangeSelect, setRangeSelect] = useState<{ from?: Date; to?: Date }>({});

  useEffect(() => {
    const saved = loadSavedPeriod();
    setDashboardPeriodState(saved);
    if (saved === 'custom') {
      const range = loadSavedCustomRange();
      if (range) {
        setCustomRangeStart(range.start);
        setCustomRangeEnd(range.end);
      }
    }
  }, []);

  const setDashboardPeriod = (period: DashboardPeriodType) => {
    setDashboardPeriodState(period);
    try {
      localStorage.setItem(DASHBOARD_PERIOD_KEY, period);
    } catch {
      /* ignore */
    }
  };

  const today = useMemo(() => startOfDay(new Date()), []);
  const periodDaysMap = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 } as const;
  const periodDays =
    dashboardPeriod === 'custom'
      ? customRangeStart && customRangeEnd
        ? differenceInDays(customRangeEnd, customRangeStart) + 1
        : 30
      : periodDaysMap[dashboardPeriod];

  const periodStart = useMemo(() => {
    if (dashboardPeriod === 'custom' && customRangeStart && customRangeEnd)
      return startOfDay(customRangeStart);
    return subDays(today, periodDays - 1);
  }, [dashboardPeriod, customRangeStart, customRangeEnd, periodDays, today]);

  const periodEnd = useMemo(() => {
    if (dashboardPeriod === 'custom' && customRangeStart && customRangeEnd)
      return startOfDay(customRangeEnd);
    return today;
  }, [dashboardPeriod, customRangeStart, customRangeEnd, today]);

  const chartEnterKey = periodStart.getTime() + periodEnd.getTime();

  const sales = useMemo(
    () => transactions.filter((t) => SALE_STATUSES.includes(t.status)),
    [transactions]
  );

  const totalRevenue = useMemo(() => {
    const cents = sumSaleCentsInInclusiveDayRange(sales, periodStart, periodEnd);
    return cents / 100;
  }, [sales, periodStart, periodEnd]);

  const periodRevenueChartData = useMemo((): DashboardRevenueChartPoint[] => {
    const locale = language === 'es' ? dateFnsEs : undefined;
    const spanDays = differenceInCalendarDays(periodEnd, periodStart) + 1;

    const centsInRange = (from: Date, to: Date) => sumSaleCentsInInclusiveDayRange(sales, from, to);

    if (spanDays <= 31) {
      const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
      return days.map((day) => ({
        day: format(day, spanDays > 7 ? 'd MMM' : 'EEE', { locale }),
        fullDay: format(day, 'PPP', { locale }),
        revenue: centsInRange(day, day) / 100,
      }));
    }

    if (spanDays <= 120) {
      const out: DashboardRevenueChartPoint[] = [];
      let cursor = periodStart;
      while (cursor.getTime() <= periodEnd.getTime()) {
        const chunkEnd = minDate([addDays(cursor, 6), periodEnd]);
        out.push({
          day: format(cursor, 'd MMM', { locale }),
          fullDay: `${format(cursor, 'd MMM', { locale })} – ${format(chunkEnd, 'd MMM yyyy', { locale })}`,
          revenue: centsInRange(cursor, chunkEnd) / 100,
        });
        cursor = addDays(chunkEnd, 1);
      }
      return out;
    }

    const months: DashboardRevenueChartPoint[] = [];
    let m = startOfMonth(periodStart);
    const lastMonthStart = startOfMonth(periodEnd);
    while (m.getTime() <= lastMonthStart.getTime()) {
      const ms = startOfMonth(m);
      const me = endOfMonth(m);
      const from = maxDate([ms, periodStart]);
      const to = minDate([me, periodEnd]);
      if (from.getTime() <= to.getTime()) {
        months.push({
          day: format(ms, 'MMM', { locale }),
          fullDay: format(ms, 'MMM yyyy', { locale }),
          revenue: centsInRange(from, to) / 100,
        });
      }
      m = addMonths(m, 1);
    }
    return months;
  }, [sales, periodStart, periodEnd, language]);

  const appointmentsInPeriod = useMemo(() => {
    const start = periodStart;
    const end = periodEnd;
    return appointments.filter((a) => {
      const d = startOfDay(new Date(a.scheduled_date));
      return d >= start && d <= end;
    });
  }, [appointments, periodStart, periodEnd]);

  // Species distribution
  const speciesData = useMemo(() => {
    const counts = { dog: 0, cat: 0, other: 0 };
    pets.forEach((pet) => counts[pet.species]++);
    return [
      { name: t('pets.dogs'), value: counts.dog },
      { name: t('pets.cats'), value: counts.cat },
      { name: t('pets.other'), value: counts.other },
    ].filter((d) => d.value > 0);
  }, [pets]);

  // Employee hours in selected period (by clock-in date; same bounds as Payroll)
  const employeeHours = useMemo(() => {
    const rangeStart = periodStart;
    const rangeEnd = periodEnd;
    const roundToQuarterHours = (hours: number) => Math.round(hours * 4) / 4;
    return employees
      .filter((e) => e.status === 'active')
      .map((emp) => {
        const empEntries = timeEntries.filter((entry) => {
          const entryDate = startOfDay(new Date(entry.clock_in));
          return (
            entry.staff_id === emp.id &&
            entryDate >= rangeStart &&
            entryDate <= rangeEnd &&
            entry.clock_out &&
            timeEntryCountsTowardPayroll(entry)
          );
        });

        const totalHours = empEntries.reduce((sum, entry) => {
          if (!entry.clock_out) return sum;
          return sum + roundToQuarterHours(differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) / 60);
        }, 0);

        return {
          name: emp.name.split(' ')[0],
          hours: totalHours,
          rate: emp.hourly_rate,
          earnings: totalHours * emp.hourly_rate,
        };
      });
  }, [employees, timeEntries, periodStart, periodEnd]);

  const employeeHoursChartRows = useMemo(
    () => [...employeeHours].filter((r) => r.hours > 0).sort((a, b) => b.hours - a.hours),
    [employeeHours]
  );

  const totalHoursWorked = employeeHours.reduce((sum, e) => sum + e.hours, 0);
  const totalPayroll = employeeHours.reduce((sum, e) => sum + e.earnings, 0);

  const dashboardHref = businessSlug ? `/${businessSlug}/dashboard` : '/dashboard';
  const clientsHref = businessSlug ? `/${businessSlug}/clients` : '/clients';

  const renderPeriodMenu = (triggerClassName: string) => (
    <DropdownMenu
      open={dropdownOpen}
      onOpenChange={(open) => {
        setDropdownOpen(open);
        if (!open) setShowCustomPicker(false);
      }}
    >
      <DropdownMenuTrigger className={triggerClassName} aria-label={t('dashboard.period')}>
        <span className="font-medium truncate">
          {dashboardPeriod === 'weekly' && t('dashboard.chartWeekly')}
          {dashboardPeriod === 'monthly' && t('dashboard.chartMonthly')}
          {dashboardPeriod === 'quarterly' && t('dashboard.chartQuarterly')}
          {dashboardPeriod === 'yearly' && t('dashboard.chartYearly')}
          {dashboardPeriod === 'custom' &&
            (customRangeStart && customRangeEnd
              ? `${format(customRangeStart, 'd MMM', { locale: dateLocale })} – ${format(customRangeEnd, 'd MMM', { locale: dateLocale })}`
              : t('dashboard.chartCustom'))}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={showCustomPicker ? 'p-0 max-h-[85vh] overflow-y-auto' : ''}>
        {!showCustomPicker ? (
          <>
            <DropdownMenuItem
              onClick={() => {
                setDashboardPeriod('weekly');
                setDropdownOpen(false);
              }}
            >
              {t('dashboard.chartWeekly')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setDashboardPeriod('monthly');
                setDropdownOpen(false);
              }}
            >
              {t('dashboard.chartMonthly')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setDashboardPeriod('quarterly');
                setDropdownOpen(false);
              }}
            >
              {t('dashboard.chartQuarterly')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setDashboardPeriod('yearly');
                setDropdownOpen(false);
              }}
            >
              {t('dashboard.chartYearly')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setShowCustomPicker(true);
                setRangeSelect({ from: periodStart, to: periodEnd });
              }}
            >
              {t('dashboard.chartCustom')}
            </DropdownMenuItem>
          </>
        ) : (
          <div className="p-3 overflow-x-auto">
            <div className="grid grid-cols-2 gap-2 mb-1 min-w-[280px]">
              <p className="text-sm font-medium text-center">{t('dashboard.from')}</p>
              <p className="text-sm font-medium text-center">{t('dashboard.to')}</p>
            </div>
            <CalendarDateRange
              mode="range"
              numberOfMonths={2}
              className="min-w-[280px]"
              defaultMonth={rangeSelect.from ?? periodStart ?? new Date()}
              selected={rangeSelect}
              onSelect={(range) => setRangeSelect(range ?? {})}
              locale={dateLocale}
            />
            <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCustomPicker(false);
                  setRangeSelect({});
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (rangeSelect.from) {
                    const start = startOfDay(rangeSelect.from);
                    const end = startOfDay(rangeSelect.to ?? rangeSelect.from);
                    setCustomRangeStart(start);
                    setCustomRangeEnd(end);
                    setDashboardPeriod('custom');
                    persistCustomRange(start, end);
                    setShowCustomPicker(false);
                    setDropdownOpen(false);
                    setRangeSelect({});
                  }
                }}
                disabled={!rangeSelect.from}
              >
                {t('dashboard.apply')}
              </Button>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className={cn('space-y-6 animate-fade-in', !isWide && 'max-sm:space-y-5')}
      data-dashboard-mobile-shell
    >
      {isWide ? (
        <div className="flex justify-end min-w-0">
          {renderPeriodMenu(
            'flex items-center gap-1.5 text-sm text-foreground hover:opacity-80 bg-transparent border-0 shadow-none p-0 outline-none focus:ring-0 cursor-pointer max-w-full min-w-0',
          )}
        </div>
      ) : (
        <>
          <section className="relative -mx-4 overflow-hidden rounded-b-[1.75rem] bg-gradient-to-b from-primary via-primary to-primary/25 px-4 pb-12 pt-2 text-primary-foreground shadow-[0_12px_40px_-16px_hsl(var(--primary)_/_0.35)] dark:to-primary/40 dark:shadow-[0_14px_40px_-12px_rgb(0_0_0_/_0.55)]">
            <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className="min-w-0" aria-hidden />
              <div className="min-w-0 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/85">
                  {t('reports.mobileHeroEyebrow')}
                </p>
                <p className="mt-0.5 text-base font-bold leading-tight">{t('reports.title')}</p>
              </div>
              <div className="flex min-w-0 justify-end">
                {renderPeriodMenu(
                  'flex min-w-0 max-w-[10rem] items-center gap-1 rounded-full border-0 bg-primary-foreground/20 px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-none outline-none backdrop-blur-sm hover:bg-primary-foreground/30 focus:ring-0 cursor-pointer [&_svg]:text-primary-foreground',
                )}
              </div>
            </div>
            <p className="text-center text-xs font-medium text-primary-foreground/90">{t('reports.totalRevenueLast30Days')}</p>
            <p className="mt-1 text-center text-[1.65rem] font-bold tabular-nums leading-tight">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-2 text-center text-xs text-primary-foreground/85 tabular-nums">
              {format(periodStart, 'd MMM', { locale: dateLocale })} –{' '}
              {format(periodEnd, 'd MMM yyyy', { locale: dateLocale })}
            </p>
          </section>
          <div className="relative z-[2] -mt-10 grid grid-cols-2 gap-3 px-0.5">
            <Link
              to={dashboardHref}
              className="card-glass block rounded-2xl p-4 text-center shadow-lg ring-1 ring-black/5 transition active:scale-[0.99] dark:ring-white/10"
            >
              <LayoutDashboard className="mx-auto h-5 w-5 text-primary" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-foreground">{t('reports.mobileNavDashboard')}</p>
            </Link>
            <Link
              to={clientsHref}
              className="card-glass block rounded-2xl p-4 text-center shadow-lg ring-1 ring-black/5 transition active:scale-[0.99] dark:ring-white/10"
            >
              <Users className="mx-auto h-5 w-5 text-primary" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-foreground">{t('dashboard.mobileNavClients')}</p>
            </Link>
          </div>
        </>
      )}

      {/* Summary Stats */}
      <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', !isWide && '-mt-1')}>
        <Card className={cn(!isWide && 'card-glass border-0')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t('reports.totalRevenueLast30Days')}</p>
                <p className="text-2xl font-bold">
                  ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {format(periodStart, 'd MMM', { locale: dateLocale })} –{' '}
                  {format(periodEnd, 'd MMM yyyy', { locale: dateLocale })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('reports.revenueFromTransactions')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(!isWide && 'card-glass border-0')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t('reports.hoursWorked')}</p>
                <p className="text-2xl font-bold">{totalHoursWorked}h</p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {format(periodStart, 'd MMM', { locale: dateLocale })} –{' '}
                  {format(periodEnd, 'd MMM yyyy', { locale: dateLocale })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(!isWide && 'card-glass border-0')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t('reports.payrollWeek')}</p>
                <p className="text-2xl font-bold">${totalPayroll.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {format(periodStart, 'd MMM', { locale: dateLocale })} –{' '}
                  {format(periodEnd, 'd MMM yyyy', { locale: dateLocale })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(!isWide && 'card-glass border-0')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t('dashboard.appointments')}</p>
                <p className="text-2xl font-bold">{appointmentsInPeriod.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {format(periodStart, 'd MMM', { locale: dateLocale })} –{' '}
                  {format(periodEnd, 'd MMM yyyy', { locale: dateLocale })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart - from transactions */}
        <Card className={cn(!isWide && 'card-glass dashboard-mobile-chart-card border-0 shadow-lg')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t('reports.revenueTrend')}
            </CardTitle>
            <CardDescription className="tabular-nums">
              {format(periodStart, 'd MMM', { locale: dateLocale })} –{' '}
              {format(periodEnd, 'd MMM yyyy', { locale: dateLocale })}
              {' · '}
              {t('reports.revenueDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardRevenueChart
              data={periodRevenueChartData}
              chartEnterKey={chartEnterKey}
              chartHeight={250}
              emptyLabel={t('dashboard.noData')}
              tooltipSeriesName={t('reports.revenue')}
              tooltipFormatter={(value) => [
                `$${Math.round(Number(value)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                t('reports.revenue'),
              ]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDay ?? ''}
            />
          </CardContent>
        </Card>

        {/* Pet Distribution */}
        <Card className={cn(!isWide && 'card-glass dashboard-mobile-chart-card border-0 shadow-lg')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dog className="w-5 h-5 text-primary" />
              {t('reports.speciesDistribution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {speciesData.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="h-[200px] w-full min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <Pie
                        data={speciesData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={5}
                        stroke="none"
                        label={false}
                        labelLine={false}
                      >
                        {speciesData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value}`, name]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-1 text-sm">
                  {speciesData.map((row, index) => (
                    <li key={row.name} className="flex max-w-[min(100%,14rem)] items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        aria-hidden
                      />
                      <span className="truncate text-foreground">{row.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{row.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-16">{t('reports.noPetData')}</p>
            )}
          </CardContent>
        </Card>

        {/* Employee Hours */}
        <Card className={cn(!isWide && 'card-glass dashboard-mobile-chart-card border-0 shadow-lg')}>
          <CardHeader>
            <CardTitle>{t('reports.employeeHours')}</CardTitle>
            <CardDescription className="tabular-nums">
              {format(periodStart, 'd MMM', { locale: dateLocale })} –{' '}
              {format(periodEnd, 'd MMM yyyy', { locale: dateLocale })}
              {' · '}
              {t('reports.hoursWorkedByStaff')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {employeeHoursChartRows.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={employeeHoursChartRows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'hours') return [`${value}h`, t('reports.hours')];
                      return [value, name];
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="hours" fill="hsl(145, 50%, 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : employees.some((e) => e.status === 'active') ? (
              <p className="text-center text-muted-foreground py-16">{t('reports.noHoursInPeriod')}</p>
            ) : (
              <p className="text-center text-muted-foreground py-16">{t('reports.noEmployeeData')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
