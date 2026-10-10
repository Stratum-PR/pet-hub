import { useMemo } from 'react';
import { addMonths, endOfMonth, format, isValid, startOfMonth } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';

/** Months shown in the chart (fewer if the first business is newer). */
const GROWTH_MONTHS = 12;

type GrowthPoint = { key: string; label: string; total: number; added: number };

/**
 * Admin dashboard headline: how many client businesses Grumi has, this month's change,
 * and a line of the total at the end of each month (single series, so no legend).
 */
export function AdminGrowthPanel({ createdDates, now: nowProp }: { createdDates: (string | null)[]; now?: Date }) {
  const { language } = useLanguage();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const dateLocale = language === 'es' ? esLocale : enUS;

  const growth = useMemo(() => {
    const created = createdDates
      .map((v) => (v ? new Date(v) : null))
      .filter((d): d is Date => d != null && isValid(d));
    if (created.length === 0) return { points: [] as GrowthPoint[], total: 0, thisMonth: 0, lastMonth: 0 };
    const first = startOfMonth(created.reduce((a, b) => (a < b ? a : b)));
    let start = startOfMonth(addMonths(now, -(GROWTH_MONTHS - 1)));
    if (first > start) start = first;
    const points: GrowthPoint[] = [];
    for (let m = start; m <= now; m = addMonths(m, 1)) {
      const end = endOfMonth(m);
      points.push({
        key: format(m, 'yyyy-MM'),
        label: format(m, 'MMM yy', { locale: dateLocale }),
        total: created.filter((d) => d <= end).length,
        added: created.filter((d) => d >= m && d <= end).length,
      });
    }
    const monthStart = startOfMonth(now);
    const prevStart = startOfMonth(addMonths(now, -1));
    return {
      points,
      total: created.length,
      thisMonth: created.filter((d) => d >= monthStart).length,
      lastMonth: created.filter((d) => d >= prevStart && d < monthStart).length,
    };
  }, [createdDates, now, dateLocale]);

  return (
    <Card>
      <CardContent className="grid gap-6 p-6 md:grid-cols-[minmax(0,14rem)_1fr] md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">{t('admin.growthTitle')}</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums">{growth.total}</p>
          <p className="mt-2 text-sm">
            <span className="font-medium">
              {t('admin.growthThisMonth', { sign: growth.thisMonth > 0 ? '+' : '', count: growth.thisMonth })}
            </span>
            <span className="text-muted-foreground"> · {t('admin.growthVsLastMonth', { count: growth.lastMonth })}</span>
          </p>
        </div>
        {growth.points.length > 1 && (
          <figure
            className="h-40 min-w-0 [--growth-line:#3f8a4b] dark:[--growth-line:#62a76a]"
            aria-label={t('admin.growthChartLabel', { months: growth.points.length })}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth.points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  domain={[0, 'dataMax']}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload as
                      | { label: string; total: number; added: number }
                      | undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                        <p className="font-medium">{p.label}</p>
                        <p>{t('admin.growthTooltip', { count: p.total })}</p>
                        <p className="text-muted-foreground">{t('admin.growthNew', { count: p.added })}</p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="linear"
                  dataKey="total"
                  stroke="var(--growth-line)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--growth-line)', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: 'var(--growth-line)', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <table className="sr-only">
              <tbody>
                {growth.points.map((p) => (
                  <tr key={p.key}>
                    <th scope="row">{p.label}</th>
                    <td>{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}
