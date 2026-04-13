import type { ReactNode } from 'react';
import { MarketingHeroBrandMotifs } from './MarketingBrandMotifs';

type Props = {
  children: ReactNode;
  /** When false, skips the lime glow (e.g. nested inside another tinted panel). */
  showGlow?: boolean;
  className?: string;
};

/**
 * Shared marketing hero panel: soft gradient, lime accent glow, rounded frame.
 */
export function MarketingPageHero({ children, showGlow = true, className = '' }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-muted/50 via-background to-primary/[0.07] px-4 py-8 text-center shadow-sm sm:px-8 sm:py-10 md:px-10 md:py-12 ${className}`}
    >
      {showGlow ? (
        <div
          className="pointer-events-none absolute -top-28 left-1/2 h-72 w-[min(100vw,52rem)] -translate-x-1/2 rounded-full bg-[#D4FF00]/20 blur-3xl"
          aria-hidden
        />
      ) : null}
      <MarketingHeroBrandMotifs />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
