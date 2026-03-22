import { cn } from '@/lib/utils';

/**
 * Barcode-in-frame scanner icon (SVG Repo “barcode-ui-web”, viewBox normalized).
 * https://www.svgrepo.com/ — CC-friendly asset; embedded for theming via currentColor.
 */
/**
 * Crop around artwork (after `translate(-108,-100)`).
 * Include extra bottom padding — lower corner paths extend past y=22.5; a tight height=17 viewBox clipped them.
 */
const VIEW_BOX = '2.5 5.5 28.5 19';

export function BarcodeScanIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className={cn(
        'block h-full w-full max-h-full max-w-full origin-center overflow-visible scale-[0.6]',
        className
      )}
      aria-hidden
    >
      <g fill="currentColor" fillRule="evenodd" transform="translate(-108,-100)">
        <path d="m 111,106 a 1.0001,1.0001 0 0 0 -1,1 v 3 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -2 h 2 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 z" />
        <path d="m 134,106 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 2 v 2 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -3 a 1.0001,1.0001 0 0 0 -1,-1 z" />
        <path d="m 137,121 a 1,1 0 0 0 -1,1 v 2 h -2 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 3 a 1.0001,1.0001 0 0 0 1,-1 v -3 a 1,1 0 0 0 -1,-1 z" />
        <path d="m 111,121 a 1,1 0 0 0 -1,1 v 3 a 1.0001,1.0001 0 0 0 1,1 h 3 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 h -2 v -2 a 1,1 0 0 0 -1,-1 z" />
        <path d="m 115,110 a 1,1 0 0 0 -1,1 v 10 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -10 a 1,1 0 0 0 -1,-1 z" />
        <path d="m 118,110 a 1,1 0 0 0 -1,1 v 10 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -10 a 1,1 0 0 0 -1,-1 z" />
        <path d="m 121,110 a 1,1 0 0 0 -1,1 v 10 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -10 a 1,1 0 0 0 -1,-1 z" />
        <path d="m 124,110 a 1,1 0 0 0 -1,1 v 10 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -10 a 1,1 0 0 0 -1,-1 z" />
        <path d="m 127,110 a 1,1 0 0 0 -1,1 v 10 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -10 a 1,1 0 0 0 -1,-1 z" />
        <path d="m 130,110 a 1,1 0 0 0 -1,1 v 10 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -10 a 1,1 0 0 0 -1,-1 z" />
        <path d="m 133,110 a 1,1 0 0 0 -1,1 v 5.20703 1.31445 V 121 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 V 117.52148 116.20703 111 a 1,1 0 0 0 -1,-1 z" />
      </g>
    </svg>
  );
}
