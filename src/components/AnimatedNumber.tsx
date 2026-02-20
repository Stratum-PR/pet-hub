import { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Format as currency (e.g. $1,234.56) */
  currency?: boolean;
  className?: string;
}

function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

export function AnimatedNumber({
  value,
  duration = 800,
  decimals = 0,
  prefix = '',
  suffix = '',
  currency = false,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prevValueRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevValueRef.current;
    const to = value;
    if (from === to) return;
    prevValueRef.current = to;

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = currency
    ? display.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString();

  return (
    <span className={className}>
      {prefix}
      {currency ? `$${formatted}` : formatted}
      {suffix}
    </span>
  );
}
