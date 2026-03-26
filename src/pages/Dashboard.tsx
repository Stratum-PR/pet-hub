import { useNavigate, useParams, Link } from 'react-router-dom';
import { useState, useRef, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Package, Calendar, TrendingUp, Clock, ChevronDown, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
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
import {
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
  differenceInDays,
  differenceInCalendarDays,
  addDays,
  addMonths,
  eachDayOfInterval,
  min as minDate,
  max as maxDate,
} from 'date-fns';
import { es as dateFnsEs } from 'date-fns/locale';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { DataDiagnostics } from '@/components/DataDiagnostics';
import { useTransactions, loadDemoTransactionEntries } from '@/hooks/useTransactions';
import { useBusinessId } from '@/hooks/useBusinessId';
import { supabase } from '@/integrations/supabase/client';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { cn } from '@/lib/utils';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { dashboardStaggerDelayMs } from '@/lib/dashboardEnterAnimation';
import { DashboardRevenueChart, type DashboardRevenueChartPoint } from '@/components/DashboardRevenueChart';
import type { Product } from '@/types/inventory';

interface DashboardProps {
  clients: Client[];
  pets: Pet[];
  employees: Employee[];
  appointments: Appointment[];
  products?: Product[];
  /** Matches Inventory / business settings default reorder hint */
  defaultLowStockThreshold?: number;
  onSelectClient?: (clientId: string) => void;
  /** True while clients / pets / employees / appointments hooks are still fetching */
  dataLoading?: boolean;
}

function DashboardStaggerItem({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-dashboard-stagger-item
      className={cn(
        'animate-dashboard-box-enter will-change-[transform,opacity] opacity-0 [animation-fill-mode:forwards]',
        'motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:will-change-auto',
        className
      )}
      style={{ animationDelay: `${dashboardStaggerDelayMs(index)}ms` }}
    >
      {children}
    </div>
  );
}

const SALE_STATUSES = ['paid', 'partial'] as const;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isGenericServiceLineLabel(name: string): boolean {
  const t = name.trim();
  const s = t.toLowerCase();
  if (s === '' || s === 'service') return true;
  // Legacy POS fallback label from TransactionCreate — treat like generic so appointment/catalog names apply.
  if (/^appointment\s+[0-9a-f]{8}$/i.test(t)) return true;
  return false;
}

/**
 * Map generic POS line names ("Service") to appointment service_type or catalog service name (service_id).
 */
function bucketNameForServiceLine(
  lineName: string | null | undefined,
  appointmentId: string | null | undefined,
  appointmentServiceLabelById: Map<string, string>,
  uncategorizedLabel: string
): string {
  const raw = String(lineName ?? '').trim();
  const aid =
    appointmentId != null && String(appointmentId).length > 0 ? String(appointmentId) : '';
  const fromAppt = aid ? (appointmentServiceLabelById.get(aid) ?? '').trim() : '';
  if (isGenericServiceLineLabel(raw)) {
    if (fromAppt) return fromAppt;
    return uncategorizedLabel;
  }
  return raw;
}

/** Horizontal bar: animates width 0 → fillPercent (of row track); longest earner = 100%. */
function TopServiceRevenueBar({
  fillPercent,
  delayMs,
  backgroundColor,
  trackClassName = 'h-2.5',
}: {
  fillPercent: number;
  delayMs: number;
  backgroundColor: string;
  /** Track height (taller bars in expanded top-services card). */
  trackClassName?: string;
}) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    setWidth(0);
  }, [fillPercent, delayMs]);
  useEffect(() => {
    const t = window.setTimeout(() => setWidth(fillPercent), delayMs);
    return () => clearTimeout(t);
  }, [fillPercent, delayMs]);
  return (
    <div className={cn('flex-1 min-w-0 flex items-center', trackClassName)}>
      <div
        className="h-full min-w-0 rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
        style={{
          width: `${width}%`,
          maxWidth: '100%',
          backgroundColor,
        }}
      />
    </div>
  );
}

function sumSaleCentsInInclusiveDayRange(
  sales: { created_at: string; total: number }[],
  rangeStart: Date,
  rangeEnd: Date
): number {
  const startTs = startOfDay(rangeStart).getTime();
  const endExclusive = addDays(startOfDay(rangeEnd), 1).getTime();
  let sum = 0;
  for (const t of sales) {
    const ct = new Date(t.created_at).getTime();
    if (ct >= startTs && ct < endExclusive) sum += t.total;
  }
  return sum;
}

