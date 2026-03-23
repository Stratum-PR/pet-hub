import { cn } from '@/lib/utils';
import { PET_PAW_G_TRANSFORM, PET_PAW_PATHS, PET_PAW_VIEWBOX } from '@/lib/petPawGeometry';
import './PawprintLoader.css';

/** ~35% smaller than original (between 30–40% reduction) for a lighter loading mark */
const SIZE_CLASS = {
  sm: 'h-10 w-10',
  md: 'h-[4.5rem] w-[4.5rem]',
  lg: 'h-24 w-24',
} as const;

export type PawprintLoaderSize = keyof typeof SIZE_CLASS;

export interface PawprintLoaderProps {
  size?: PawprintLoaderSize;
  className?: string;
  label?: string;
  showLabel?: boolean;
  fullscreen?: boolean;
  fullscreenZ?: number;
  /** No flex-1 / min-height — use inside cards or small rows */
  compact?: boolean;
}

/**
 * Five-part paw (vecteezy artboard via `petPawGeometry`). Fill uses `currentColor` → `--primary`.
 * Main breathes 1↔1.1× / 0.72s (`alternate`); toes wave L→R with staggered delays (see CSS).
 */
export function PawprintLoader({
  size = 'md',
  className,
  label = 'Loading',
  showLabel = false,
  fullscreen = false,
  fullscreenZ = 50,
  compact = false,
}: PawprintLoaderProps) {
  const { toe1, toe2, toe3, toe4, main } = PET_PAW_PATHS;

  const svg = (
    <svg
      className={cn(SIZE_CLASS[size], 'shrink-0 translate-y-1 text-primary')}
      viewBox={PET_PAW_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g transform={PET_PAW_G_TRANSFORM}>
        {/* Toes left → right (by path start x); outer toes use smaller jump in CSS */}
        <g className="pawprint-loader__toe pawprint-loader__toe--1">
          <path className="fill-current" d={toe1} />
        </g>
        <g className="pawprint-loader__toe pawprint-loader__toe--2">
          <path className="fill-current" d={toe2} />
        </g>
        <g className="pawprint-loader__toe pawprint-loader__toe--3">
          <path className="fill-current" d={toe3} />
        </g>
        <g className="pawprint-loader__toe pawprint-loader__toe--4">
          <path className="fill-current" d={toe4} />
        </g>
        <path className="pawprint-loader__main fill-current" d={main} />
      </g>
    </svg>
  );

  const inner = (
    <div
      className="flex flex-col items-center justify-center gap-3 text-primary"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {svg}
      {showLabel ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className={cn(
          'fixed inset-0 grid h-[100dvh] max-h-[100dvh] w-full place-items-center overflow-hidden bg-background p-4',
          className
        )}
        style={{ zIndex: fullscreenZ }}
      >
        {inner}
      </div>
    );
  }

  /* Default: fill route column + true viewport-ish height so the paw sits mid-screen; compact: inline only */
  return (
    <div
      className={cn(
        compact
          ? 'grid w-full place-items-center'
          : 'grid w-full flex-1 place-items-center self-stretch min-h-[max(70vh,calc(100dvh-10rem))]',
        className
      )}
    >
      {inner}
    </div>
  );
}

/** Centered block for compact sections (tables, cards). */
export function PawprintLoaderBlock({
  className,
  minHeight = 'min-h-[200px]',
  size = 'md',
  label,
}: {
  className?: string;
  minHeight?: string;
  size?: PawprintLoaderSize;
  label?: string;
}) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center self-stretch',
        minHeight,
        className
      )}
    >
      <PawprintLoader compact size={size} label={label} />
    </div>
  );
}
