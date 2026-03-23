import { useId, useLayoutEffect, useRef } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

export type DashboardRevenueChartPoint = {
  day: string;
  fullDay: string;
  revenue: number;
};

const DRAW_MS = 2400;

function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

export function DashboardRevenueChart({
  data,
  chartEnterKey,
  emptyLabel,
  tooltipSeriesName,
  tooltipFormatter,
  labelFormatter,
  chartHeight = 220,
}: {
  data: DashboardRevenueChartPoint[];
  chartEnterKey: number;
  emptyLabel: string;
  tooltipSeriesName: string;
  tooltipFormatter: (value: number) => [string, string];
  labelFormatter: (_: unknown, payload: readonly { payload?: DashboardRevenueChartPoint }[]) => string;
  /** SVG plot height in px (ResponsiveContainer). */
  chartHeight?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseId = useId().replace(/:/g, '');
  const strokeGradId = `dashboardRevenueStroke-${baseId}`;
  const fillGradId = `dashboardRevenueFill-${baseId}`;

  useLayoutEffect(() => {
    const root = wrapRef.current;
    if (!root || data.length === 0) return;

    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const applyEndState = (curve: SVGPathElement, area: SVGPathElement | null) => {
      curve.style.strokeDasharray = '';
      curve.style.strokeDashoffset = '';
      if (area) area.style.opacity = '1';
    };

    let cancelled = false;
    let raf = 0;
    let pathAttempts = 0;
    const maxPathAttempts = 48;

    const startDraw = () => {
      if (cancelled) return;
      const curve = root.querySelector<SVGPathElement>('.recharts-area-curve');
      const area = root.querySelector<SVGPathElement>('.recharts-area-area');
      if (!curve) {
        pathAttempts += 1;
        if (pathAttempts < maxPathAttempts) {
          raf = requestAnimationFrame(startDraw);
        }
        return;
      }

      if (reduceMotion) {
        applyEndState(curve, area ?? null);
        return;
      }

      const len = curve.getTotalLength();
      if (!Number.isFinite(len) || len <= 0) {
        applyEndState(curve, area ?? null);
        return;
      }

      curve.style.strokeDasharray = `${len}`;
      curve.style.strokeDashoffset = `${len}`;
      if (area) area.style.opacity = '0';

      const start = performance.now();

      const tick = (now: number) => {
        if (cancelled) return;
        const elapsed = now - start;
        const t = Math.min(1, elapsed / DRAW_MS);
        const eased = easeOutQuint(t);
        curve.style.strokeDashoffset = `${len * (1 - eased)}`;
        if (area) {
          const fillT = Math.min(1, Math.max(0, (t - 0.06) / 0.94));
          area.style.opacity = `${easeOutQuint(fillT)}`;
        }
        if (t < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          applyEndState(curve, area ?? null);
        }
      };

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(() => {
      requestAnimationFrame(startDraw);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const curve = root.querySelector<SVGPathElement>('.recharts-area-curve');
      const area = root.querySelector<SVGPathElement>('.recharts-area-area');
      if (curve) applyEndState(curve, area ?? null);
    };
  }, [data, chartEnterKey, chartHeight]);

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground px-1 py-8 text-center">{emptyLabel}</p>;
  }

  return (
    <div ref={wrapRef} className="w-full">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart
          key={`revenue-chart-${chartEnterKey}`}
          data={data}
          margin={{ top: 12, right: 28, bottom: 24, left: 12 }}
        >
          <defs>
            <linearGradient id={strokeGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
            </linearGradient>
            <linearGradient id={fillGradId} x1="0" y1="1" x2="0" y2="0">
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
            interval={data.length > 10 ? Math.max(0, Math.floor((data.length - 1) / 5)) : 0}
          />
          <Tooltip
            formatter={(value) => tooltipFormatter(Number(value))}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelFormatter={labelFormatter}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name={tooltipSeriesName}
            stroke={`url(#${strokeGradId})`}
            strokeWidth={2}
            fill={`url(#${fillGradId})`}
            dot={{ r: 2, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
            activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
