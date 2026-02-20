import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  /** Animate number from 0 to value (and currency from $0 to value) */
  animate?: boolean;
  /** Value is currency (animate from 0 to value) */
  currency?: boolean;
  /** Optional trend data for mini sparkline (e.g. [10, 12, 9, 14, 11]) */
  trendData?: number[];
}

export function StatCard({ title, value, icon: Icon, description, animate, currency, trendData }: StatCardProps) {
  const isNumber = typeof value === 'number';
  const showAnimated = animate && isNumber;
  const sparklineData = trendData?.map((v, i) => ({ v, i })) ?? [];

  return (
    <Card className="card-glass shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col cursor-default">
      <CardContent className="p-6 flex-1 flex flex-col">
        <div className="flex items-start justify-between flex-1">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-[28px] font-bold mt-2 tracking-tight">
              {showAnimated ? (
                <AnimatedNumber
                  value={value as number}
                  duration={380}
                  decimals={currency ? 2 : 0}
                  currency={!!currency}
                />
              ) : (
                value
              )}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
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
          <div className="w-11 h-11 rounded-full bg-muted/60 flex items-center justify-center flex-shrink-0 ml-4">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
