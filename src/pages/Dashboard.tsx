import { useNavigate, useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { Dog, Calendar, TrendingUp, Clock, ChevronDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LabelList } from 'recharts';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar as CalendarDateRange } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Client, Pet, Employee, Appointment } from '@/types';
import { format, startOfDay, startOfMonth, endOfMonth, subMonths, subDays, isWithinInterval, differenceInDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { es as dateFnsEs } from 'date-fns/locale';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { DataDiagnostics } from '@/components/DataDiagnostics';
import { useTransactions } from '@/hooks/useTransactions';
import { useMemo } from 'react';

interface DashboardProps {
  clients: Client[];
  pets: Pet[];
  employees: Employee[];
  appointments: Appointment[];
  onSelectClient?: (clientId: string) => void;
}

const SALE_STATUSES = ['paid', 'partial'] as const;

const REVENUE_PERIOD_DAYS = 30;

function useTransactionStats(transactions: { status: string; total: number; created_at: string }[]) {
  return useMemo(() => {
    const sales = transactions.filter((t) => SALE_STATUSES.includes(t.status as any));
    const now = new Date();
    const todayStart = startOfDay(now);
    const periodStart = subDays(now, REVENUE_PERIOD_DAYS);
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const revenueLast30DaysCents = sales.reduce((sum, t) => {
      const d = new Date(t.created_at);
      return d >= periodStart ? sum + t.total : sum;
    }, 0);
    const todayRevenueCents = sales.reduce((sum, t) => {
      const d = new Date(t.created_at);
      return startOfDay(d).getTime() === todayStart.getTime() ? sum + t.total : sum;
    }, 0);
    const thisMonthCents = sales.reduce((sum, t) => {
      const d = new Date(t.created_at);
      return isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd }) ? sum + t.total : sum;
    }, 0);
    const lastMonthCents = sales.reduce((sum, t) => {
      const d = new Date(t.created_at);
      return isWithinInterval(d, { start: lastMonthStart, end: lastMonthEnd }) ? sum + t.total : sum;
    }, 0);

    const growthPct =
      lastMonthCents > 0
        ? Math.round(((thisMonthCents - lastMonthCents) / lastMonthCents) * 100)
        : null;

    return {
      revenueLast30Days: revenueLast30DaysCents / 100,
      todayRevenue: todayRevenueCents / 100,
      growthPct,
      transactionCount: sales.length,
      todayTransactionCount: sales.filter((t) => startOfDay(new Date(t.created_at)).getTime() === todayStart.getTime()).length,
    };
  }, [transactions]);
}

const TODAY_APPOINTMENTS_DISPLAY_MAX = 5;

