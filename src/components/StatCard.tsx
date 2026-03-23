import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  className?: string;
  /** Animate number from 0 to value (and currency from $0 to value) */
  animate?: boolean;
  /** Value is currency (animate from 0 to value) */
  currency?: boolean;
  /** Shown before the animated number (e.g. "+" or "−") */
  animatePrefix?: string;
  /** Shown after the animated number (e.g. "%") */
  animateSuffix?: string;
  /** Optional trend data for mini sparkline (e.g. [10, 12, 9, 14, 11]) */
  trendData?: number[];
  /** Tighter padding and type for secondary / paired tiles */
  compact?: boolean;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  className,
  animate,
  currency,
  animatePrefix,
  animateSuffix,
  trendData,
  compact,
}: StatCardProps) {
  const isNumber = typeof value === 'number';
  const showAnimated = animate && isNumber;
  const sparklineData = trendData?.map((v, i) => ({ v, i })) ?? [];

  if (compact) {
    return (
      <Card
        className={cn(
          'card-glass shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col',
          className
        )}
      >
        <CardContent className="flex flex-1 flex-col min-h-0 p-3.5">
          <div className="flex items-start justify-between gap-2 w-full shrink-0">
            <p className="flex-1 min-w-0 pr-1 font-medium text-muted-foreground uppercase tracking-wide text-[11px] leading-snug">
              {title}
            </p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-3 text-[1.625rem] font-bold leading-none tracking-tight text-foreground tabular-nums">
            {showAnimated ? (
              <AnimatedNumber
                value={value as number}
                duration={520}
                decimals={0}
                currency={!!currency}
                prefix={animatePrefix ?? ''}
                suffix={animateSuffix ?? ''}
              />
            ) : (
              value
            )}
          </p>
          {description ? (
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground line-clamp-2">{description}</p>
          ) : null}
          {sparklineData.length > 0 ? (
            <div className="mt-3 h-8 w-full max-w-[120px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          {/* Soaks vertical stretch from dashboard row so content stays top-aligned */}
          <div className="min-h-0 flex-1" aria-hidden />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'card-glass shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col',
        className
      )}
    >
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="flex flex-1 justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="mt-2 text-[28px] font-bold leading-none tracking-tight">
              {showAnimated ? (
                <AnimatedNumber
                  value={value as number}
                  duration={520}
                  decimals={0}
                  currency={!!currency}
                  prefix={animatePrefix ?? ''}
                  suffix={animateSuffix ?? ''}
                />
              ) : (
                value
              )}
            </p>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
            {sparklineData.length > 0 && (
              <div className="mt-3 h-8 w-full max-w-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="ml-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/60">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
