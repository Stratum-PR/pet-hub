/**
 * Decorative Branding Book SVGs (public/brand). Kept small on-screen; prefer lighter
 * assets (flower-5/8, single-tile) for perf. Large sources (tennis-ball, plant-swishing,
 * pet-collar) remain in public/brand for future SVGO/export—avoid loading them here until optimized.
 */

const BRAND = {
  flower5: '/brand/flower-5.svg',
  flower8: '/brand/flower-8.svg',
  singleTile: '/brand/single-tile.svg',
  dogBowl: '/brand/dog-bowl.svg',
  dogCollar: '/brand/dog-collar.svg',
} as const;

type MotifImgProps = {
  src: string;
  className: string;
  /** Hint decode priority for above-the-fold hero. */
  fetchPriority?: 'high' | 'low' | 'auto';
};

function MotifImg({ src, className, fetchPriority = 'low' }: MotifImgProps) {
  return (
    <img
      src={src}
      alt=""
      width={160}
      height={160}
      decoding="async"
      loading="lazy"
      fetchPriority={fetchPriority}
      className={`pointer-events-none select-none object-contain ${className}`}
      aria-hidden
    />
  );
}

/** Corner flowers for shared marketing hero panels (Pricing, Contact, Why Grumi). */
export function MarketingHeroBrandMotifs() {
  return (
    <>
      <MotifImg
        src={BRAND.flower8}
        fetchPriority="low"
        className="absolute -left-6 -top-4 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 opacity-[0.14] dark:opacity-[0.1]"
      />
      <MotifImg
        src={BRAND.flower5}
        fetchPriority="low"
        className="absolute -right-4 bottom-0 w-20 h-20 sm:w-24 sm:h-24 opacity-[0.12] dark:opacity-[0.09]"
      />
    </>
  );
}

/** Soft tile + flowers behind the features marketing hero strip and grid region. */
export function FeaturesBrandBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <MotifImg
        src={BRAND.singleTile}
        className="absolute left-1/2 top-1/2 min-w-[140%] min-h-[140%] -translate-x-1/2 -translate-y-1/2 opacity-[0.06] dark:opacity-[0.045] scale-110"
      />
      <MotifImg
        src={BRAND.flower5}
        className="absolute -right-8 top-24 w-32 h-32 md:w-40 md:h-40 opacity-[0.11] dark:opacity-[0.08]"
      />
      <MotifImg
        src={BRAND.flower8}
        className="absolute -left-10 bottom-32 w-28 h-28 md:w-36 md:h-36 opacity-[0.1] dark:opacity-[0.075]"
      />
    </div>
  );
}

/** Pet-forward accents beside the landing waitlist (large screens). */
export function LandingWaitlistBrandMotifs() {
  return (
    <>
      <MotifImg
        src={BRAND.dogBowl}
        fetchPriority="low"
        className="hidden xl:block absolute -left-4 lg:-left-8 bottom-0 w-24 h-24 opacity-20"
      />
      <MotifImg
        src={BRAND.dogCollar}
        fetchPriority="low"
        className="hidden xl:block absolute -right-4 lg:-right-10 top-1/2 -translate-y-1/2 w-28 h-28 opacity-[0.18]"
      />
    </>
  );
}