const TODAY_APPOINTMENTS_DISPLAY_MAX = 5;

/** Placeholder row matching appointment slot height when list is short or empty */
function AppointmentSlotPlaceholder() {
  return (
    <div
      className="flex items-center justify-between p-2.5 rounded-lg border border-dashed border-border/50 bg-muted/15"
      aria-hidden
    >
      <div className="flex-1 space-y-1.5 min-w-0 pr-2">
        <div className="h-3.5 w-[45%] max-w-[7rem] rounded-md bg-muted/45" />
        <div className="h-3 w-[72%] max-w-[11rem] rounded-md bg-muted/30" />
      </div>
      <div className="h-5 w-12 rounded-md bg-muted/35 shrink-0" />
    </div>
  );
}

function reorderThresholdForProduct(p: Product, defaultLow: number): number {
  if (p.reorder_level != null && p.reorder_level >= 0) return p.reorder_level;
  return defaultLow;
}

export function Dashboard({
  clients,
  pets,
  employees,
  appointments,
  products = [],
  defaultLowStockThreshold = 5,
  onSelectClient,
  dataLoading = false,
}: DashboardProps) {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const businessId = useBusinessId();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? dateFnsEs : undefined;
  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => p.quantity <= reorderThresholdForProduct(p, defaultLowStockThreshold))
      .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name))
      .slice(0, 16);
  }, [products, defaultLowStockThreshold]);

  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const todayAppointments = appointments.filter(a => {
    const today = new Date().toDateString();
    return new Date(a.scheduled_date).toDateString() === today;
  }).length;

  const todaysAppointmentsList = appointments.filter(a => {
    const today = new Date().toDateString();
    return new Date(a.scheduled_date).toDateString() === today;
  }).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  const DASHBOARD_PERIOD_KEY = 'pet-hub-dashboard-period';
  const DASHBOARD_CUSTOM_RANGE_KEY = 'pet-hub-dashboard-custom-range';

  const loadSavedPeriod = (): PeriodType => {
    if (typeof window === 'undefined') return 'monthly';
    try {
      const saved = localStorage.getItem(DASHBOARD_PERIOD_KEY);
      if (saved === 'weekly' || saved === 'monthly' || saved === 'quarterly' || saved === 'yearly' || saved === 'custom') return saved;
    } catch (_) { /* ignore */ }
    return 'monthly';
  };

  const loadSavedCustomRange = (): { start: Date; end: Date } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(DASHBOARD_CUSTOM_RANGE_KEY);
      if (!raw) return null;
      const { start, end } = JSON.parse(raw);
      if (start && end) return { start: new Date(start), end: new Date(end) };
    } catch (_) { /* ignore */ }
    return null;
  };

  const [dashboardPeriod, setDashboardPeriodState] = useState<PeriodType>('monthly');
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

  const setDashboardPeriod = (period: PeriodType) => {
    setDashboardPeriodState(period);
    try {
      localStorage.setItem(DASHBOARD_PERIOD_KEY, period);
    } catch (_) { /* ignore */ }
  };

  const persistCustomRange = (start: Date, end: Date) => {
    try {
      localStorage.setItem(DASHBOARD_CUSTOM_RANGE_KEY, JSON.stringify({ start: start.toISOString(), end: end.toISOString() }));
    } catch (_) { /* ignore */ }
  };
  const pieContainerRef = useRef<HTMLDivElement>(null);
  const [pieSize, setPieSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = pieContainerRef.current;
    if (!el) return;
    const apply = (width: number, height: number) => {
      setPieSize((prev) =>
        width > 0 || height > 0 ? { w: width, h: height } : prev
      );
    };
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      apply(width, height);
    });
    ro.observe(el);
    const raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      apply(r.width, r.height);
    });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

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

  const { growthPct, periodRevenueDollars } = useMemo(() => {
    const sales = transactions.filter((t) => SALE_STATUSES.includes(t.status as any));
    const len = differenceInCalendarDays(periodEnd, periodStart) + 1;
    const prevEnd = subDays(periodStart, 1);
    const prevStart = subDays(prevEnd, len - 1);
    const currentCents = sumSaleCentsInInclusiveDayRange(sales, periodStart, periodEnd);
    const prevCents = sumSaleCentsInInclusiveDayRange(sales, prevStart, prevEnd);
    const growthPct =
      prevCents > 0 ? Math.round(((currentCents - prevCents) / prevCents) * 100) : null;
    return {
      growthPct,
      periodRevenueDollars: currentCents / 100,
    };
  }, [transactions, periodStart, periodEnd]);

  const growthPeriodLabel = useMemo(() => {
    switch (dashboardPeriod) {
      case 'weekly':
        return t('dashboard.vsPreviousWeek');
      case 'monthly':
        return t('dashboard.vsPrevious30Days');
      case 'quarterly':
        return t('dashboard.vsPrevious90Days');
      case 'yearly':
        return t('dashboard.vsPreviousYear');
      default:
        return t('dashboard.vsPreviousPeriod');
    }
  }, [dashboardPeriod, language]);

  /** Paid/partial totals per bucket; window matches dashboard period filter. */
  const periodRevenueChartData = useMemo((): DashboardRevenueChartPoint[] => {
    const sales = transactions.filter((t) => SALE_STATUSES.includes(t.status as any));
    const locale = language === 'es' ? dateFnsEs : undefined;
    const spanDays = differenceInCalendarDays(periodEnd, periodStart) + 1;

    const centsInRange = (from: Date, to: Date) =>
      sumSaleCentsInInclusiveDayRange(sales, from, to);

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
  }, [transactions, periodStart, periodEnd, language]);

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
    () =>
      appointmentsInPeriod.filter(
        (a) =>
          a.status === 'completed' &&
          (Boolean(a.transaction_id) || Boolean(a.billed))
      ).length,
    [appointmentsInPeriod]
  );

  const [revenueTopServices, setRevenueTopServices] = useState<
    { rows: { name: string; value: number }[]; denom: number } | null | 'loading'
  >('loading');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setRevenueTopServices('loading');
      if (!businessId) {
        if (!cancelled) setRevenueTopServices(null);
        return;
      }
      const startIso = startOfDay(periodStart).toISOString();
      const endExclusive = addDays(startOfDay(periodEnd), 1).toISOString();
      const periodStartTs = new Date(startIso).getTime();
      const periodEndTs = new Date(endExclusive).getTime();
      const uncategorizedLabel = t('dashboard.uncategorizedService');
      const emptyLabelMap = new Map<string, string>();

      const centsByName = new Map<string, number>();

      for (const { transaction, lineItems } of loadDemoTransactionEntries(businessId)) {
        const ct = new Date(transaction.created_at).getTime();
        if (ct < periodStartTs || ct >= periodEndTs) continue;
        if (!SALE_STATUSES.includes(transaction.status as (typeof SALE_STATUSES)[number])) continue;
        for (const li of lineItems) {
          if (li.type !== 'service') continue;
          const bucket = bucketNameForServiceLine(
            li.name,
            transaction.appointment_id ?? null,
            emptyLabelMap,
            uncategorizedLabel
          );
          if (!bucket) continue;
          centsByName.set(bucket, (centsByName.get(bucket) ?? 0) + li.line_total);
        }
      }

      type TxRow = {
        appointment_id?: string | null;
        transaction_line_items?: { name: string; line_total: number; type: string }[] | null;
      };

      const { data: txRows, error } = await supabase
        .from('transactions' as any)
        .select('appointment_id, transaction_line_items(name, line_total, type)')
        .eq('business_id', businessId)
        .in('status', ['paid', 'partial'])
        .gte('created_at', startIso)
        .lt('created_at', endExclusive);

      const appointmentServiceLabelById = new Map<string, string>();

      if (!error && Array.isArray(txRows)) {
        const appointmentIds = new Set<string>();
        for (const row of txRows as TxRow[]) {
          const aid = row.appointment_id;
          if (aid != null && String(aid).length > 0) appointmentIds.add(String(aid));
        }
        const ids = [...appointmentIds];
        const serviceIds = new Set<string>();
        const apptRowsFlat: { id: string; service_type?: string | null; service_id?: string | null }[] = [];
        for (const part of chunkArray(ids, 150)) {
          const { data: apptRows } = await supabase
            .from('appointments')
            .select('id, service_type, service_id')
            .eq('business_id', businessId)
            .in('id', part);
          for (const a of apptRows ?? []) {
            const row = a as { id: string; service_type?: string | null; service_id?: string | null };
            apptRowsFlat.push(row);
            const sid = row.service_id != null && String(row.service_id).length > 0 ? String(row.service_id) : '';
            if (sid) serviceIds.add(sid);
          }
        }
        const serviceNameById = new Map<string, string>();
        for (const part of chunkArray([...serviceIds], 150)) {
          if (part.length === 0) continue;
          const { data: svcRows } = await supabase
            .from('services')
            .select('id, name')
            .eq('business_id', businessId)
            .in('id', part);
          for (const s of svcRows ?? []) {
            const sv = s as { id: string; name?: string | null };
            const nm = String(sv.name ?? '').trim();
            if (nm) serviceNameById.set(String(sv.id), nm);
          }
        }
        for (const row of apptRowsFlat) {
          const idStr = String(row.id);
          let label = String(row.service_type ?? '').trim();
          if (!label && row.service_id != null && String(row.service_id).length > 0) {
            const cat = serviceNameById.get(String(row.service_id));
            if (cat) label = cat;
          }
          if (label) appointmentServiceLabelById.set(idStr, label);
        }

        for (const row of txRows as TxRow[]) {
          const items = row.transaction_line_items;
          if (!Array.isArray(items)) continue;
          for (const li of items) {
            if (li.type !== 'service') continue;
            const bucket = bucketNameForServiceLine(
              li.name,
              row.appointment_id ?? null,
              appointmentServiceLabelById,
              uncategorizedLabel
            );
            if (!bucket) continue;
            const cents = Number(li.line_total ?? 0);
            centsByName.set(bucket, (centsByName.get(bucket) ?? 0) + cents);
          }
        }
      } else if (import.meta.env.DEV && error) {
        console.warn('[Dashboard] top services: transactions + line items', error);
      }

      const totalCents = [...centsByName.values()].reduce((s, v) => s + v, 0);
      if (totalCents <= 0) {
        if (!cancelled) setRevenueTopServices(null);
        return;
      }

      const rows = Array.from(centsByName.entries())
        .map(([name, cents]) => ({ name, value: cents / 100 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
      const denom = totalCents / 100;
      if (!cancelled) setRevenueTopServices({ rows, denom });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [businessId, periodStart, periodEnd, language]);

  /**
   * Base dashboard data (appointments, clients, transactions list, pie, revenue chart).
   * Top selling services loads in the background — that card already has its own loading UI.
   */
  const dashboardCoreReady =
    Boolean(businessId) && !dataLoading && !transactionsLoading;
  /** Start lifted when core data is already ready (e.g. return visit) so PawLoadedContent does not play enter+leave back-to-back. */
  const [pawLifted, setPawLifted] = useState(dashboardCoreReady);
  const [chartEnterKey, setChartEnterKey] = useState(0);
  /** Ignore transient `businessId === null` (slug/auth races) so the paw overlay does not flash off/on. */
  const lastNonNullBusinessIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (businessId == null) return;
    const prev = lastNonNullBusinessIdRef.current;
    lastNonNullBusinessIdRef.current = businessId;
    if (prev !== null && prev !== businessId) {
      setPawLifted(false);
    }
  }, [businessId]);
  useEffect(() => {
    if (dashboardCoreReady) setPawLifted(true);
  }, [dashboardCoreReady]);
  useEffect(() => {
    if (pawLifted) setChartEnterKey((k) => k + 1);
  }, [pawLifted]);

  /** Top selling = paid/partial service line revenue only (no appointment-count fallback). */
  const topSellingDisplay = useMemo(() => {
    if (revenueTopServices === 'loading') {
      return { loading: true as const, rows: [] as { name: string; value: number }[], denom: 0 };
    }
    if (revenueTopServices === null || revenueTopServices.rows.length === 0) {
      return { loading: false as const, rows: [] as { name: string; value: number }[], denom: 0 };
    }
    return {
      loading: false as const,
      rows: revenueTopServices.rows,
      denom: revenueTopServices.denom,
    };
  }, [revenueTopServices]);

  /** Bar length vs #1 earner (full width = highest $ in the top 3). */
  const topServicesBarMax = Math.max(topSellingDisplay.rows[0]?.value ?? 0, 1e-6);
  const topServicesBarFillColors = [
    'hsl(var(--primary))',
    'hsl(var(--primary) / 0.82)',
    'hsl(var(--primary) / 0.64)',
  ] as const;

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
    <PawLoadedContent
      loading={!pawLifted}
      loaderLabel={t('common.loading')}
      reveal={false}
      viewportCover
      leavingTransition="scaleReveal"
    >
    <div className="space-y-8" data-transition-root data-dashboard-stagger>
      {/* Period selector above the card grid */}
      <DashboardStaggerItem key={`dsk-${chartEnterKey}-0`} index={0}>
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
      </div>
      </DashboardStaggerItem>

      {/* Stats row: cards left→right top→bottom */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4" data-transition-containers>
          {/* Card 1: Top selling — same row height as client-type / KPI cards (no fixed aspect) */}
          <DashboardStaggerItem
            key={`dsk-${chartEnterKey}-1`}
            index={1}
            className="min-w-0 sm:col-span-2 lg:col-span-2 h-full min-h-0"
          >
          <Link
            to={businessSlug ? `/${businessSlug}/reports/analytics` : '/reports/analytics'}
            className="block cursor-pointer w-full h-full min-h-0 max-w-full lg:mx-auto lg:max-w-[min(100%,20rem)] xl:mx-0 xl:max-w-none"
          >
            <Card className="card-glass hover:-translate-y-0.5 transition-all duration-200 h-full w-full flex flex-col overflow-hidden">
              <CardContent className="p-2.5 sm:p-3 flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight shrink-0">
                  {t('dashboard.topSellingServices')}
                </p>
                <div className="flex-1 min-h-0 flex flex-col justify-center overflow-y-auto">
                  {topSellingDisplay.loading ? (
                    <p className="text-xs text-muted-foreground text-center px-1 py-3">{t('common.loading')}</p>
                  ) : topSellingDisplay.rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center px-1 py-3">{t('dashboard.noTopServicesData')}</p>
                  ) : (
                    <div className="flex flex-col gap-2 w-full min-w-0">
                      {topSellingDisplay.rows.map((row, index) => {
                        const fillPct = topServicesBarMax > 0 ? (row.value / topServicesBarMax) * 100 : 0;
                        const denom = topSellingDisplay.denom;
                        const shareOfAllPct =
                          denom > 0 ? Math.round((row.value / denom) * 100) : 0;
                        const revenueAmountStr = `$${Math.round(row.value).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}`;
                        const barColor = topServicesBarFillColors[index] ?? topServicesBarFillColors[2];
                        const barDelay = dashboardStaggerDelayMs(1) + index * 90;
                        return (
                          <UiTooltip key={`${row.name}-${index}`} delayDuration={200}>
                            <TooltipTrigger asChild>
                              <div className="min-w-0 cursor-default select-none">
                                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] gap-x-2 items-center w-full min-w-0">
                                  <span
                                    className="text-[11px] font-medium text-foreground truncate min-w-0 text-left"
                                    title={row.name}
                                  >
                                    {row.name}
                                  </span>
                                  <div className="min-w-0">
                                    <TopServiceRevenueBar
                                      fillPercent={fillPct}
                                      delayMs={barDelay}
                                      backgroundColor={barColor}
                                      trackClassName="h-2.5"
                                    />
                                  </div>
                                  <span className="text-[11px] tabular-nums text-foreground font-semibold whitespace-nowrap shrink-0 text-right pl-0.5">
                                    {revenueAmountStr}
                                  </span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              align="center"
                              sideOffset={8}
                              className="max-w-[280px] border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm"
                            >
                              <p className="font-medium text-foreground">{row.name}</p>
                              <p className="text-muted-foreground mt-0.5">
                                {t('dashboard.topServiceTooltipRevenueLine', { amount: revenueAmountStr })}
                              </p>
                              {denom > 0 && (
                                <p className="text-muted-foreground/90 mt-1">
                                  {t('dashboard.topServiceShareOfAllSales', { pct: shareOfAllPct })}
                                </p>
                              )}
                            </TooltipContent>
                          </UiTooltip>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
          </DashboardStaggerItem>

          {/* Card 2: New vs Repeat clients (pie) — reference height for row 1 */}
          <DashboardStaggerItem
            key={`dsk-${chartEnterKey}-2`}
            index={2}
            className="min-w-0 sm:col-span-1 lg:col-span-1 h-full min-h-0"
          >
          <Link
            to={businessSlug ? `/${businessSlug}/clients` : '/clients'}
            className="block cursor-pointer h-full"
          >
            <Card className="card-glass hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col overflow-hidden">
              <CardContent className="p-2.5 flex-1 flex flex-col min-h-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">
                  {t('dashboard.clientType')}
                </p>
                <div
                  ref={pieContainerRef}
                  className="flex-1 min-h-[52px] max-h-[132px] flex items-center justify-center mt-0.5 w-full min-w-0"
                  style={{ minHeight: 52 }}
                >
                  {newVsRepeatData.every((d) => d.value === 0) ? (
                    <p className="text-xs text-muted-foreground">{t('dashboard.noData')}</p>
                  ) : (
                    (() => {
                      const w = pieSize.w || 200;
                      const h = pieSize.h || 120;
                      const legendHeight = 22;
                      const gap = 2;
                      const chartHeight = Math.max(52, Math.min(108, h - legendHeight - gap));
                      const totalSize = Math.min(w, chartHeight) || 100;
                      const margin = 3;
                      const outerRadius = Math.max(20, Math.min(44, totalSize * 0.36));
                      const innerRadius = Math.max(12, Math.min(outerRadius - 5, outerRadius * 0.55));
                      const total = newVsRepeatData.reduce((s, d) => s + d.value, 0);
                      return (
                        <div className="flex flex-col items-center w-full min-h-0 shrink">
                          <div className="w-full shrink-0 animate-pie-rotate-in" style={{ height: chartHeight }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart
                                key={`pie-nvr-${chartEnterKey}`}
                                margin={{ top: margin, right: margin, bottom: margin, left: margin }}
                              >
                              <Pie
                                data={newVsRepeatData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={innerRadius}
                                outerRadius={outerRadius}
                                paddingAngle={0}
                                stroke="none"
                                isAnimationActive
                                animationBegin={0}
                                animationDuration={420}
                                animationEasing="ease-out"
                                startAngle={90}
                                endAngle={-270}
                                label={false}
                                labelLine={false}
                              >
                                {newVsRepeatData.map((entry, i) => (
                                  <Cell key={`${entry.name}-${i}`} fill={entry.color} stroke="none" />
                                ))}
                              </Pie>
                              <Tooltip
                                content={({ active }) => {
                                  if (!active) return null;
                                  const newCount = newVsRepeatData[0]?.value ?? 0;
                                  const repeatCount = newVsRepeatData[1]?.value ?? 0;
                                  if (newCount === 0 && repeatCount === 0) return null;
                                  return (
                                    <div
                                      className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm space-y-0.5"
                                      style={{ borderColor: 'hsl(var(--border))' }}
                                    >
                                      <div>{t('dashboard.tooltipNewClientsFull', { n: newCount })}</div>
                                      <div>{t('dashboard.tooltipRepeatClientsFull', { n: repeatCount })}</div>
                                    </div>
                                  );
                                }}
                              />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-nowrap justify-center items-center gap-x-2.5 gap-y-0 mt-1 shrink-0 text-xs text-muted-foreground">
                            {newVsRepeatData.filter((d) => d.value > 0).map((entry, i) => (
                              <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="text-foreground font-normal">{entry.name}</span>
                                <span className="tabular-nums font-normal">{total ? ((entry.value / total) * 100).toFixed(0) : 0}%</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
          </DashboardStaggerItem>

          {/* Card 3: Completed & billed (period) */}
          <DashboardStaggerItem
            key={`dsk-${chartEnterKey}-3`}
            index={3}
            className="min-w-0 sm:col-span-1 lg:col-span-1 h-full min-h-0"
          >
          <Link
            to={businessSlug ? `/${businessSlug}/appointments` : '/appointments'}
            className="block cursor-pointer h-full"
          >
            <StatCard
              compact
              title={t('dashboard.servicesCompleted')}
              value={servicesCompletedCount}
              icon={Calendar}
              animate
              className="h-full"
            />
          </Link>
          </DashboardStaggerItem>

          {/* Card 4: Active staff */}
          <DashboardStaggerItem
            key={`dsk-${chartEnterKey}-4`}
            index={4}
            className="min-w-0 sm:col-span-1 lg:col-span-1 h-full min-h-0"
          >
          <Link
            to={businessSlug ? `/${businessSlug}/staff-management` : '/staff-management'}
            className="block cursor-pointer h-full"
          >
            <StatCard
              compact
              title={t('dashboard.activeStaff')}
              value={activeEmployees}
              icon={Clock}
              description={t('dashboard.teamMembers')}
              animate
              className="h-full"
            />
          </Link>
          </DashboardStaggerItem>

          {/* Card 5: Growth (was today appointments KPI) */}
          <DashboardStaggerItem
            key={`dsk-${chartEnterKey}-5`}
            index={5}
            className="min-w-0 sm:col-span-1 lg:col-span-1 h-full min-h-0"
          >
          <Link
            to={businessSlug ? `/${businessSlug}/reports/analytics` : '/reports/analytics'}
            className="block cursor-pointer h-full"
          >
            <StatCard
              compact
              title={t('dashboard.growth')}
              value={
                growthPct === null || !Number.isFinite(growthPct) ? '—' : Math.abs(growthPct)
              }
              icon={TrendingUp}
              description={growthPeriodLabel}
              animate={growthPct !== null && Number.isFinite(growthPct)}
              animatePrefix={
                growthPct !== null && Number.isFinite(growthPct)
                  ? growthPct >= 0
                    ? '+'
                    : '−'
                  : undefined
              }
              animateSuffix={
                growthPct !== null && Number.isFinite(growthPct) ? '%' : undefined
              }
              className="h-full"
            />
          </Link>
          </DashboardStaggerItem>
        </div>
      </div>

      {/* Today's Appointments (2/6) + Revenue chart (4/6) — tops aligned on lg+ */}
      <div
        className="grid grid-cols-1 lg:grid-cols-6 gap-6 items-start"
        data-transition-row="2"
        data-transition-containers
      >
        <DashboardStaggerItem
          key={`dsk-${chartEnterKey}-6`}
          index={6}
          className="min-w-0 lg:col-span-2 lg:row-start-1"
        >
        <Link
          to={businessSlug ? `/${businessSlug}/appointments` : '/appointments'}
          className="block cursor-pointer h-full min-h-0"
        >
        <Card
          className="shadow-none hover:shadow-md transition-shadow h-full flex flex-col min-h-[22rem] max-h-[560px]"
          role="article"
        >
          <CardHeader className="shrink-0 flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2" data-card-title>
              <Calendar className="w-5 h-5 text-primary" />
              {t('dashboard.todayAppointments')} ({todayAppointments})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto min-h-0 flex flex-col min-h-[17rem]">
            {(() => {
              const shown = todaysAppointmentsList.slice(0, TODAY_APPOINTMENTS_DISPLAY_MAX);
              const filler = TODAY_APPOINTMENTS_DISPLAY_MAX - shown.length;
              return (
                <>
                  {shown.length === 0 ? (
                    <p className="text-muted-foreground text-center text-xs mb-3">{t('dashboard.noAppointmentsToday')}</p>
                  ) : null}
                  <div className="space-y-2 flex-1" data-list style={{ ['--list-start' as string]: '0.52s' }}>
                    {shown.map((appointment) => {
                      const pet = pets.find((p) => p.id === appointment.pet_id);
                      const client = pet ? clients.find((c) => c.id === pet.client_id) : null;
                      const employee = appointment.staff_id
                        ? employees.find((e) => e.id === appointment.staff_id)
                        : null;
                      return (
                        <div
                          key={appointment.id}
                          data-list-item
                          className="flex items-center justify-between p-2.5 bg-secondary/50 rounded-lg text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{pet?.name || t('appointments.unknownPet')}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {format(new Date(appointment.scheduled_date), 'h:mm a', { locale: dateLocale })} •{' '}
                              {client ? `${client.first_name} ${client.last_name}`.trim() : '—'}
                              {employee && ` • ${employee.name}`}
                            </p>
                          </div>
                          <Badge
                            variant={
                              appointment.status === 'completed'
                                ? 'default'
                                : appointment.status === 'cancelled'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="shrink-0 ml-2 text-[10px]"
                          >
                            {appointment.status}
                          </Badge>
                        </div>
                      );
                    })}
                    {filler > 0
                      ? Array.from({ length: filler }, (_, i) => (
                          <AppointmentSlotPlaceholder key={`appt-slot-${i}`} />
                        ))
                      : null}
                  </div>
                  {shown.length > 0 ? (
                    <div className="mt-3 pt-2 border-t border-border shrink-0">
                      <span className="text-sm font-medium text-primary hover:underline">
                        {t('dashboard.viewAll')}
                      </span>
                    </div>
                  ) : null}
                </>
              );
            })()}
          </CardContent>
        </Card>
        </Link>
        </DashboardStaggerItem>

        {/* Stack revenue + low stock in one column so row height isn’t driven by the tall appointments card */}
        <div className="min-w-0 lg:col-span-4 flex flex-col gap-6">
        <DashboardStaggerItem
          key={`dsk-${chartEnterKey}-7`}
          index={7}
          className="min-w-0"
        >
          <Link
            to={businessSlug ? `/${businessSlug}/reports/analytics` : '/reports/analytics'}
            className="block cursor-pointer w-full min-h-0"
          >
            <Card className="h-full min-h-0 flex flex-col cursor-pointer transition-shadow">
              <CardHeader className="pb-2 pt-4 px-4 sm:px-6 shrink-0">
                <CardTitle className="text-base" data-card-title>
                  {t('dashboard.revenue')}
                </CardTitle>
                <p className="text-xs text-muted-foreground font-normal mt-1 tabular-nums">
                  {format(periodStart, 'd MMM', { locale: dateLocale })} –{' '}
                  {format(periodEnd, 'd MMM yyyy', { locale: dateLocale })}
                  {' · '}$
                  {Math.round(periodRevenueDollars).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </CardHeader>
              <CardContent className="pt-0 px-4 sm:px-6 pb-4 flex-1 min-h-0">
                <DashboardRevenueChart
                  data={periodRevenueChartData}
                  chartEnterKey={chartEnterKey}
                  chartHeight={200}
                  emptyLabel={t('dashboard.noData')}
                  tooltipSeriesName={t('dashboard.revenue')}
                  tooltipFormatter={(value) => [
                    `$${Math.round(Number(value)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    t('dashboard.revenue'),
                  ]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDay ?? ''}
                />
              </CardContent>
            </Card>
          </Link>
        </DashboardStaggerItem>

        <DashboardStaggerItem
          key={`dsk-${chartEnterKey}-8`}
          index={8}
          className="min-w-0"
        >
          <Card className="border border-orange-500/25 bg-gradient-to-br from-orange-500/[0.07] via-card to-card dark:from-orange-500/10">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2 pt-4 px-4 sm:px-6">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base" data-card-title>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span>{t('dashboard.lowStockTitle')}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {t('dashboard.lowStockSubtitle')}
                    </span>
                  </span>
                </CardTitle>
              </div>
              <Link
                to={businessSlug ? `/${businessSlug}/inventory` : '/inventory'}
                className="shrink-0 text-sm font-medium text-primary hover:underline"
              >
                {t('dashboard.openInventory')}
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 sm:px-6">
              {lowStockProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center">
                  <Package className="h-10 w-10 text-muted-foreground/50" aria-hidden />
                  <p className="max-w-sm text-sm text-muted-foreground">{t('dashboard.lowStockEmpty')}</p>
                  <Link
                    to={businessSlug ? `/${businessSlug}/inventory` : '/inventory'}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t('dashboard.openInventory')}
                  </Link>
                </div>
              ) : (
                <ul className="max-h-[min(22rem,55vh)] space-y-2 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
                  {lowStockProducts.map((p) => {
                    const th = reorderThresholdForProduct(p, defaultLowStockThreshold);
                    const ratio = th > 0 ? p.quantity / th : 1;
                    const barPct = Math.min(100, Math.max(p.quantity === 0 ? 5 : 8, ratio * 100));
                    const inv = businessSlug ? `/${businessSlug}/inventory` : '/inventory';
                    return (
                      <li key={p.id}>
                        <Link
                          to={`${inv}?product=${encodeURIComponent(p.id)}`}
                          className="block rounded-lg border border-orange-500/25 bg-card/80 px-3 py-2.5 shadow-none ring-1 ring-orange-500/10 transition hover:border-orange-500/45 hover:bg-card hover:shadow-md hover:ring-orange-500/20"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-snug text-foreground truncate">
                                {p.name}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                                {t('inventory.stock')}: {p.quantity}
                                <span className="mx-1.5 text-border">·</span>
                                {t('inventory.reorderLevel')}: {th}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
                                p.quantity === 0
                                  ? 'bg-destructive/15 text-destructive'
                                  : 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                              )}
                            >
                              {p.quantity}
                            </span>
                          </div>
                          <div
                            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                            title={`${p.quantity} / ${th}`}
                          >
                            <div
                              className={cn(
                                'h-full rounded-full bg-gradient-to-r transition-all',
                                p.quantity === 0
                                  ? 'from-destructive to-destructive/80'
                                  : 'from-amber-500 to-orange-600'
                              )}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </DashboardStaggerItem>
        </div>
      </div>

      {/* Collapsible Data Diagnostics at bottom */}
      <DashboardStaggerItem key={`dsk-${chartEnterKey}-9`} index={9}>
      <details className="mt-8 border border-border rounded-lg bg-card/50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium flex items-center justify-between">
          <span>Show Diagnostics</span>
          <span className="text-xs text-muted-foreground">(for troubleshooting only)</span>
        </summary>
        <div className="pt-2">
          <DataDiagnostics />
        </div>
      </details>
      </DashboardStaggerItem>
    </div>
    </PawLoadedContent>
  );
}