export function Dashboard({ clients, pets, employees, appointments, onSelectClient }: DashboardProps) {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const { transactions } = useTransactions();
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? dateFnsEs : undefined;
  const { revenueLast30Days, todayRevenue, growthPct, todayTransactionCount } = useTransactionStats(transactions);

  const recentPets = pets.slice(0, 5);
  const dogCount = pets.filter(p => p.species === 'dog').length;
  const catCount = pets.filter(p => p.species === 'cat').length;

  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const todayAppointments = appointments.filter(a => {
    const today = new Date().toDateString();
    return new Date(a.scheduled_date).toDateString() === today;
  }).length;

  const todaysAppointmentsList = appointments.filter(a => {
    const today = new Date().toDateString();
    return new Date(a.scheduled_date).toDateString() === today;
  }).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  // Revenue and growth are always from transactions (no hardcoded values)
  const revenueDisplay = (() => {
    const n = Number(revenueLast30Days);
    return Number.isFinite(n) ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
  })();
  const revenueDescription =
    todayTransactionCount > 0
      ? t('dashboard.revenueFromTransactions') + ` • ${t('dashboard.todaySales')}: $${todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : t('dashboard.revenueFromTransactions');
  const growthDisplay = (() => {
    if (growthPct === null || !Number.isFinite(growthPct)) return '—';
    return growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`;
  })();

  type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  const [dashboardPeriod, setDashboardPeriod] = useState<PeriodType>('monthly');
  const [customRangeStart, setCustomRangeStart] = useState<Date | null>(null);
  const [customRangeEnd, setCustomRangeEnd] = useState<Date | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [rangeSelect, setRangeSelect] = useState<{ from?: Date; to?: Date }>({});

  const today = useMemo(() => startOfDay(new Date()), []);
  const periodDaysMap = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 } as const;
  const periodDays = dashboardPeriod === 'custom'
    ? (customRangeStart && customRangeEnd ? differenceInDays(customRangeEnd, customRangeStart) + 1 : 30)
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

  const revenueData = useMemo(() => {
    const sales = transactions.filter((t) => SALE_STATUSES.includes(t.status as any));
    const locale = language === 'es' ? dateFnsEs : undefined;
    const start = periodStart;
    const end = periodEnd;

    if (dashboardPeriod === 'yearly') {
      const months: { month: Date; label: string; revenue: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(end, i);
        const monthStart = startOfMonth(d);
        const monthEnd = endOfMonth(d);
        const revenueCents = sales
          .filter((t) => {
            const tDate = new Date(t.created_at).getTime();
            return tDate >= monthStart.getTime() && tDate <= monthEnd.getTime();
          })
          .reduce((sum, t) => sum + t.total, 0);
        months.push({
          month: d,
          label: format(d, 'MMM', { locale }),
          revenue: revenueCents / 100,
        });
      }
      return months.map(({ label, revenue }) => ({ day: label, fullDay: label, revenue }));
    }

    if (dashboardPeriod === 'quarterly') {
      const weeks: { weekStart: Date; label: string; revenue: number }[] = [];
      let w = startOfWeek(start, { weekStartsOn: 1 });
      while (w <= end) {
        const weekEnd = endOfWeek(w, { weekStartsOn: 1 });
        const revenueCents = sales
          .filter((t) => {
            const tDate = new Date(t.created_at).getTime();
            return tDate >= w.getTime() && tDate <= Math.min(weekEnd.getTime(), end.getTime() + 86400000);
          })
          .reduce((sum, t) => sum + t.total, 0);
        weeks.push({
          weekStart: w,
          label: format(w, 'd MMM', { locale }),
          revenue: revenueCents / 100,
        });
        w = addDays(weekEnd, 1);
      }
      return weeks.map(({ label, revenue }) => ({ day: label, fullDay: label, revenue }));
    }

    const totalDays = differenceInDays(end, start) + 1;
    if (dashboardPeriod === 'custom' && totalDays > 180) {
      const months: { month: Date; label: string; revenue: number }[] = [];
      let m = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      while (m <= endMonth) {
        const monthStart = startOfMonth(m);
        const monthEnd = endOfMonth(m);
        const revenueCents = sales
          .filter((t) => {
            const tDate = new Date(t.created_at).getTime();
            return tDate >= monthStart.getTime() && tDate <= monthEnd.getTime();
          })
          .reduce((sum, t) => sum + t.total, 0);
        months.push({ month: m, label: format(m, 'MMM yyyy', { locale }), revenue: revenueCents / 100 });
        m = addDays(monthEnd, 1);
      }
      return months.map(({ label, revenue }) => ({ day: label, fullDay: label, revenue }));
    }
    if (dashboardPeriod === 'custom' && totalDays > 60) {
      const weeks: { weekStart: Date; label: string; revenue: number }[] = [];
      let w = startOfWeek(start, { weekStartsOn: 1 });
      while (w <= end) {
        const weekEnd = endOfWeek(w, { weekStartsOn: 1 });
        const revenueCents = sales
          .filter((t) => {
            const tDate = new Date(t.created_at).getTime();
            return tDate >= w.getTime() && tDate <= Math.min(weekEnd.getTime(), end.getTime() + 86400000);
          })
          .reduce((sum, t) => sum + t.total, 0);
        weeks.push({
          weekStart: w,
          label: format(w, 'd MMM', { locale }),
          revenue: revenueCents / 100,
        });
        w = addDays(weekEnd, 1);
      }
      return weeks.map(({ label, revenue }) => ({ day: label, fullDay: label, revenue }));
    }

    const dayList = eachDayOfInterval({ start, end });
    return dayList.map((day) => {
      const dayStart = startOfDay(day);
      const dayRevenueCents = sales
        .filter((t) => startOfDay(new Date(t.created_at)).getTime() === dayStart.getTime())
        .reduce((sum, t) => sum + t.total, 0);
      return {
        day: format(day, dashboardPeriod === 'weekly' ? 'EEE d' : 'MMM d', { locale }),
        fullDay: format(day, 'MMM d', { locale }),
        revenue: dayRevenueCents / 100,
      };
    });
  }, [transactions, dashboardPeriod, periodStart, periodEnd, language]);

  const appointmentsInPeriod = useMemo(() => {
    const start = periodStart;
    const end = periodEnd;
    return appointments.filter((a) => {
      const d = startOfDay(new Date(a.scheduled_date));
      return d >= start && d <= end;
    });
  }, [appointments, periodStart, periodEnd]);

  const newVsRepeatData = useMemo(() => {
    const startTs = periodStart.getTime();
    const endTs = periodEnd.getTime() + 86400000;
    const inPeriod = appointments.filter((a) => {
      const t = new Date(a.scheduled_date).getTime();
      return t >= startTs && t < endTs;
    });
    // Each client's first-ever appointment (across all appointment history)
    const clientFirstAppointmentTs = new Map<string, number>();
    for (const a of appointments) {
      const pet = pets.find((p) => p.id === a.pet_id);
      if (!pet) continue;
      const clientId = pet.client_id;
      const ts = new Date(a.scheduled_date).getTime();
      const existing = clientFirstAppointmentTs.get(clientId);
      if (existing === undefined || ts < existing) clientFirstAppointmentTs.set(clientId, ts);
    }
    let newCount = 0;
    let repeatCount = 0;
    for (const a of inPeriod) {
      const pet = pets.find((p) => p.id === a.pet_id);
      if (!pet) continue;
      const clientId = pet.client_id;
      const thisTs = new Date(a.scheduled_date).getTime();
      const firstTs = clientFirstAppointmentTs.get(clientId);
      if (firstTs === undefined) continue;
      if (thisTs === firstTs) newCount++;
      else repeatCount++;
    }
    return [
      { name: t('dashboard.newClients'), value: newCount, color: 'hsl(var(--primary))' },
      { name: t('dashboard.repeatClients'), value: repeatCount, color: 'hsl(var(--muted-foreground) / 0.6)' },
    ];
  }, [appointments, pets, periodStart, periodEnd]);

  const servicesCompletedCount = useMemo(
    () => appointmentsInPeriod.filter((a) => a.status === 'completed').length,
    [appointmentsInPeriod]
  );

  const topServicesData = useMemo(() => {
    const completed = appointmentsInPeriod.filter((a) => a.status === 'completed');
    const byService = new Map<string, number>();
    for (const a of completed) {
      const name = (a.service_type?.trim() || '—');
      byService.set(name, (byService.get(name) || 0) + 1);
    }
    return Array.from(byService.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [appointmentsInPeriod]);

  const handleClientClick = (clientId: string) => {
    if (onSelectClient) {
      onSelectClient(clientId);
    }
    const target = businessSlug ? `/${businessSlug}/clients` : '/clients';
    // Use replace: false to preserve navigation history and auth state
    navigate(target, { 
      state: { selectedClientId: clientId },
      replace: false
    });
  };

  const handlePetClick = (petId: string) => {
    const target = businessSlug ? `/${businessSlug}/pets?highlight=${petId}` : `/pets?highlight=${petId}`;
    // Use replace: false to preserve navigation history and auth state
    navigate(target, { replace: false });
  };

  return (
    <div className="space-y-8 animate-fade-in" data-transition-root>
      {/* Period selector above the card grid */}
      <div className="flex justify-end min-w-0">
        <DropdownMenu open={dropdownOpen} onOpenChange={(open) => { setDropdownOpen(open); if (!open) setShowCustomPicker(false); }}>
          <DropdownMenuTrigger
            className="flex items-center gap-1.5 text-sm text-foreground hover:opacity-80 bg-transparent border-0 shadow-none p-0 outline-none focus:ring-0 cursor-pointer max-w-full min-w-0"
            aria-label={t('dashboard.period')}
          >
            <span className="font-medium truncate">
              {dashboardPeriod === 'weekly' && t('dashboard.chartWeekly')}
              {dashboardPeriod === 'monthly' && t('dashboard.chartMonthly')}
              {dashboardPeriod === 'quarterly' && t('dashboard.chartQuarterly')}
              {dashboardPeriod === 'yearly' && t('dashboard.chartYearly')}
              {dashboardPeriod === 'custom' && (customRangeStart && customRangeEnd
                ? `${format(customRangeStart, 'd MMM', { locale: dateLocale })} – ${format(customRangeEnd, 'd MMM', { locale: dateLocale })}`
                : t('dashboard.chartCustom'))}
            </span>
            <ChevronDown className="w-4 h-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={showCustomPicker ? 'p-0 max-h-[85vh] overflow-y-auto' : ''}>
            {!showCustomPicker ? (
              <>
                <DropdownMenuItem onClick={() => { setDashboardPeriod('weekly'); setDropdownOpen(false); }}>
                  {t('dashboard.chartWeekly')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDashboardPeriod('monthly'); setDropdownOpen(false); }}>
                  {t('dashboard.chartMonthly')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDashboardPeriod('quarterly'); setDropdownOpen(false); }}>
                  {t('dashboard.chartQuarterly')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDashboardPeriod('yearly'); setDropdownOpen(false); }}>
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
                    onClick={() => { setShowCustomPicker(false); setRangeSelect({}); }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (rangeSelect.from) {
                        setCustomRangeStart(startOfDay(rangeSelect.from));
                        setCustomRangeEnd(rangeSelect.to ? startOfDay(rangeSelect.to) : startOfDay(rangeSelect.from));
                        setDashboardPeriod('custom');
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
      </div>

      {/* Stats row: cards left→right top→bottom */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" data-transition-containers>
          {/* Card 1: New vs Repeat clients (pie) */}
          <div
            onClick={() => navigate(businessSlug ? `/${businessSlug}/clients` : '/clients')}
            className="cursor-pointer h-full"
          >
            <Card className="card-glass shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col overflow-hidden">
              <CardContent className="p-4 flex-1 flex flex-col min-h-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.clientType')}</p>
                <div className="flex-1 min-h-[100px] flex items-center justify-center mt-1">
                  {newVsRepeatData.every((d) => d.value === 0) ? (
                    <p className="text-xs text-muted-foreground">{t('dashboard.noData')}</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={110} className="text-[10px]">
                      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                        <Pie
                          data={newVsRepeatData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="45%"
                          innerRadius={26}
                          outerRadius={36}
                          paddingAngle={0}
                          stroke="none"
                          isAnimationActive
                          animationDuration={400}
                          animationEasing="ease-out"
                          label={({ name, percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                            if (percent <= 0) return null;
                            const RADIAN = Math.PI / 180;
                            const lineLength = 5;
                            const gapFromLine = 18;
                            const r = outerRadius + lineLength + gapFromLine;
                            const x = cx + r * Math.cos(-midAngle * RADIAN);
                            const y = cy + r * Math.sin(-midAngle * RADIAN);
                            const anchor = x >= cx ? 'start' : 'end';
                            return (
                              <g transform={`translate(${x},${y})`} textAnchor={anchor}>
                                <text fill="hsl(var(--foreground))" fontSize={11} fontWeight={500} x={0} y={0} dy={-4}>{name}</text>
                                <text fill="hsl(var(--muted-foreground))" fontSize={12} fontWeight={600} x={0} y={0} dy={10}>{(percent * 100).toFixed(0)}%</text>
                              </g>
                            );
                          }}
                          labelLine={(props: { points?: [ { x: number; y: number }, { x: number; y: number } ]; stroke?: string }) => {
                            const points = props.points;
                            if (!points || points.length < 2 || !points[0] || !points[1]) return null;
                            const [p0, p1] = points;
                            const frac = 5 / (Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1);
                            const t = Math.min(frac, 0.35);
                            const x = p0.x + (p1.x - p0.x) * t;
                            const y = p0.y + (p1.y - p0.y) * t;
                            return <path d={`M${p0.x},${p0.y} L${x},${y}`} stroke={props.stroke ?? 'hsl(var(--muted-foreground) / 0.4)'} strokeWidth={1} fill="none" />;
                          }}
                        >
                          {newVsRepeatData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            const isNew = name === t('dashboard.newClients');
                            const key = isNew ? 'dashboard.tooltipNewCount' : 'dashboard.tooltipRepeatCount';
                            return [`${value} ${t(key)}`, ''];
                          }}
                          contentStyle={{ borderRadius: '6px', border: '1px solid hsl(var(--border))', padding: '6px 10px', fontSize: '12px', background: 'hsl(var(--card))' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 2: Services completed */}
          <div
            className="cursor-pointer h-full"
            onClick={() => navigate(businessSlug ? `/${businessSlug}/appointments` : '/appointments')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(businessSlug ? `/${businessSlug}/appointments` : '/appointments')}
          >
            <StatCard
              title={t('dashboard.servicesCompleted')}
              value={servicesCompletedCount}
              icon={Calendar}
              animate
            />
          </div>

          {/* Card 3: Active staff */}
          <div
            onClick={() => navigate(businessSlug ? `/${businessSlug}/employee-management` : '/employee-management')}
            className="cursor-pointer h-full"
          >
            <StatCard
              title={t('dashboard.activeStaff')}
              value={activeEmployees}
              icon={Clock}
              description={t('dashboard.teamMembers')}
              animate
            />
          </div>

          {/* Card 4: Today appointments */}
          <div
            className="cursor-pointer h-full"
            onClick={() => navigate(businessSlug ? `/${businessSlug}/appointments` : '/appointments')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(businessSlug ? `/${businessSlug}/appointments` : '/appointments')}
          >
            <StatCard
              title={t('dashboard.today')}
              value={todayAppointments}
              icon={Calendar}
              description={t('dashboard.appointments')}
              animate
            />
          </div>

          {/* Card 5: Top selling services (bar chart) */}
          <div
            onClick={() => navigate(businessSlug ? `/${businessSlug}/reports/analytics` : '/reports/analytics')}
            className="cursor-pointer h-full"
          >
            <Card className="card-glass shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col overflow-hidden">
              <CardContent className="p-4 flex-1 flex flex-col min-h-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.topSellingServices')}</p>
                <div className="flex-1 min-h-[80px] mt-1">
                  {topServicesData.length === 0 ? (
                    <p className="text-xs text-muted-foreground flex items-center justify-center h-full">{t('dashboard.noData')}</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart data={topServicesData} layout="vertical" margin={{ top: 2, right: 8, bottom: 2, left: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" orientation="right" width={95} tick={false} tickLine={false} axisLine={false} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={12}>
                          <LabelList dataKey="name" position="right" offset={8} style={{ fontSize: 10, fontWeight: 500, fill: 'hsl(var(--foreground))' }} />
                        </Bar>
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const item = payload[0];
                            const serviceName = (item?.payload as { name?: string })?.name ?? (item?.name as string) ?? '';
                            const value = typeof item?.value === 'number' ? item.value : 0;
                            return (
                              <div
                                className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md"
                                style={{ borderColor: 'hsl(var(--border))' }}
                              >
                                <p className="font-medium text-foreground">{serviceName || '—'}</p>
                                <p className="text-muted-foreground">{value} {t('dashboard.appointmentsCount')}</p>
                              </div>
                            );
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 6: Growth */}
          <div className="h-full">
            <StatCard
              title={t('dashboard.growth')}
              value={growthDisplay}
              icon={TrendingUp}
              description={t('dashboard.vsLastMonth')}
            />
          </div>
        </div>
      </div>

      {/* Left: Today's Appointments — Right: Revenue + Recent Pets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-transition-row="2" data-transition-containers>
        {/* Appointments: long list on the left */}
        <Card
          className="shadow-sm hover:shadow-md transition-shadow lg:col-span-1 flex flex-col max-h-[420px]"
          role="article"
        >
          <CardHeader className="shrink-0 flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2" data-card-title>
              <Calendar className="w-5 h-5 text-primary" />
              {t('dashboard.todayAppointments')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            {todaysAppointmentsList.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">{t('dashboard.noAppointmentsToday')}</p>
            ) : (
              <>
                <div className="space-y-2" data-list style={{ ['--list-start' as string]: '0.52s' }}>
                  {todaysAppointmentsList.slice(0, TODAY_APPOINTMENTS_DISPLAY_MAX).map((appointment) => {
                    const pet = pets.find(p => p.id === appointment.pet_id);
                    const client = pet ? clients.find(c => c.id === pet.client_id) : null;
                    const employee = appointment.employee_id ? employees.find(e => e.id === appointment.employee_id) : null;
                    return (
                      <div
                        key={appointment.id}
                        data-list-item
                        className="flex items-center justify-between p-2.5 bg-secondary/50 rounded-lg text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{pet?.name || t('appointments.unknownPet')}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {format(new Date(appointment.scheduled_date), 'h:mm a', { locale: dateLocale })} • {client ? `${client.first_name} ${client.last_name}`.trim() : '—'}
                            {employee && ` • ${employee.name}`}
                          </p>
                        </div>
                        <Badge variant={appointment.status === 'completed' ? 'default' : appointment.status === 'cancelled' ? 'destructive' : 'secondary'} className="shrink-0 ml-2 text-[10px]">
                          {appointment.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-2 border-t border-border">
                  <Link
                    to={businessSlug ? `/${businessSlug}/appointments` : '/appointments'}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t('dashboard.viewAll')}
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Revenue graph (links to reports) + Recent Pets */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(businessSlug ? `/${businessSlug}/reports/analytics` : '/reports/analytics')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(businessSlug ? `/${businessSlug}/reports/analytics` : '/reports/analytics')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base" data-card-title>
                {t('dashboard.revenue')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueData} margin={{ top: 12, right: 28, bottom: 24, left: 12 }}>
                  <defs>
                    <linearGradient id="dashboardRevenueStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="dashboardRevenueFill" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    interval={dashboardPeriod === 'weekly' ? 2 : 6}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDay ?? ''}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="url(#dashboardRevenueStroke)"
                    strokeWidth={2}
                    fill="url(#dashboardRevenueFill)"
                    dot={{ r: 2, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                    isAnimationActive
                    animationDuration={700}
                    animationBegin={0}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base" data-card-title>
                <Dog className="w-5 h-5 text-primary" />
                {t('dashboard.recentPets')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentPets.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">{t('dashboard.noPetsYet')}</p>
              ) : (
                <div className="space-y-2" data-list style={{ ['--list-start' as string]: '0.94s' }}>
                  {recentPets.map((pet) => {
                    const owner = clients.find((c) => c.id === pet.client_id);
                    const target = businessSlug ? `/${businessSlug}/pets?highlight=${pet.id}` : `/pets?highlight=${pet.id}`;
                    return (
                      <Link
                        key={pet.id}
                        to={target}
                        data-list-item
                        className="flex items-center justify-between p-2.5 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors block text-sm"
                      >
                        <div>
                          <p className="font-medium">{pet.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {pet.breed} • {owner ? `${owner.first_name} ${owner.last_name}`.trim() : t('dashboard.unknownOwner')}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 text-xs bg-accent rounded capitalize">{pet.species}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Collapsible Data Diagnostics at bottom */}
      <details className="mt-8 border border-border rounded-lg bg-card/50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium flex items-center justify-between">
          <span>Show Diagnostics</span>
          <span className="text-xs text-muted-foreground">(for troubleshooting only)</span>
        </summary>
        <div className="pt-2">
          <DataDiagnostics />
        </div>
      </details>
    </div>
  );
}
