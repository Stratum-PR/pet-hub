import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Briefcase,
  CalendarRange,
  Palette,
  PawPrint,
  Plus,
  ScanBarcode,
  Sparkles,
  Timer,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FeaturesBrandBackdrop } from './MarketingBrandMotifs';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { FEATURE_HIGHLIGHT_MASCOT_SRCS } from '@/lib/waitlistMascots';

type FeatureSlide = {
  id: string;
  titleKey: string;
  bodyKey: string;
  Icon: LucideIcon;
  /** Deep gradients aligned with `index.css` (olive primary, clay, chart greens/teals, shell). */
  frontClass: string;
};

type HighlightFeature = {
  id: string;
  titleKey: string;
  bodyKey: string;
  imageSrc: string;
  imageAltKey: string;
  /** Marketing-only corner pet; omit for screenshot-only (Spanish, ATH Móvil). */
  mascotSrc?: (typeof FEATURE_HIGHLIGHT_MASCOT_SRCS)[number];
  /** Where the mascot sits over the screenshot; default bottom-right. */
  mascotAnchor?: 'bottom-right' | 'bottom-left' | 'sidebar-bottom' | 'content-bottom-center';
  /** Smaller mascot (e.g. calendar cat, inventory basset on bottom-right). */
  mascotSize?: 'default' | 'compact';
};

const MARQUEE_GRADIENTS = [
  'bg-gradient-to-br from-[hsl(127_22%_38%)] to-[hsl(127_28%_26%)] dark:from-[hsl(127_26%_46%)] dark:to-[hsl(127_30%_30%)]',
  'bg-gradient-to-br from-[hsl(25_32%_40%)] to-[hsl(25_36%_28%)] dark:from-[hsl(25_28%_48%)] dark:to-[hsl(25_32%_34%)]',
  'bg-gradient-to-br from-[hsl(145_32%_34%)] to-[hsl(145_38%_24%)] dark:from-[hsl(145_28%_42%)] dark:to-[hsl(145_34%_28%)]',
  'bg-gradient-to-br from-[hsl(180_30%_34%)] to-[hsl(195_34%_24%)] dark:from-[hsl(180_26%_42%)] dark:to-[hsl(195_30%_30%)]',
  'bg-gradient-to-br from-[hsl(200_26%_30%)] to-[hsl(200_30%_16%)] dark:from-[hsl(200_22%_38%)] dark:to-[hsl(200_26%_22%)]',
  'bg-gradient-to-br from-[hsl(127_18%_30%)] to-[hsl(25_26%_32%)] dark:from-[hsl(127_22%_38%)] dark:to-[hsl(25_22%_36%)]',
  'bg-gradient-to-br from-[hsl(160_28%_32%)] to-[hsl(175_32%_22%)] dark:from-[hsl(160_24%_40%)] dark:to-[hsl(175_28%_28%)]',
  'bg-gradient-to-br from-[hsl(210_24%_32%)] to-[hsl(220_28%_20%)] dark:from-[hsl(210_20%_40%)] dark:to-[hsl(220_24%_26%)]',
] as const;

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    id: 'm1',
    titleKey: 'marketing.features.marquee.m1.title',
    bodyKey: 'marketing.features.marquee.m1.body',
    Icon: ArrowLeftRight,
    frontClass: MARQUEE_GRADIENTS[0],
  },
  {
    id: 'm2',
    titleKey: 'marketing.features.marquee.m2.title',
    bodyKey: 'marketing.features.marquee.m2.body',
    Icon: Timer,
    frontClass: MARQUEE_GRADIENTS[1],
  },
  {
    id: 'm3',
    titleKey: 'marketing.features.marquee.m3.title',
    bodyKey: 'marketing.features.marquee.m3.body',
    Icon: CalendarRange,
    frontClass: MARQUEE_GRADIENTS[2],
  },
  {
    id: 'm4',
    titleKey: 'marketing.features.marquee.m4.title',
    bodyKey: 'marketing.features.marquee.m4.body',
    Icon: Sparkles,
    frontClass: MARQUEE_GRADIENTS[3],
  },
  {
    id: 'm5',
    titleKey: 'marketing.features.marquee.m5.title',
    bodyKey: 'marketing.features.marquee.m5.body',
    Icon: Palette,
    frontClass: MARQUEE_GRADIENTS[4],
  },
  {
    id: 'm6',
    titleKey: 'marketing.features.marquee.m6.title',
    bodyKey: 'marketing.features.marquee.m6.body',
    Icon: Briefcase,
    frontClass: MARQUEE_GRADIENTS[5],
  },
  {
    id: 'm7',
    titleKey: 'marketing.features.marquee.m7.title',
    bodyKey: 'marketing.features.marquee.m7.body',
    Icon: UsersRound,
    frontClass: MARQUEE_GRADIENTS[6],
  },
  {
    id: 'm8',
    titleKey: 'marketing.features.marquee.m8.title',
    bodyKey: 'marketing.features.marquee.m8.body',
    Icon: ScanBarcode,
    frontClass: MARQUEE_GRADIENTS[7],
  },
];

/** Bump when replacing files under `public/marketing/features/custom/` or re-running optimize:feature-screenshots. */
const FEATURE_SCREENSHOT_V = '10';
/** Hint for layout reserve; carousel frame is locked with `aspect-[16/10]`. */
const FEATURE_SCREENSHOT_HINT_W = 1600;
const FEATURE_SCREENSHOT_HINT_H = 1000;

const HIGHLIGHT_FEATURES: HighlightFeature[] = [
  {
    id: 'spanish',
    titleKey: 'marketing.features.highlight.spanish.title',
    bodyKey: 'marketing.features.highlight.spanish.body',
    /** Bump FEATURE_SCREENSHOT_V when replacing this PNG. */
    imageSrc: `/marketing/features/custom/feature-spanish.png?v=${FEATURE_SCREENSHOT_V}`,
    imageAltKey: 'marketing.features.highlight.spanish.imageAlt',
    mascotSrc: FEATURE_HIGHLIGHT_MASCOT_SRCS[2],
    mascotAnchor: 'bottom-left',
  },
  {
    id: 'calendar',
    titleKey: 'marketing.features.highlight.calendar.title',
    bodyKey: 'marketing.features.highlight.calendar.body',
    imageSrc: `/marketing/features/custom/feature-calendar.png?v=${FEATURE_SCREENSHOT_V}`,
    imageAltKey: 'marketing.features.highlight.calendar.imageAlt',
    mascotSrc: FEATURE_HIGHLIGHT_MASCOT_SRCS[1],
    mascotSize: 'compact',
  },
  {
    id: 'inventory',
    titleKey: 'marketing.features.highlight.inventory.title',
    bodyKey: 'marketing.features.highlight.inventory.body',
    imageSrc: `/marketing/features/custom/feature-inventory.png?v=${FEATURE_SCREENSHOT_V}`,
    imageAltKey: 'marketing.features.highlight.inventory.imageAlt',
    mascotSrc: FEATURE_HIGHLIGHT_MASCOT_SRCS[0],
    mascotSize: 'compact',
  },
  {
    id: 'payroll',
    titleKey: 'marketing.features.highlight.payroll.title',
    bodyKey: 'marketing.features.highlight.payroll.body',
    imageSrc: `/marketing/features/custom/feature-payroll.png?v=${FEATURE_SCREENSHOT_V}`,
    imageAltKey: 'marketing.features.highlight.payroll.imageAlt',
    mascotSrc: FEATURE_HIGHLIGHT_MASCOT_SRCS[3],
    /** Leo: bottom of main content card (past sidebar), larger than sidebar placement. */
    mascotAnchor: 'content-bottom-center',
  },
  {
    id: 'ath-movil',
    titleKey: 'marketing.features.highlight.ath.title',
    bodyKey: 'marketing.features.highlight.ath.body',
    imageSrc: `/marketing/features/custom/feature-ath-movil.png?v=${FEATURE_SCREENSHOT_V}`,
    imageAltKey: 'marketing.features.highlight.ath.imageAlt',
  },
];

function FlipFeatureCard({
  slide,
  flipped,
  onActivate,
}: {
  slide: FeatureSlide;
  flipped: boolean;
  onActivate: () => void;
}) {
  const { Icon, frontClass, titleKey, bodyKey } = slide;

  return (
    <div className="relative w-[min(200px,calc(100vw-2.5rem))] shrink-0 [aspect-ratio:200/280] perspective-[1000px] sm:w-[200px]">
      <button
        type="button"
        onClick={onActivate}
        aria-expanded={flipped}
        aria-label={t(titleKey)}
        className="group absolute inset-0 touch-manipulation rounded-2xl border-0 bg-transparent p-0 text-left shadow-md outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          <div
            className={`absolute inset-0 flex flex-col rounded-2xl p-3.5 text-white [backface-visibility:hidden] ${frontClass}`}
          >
            <h3 className="line-clamp-4 text-pretty break-words text-sm font-bold leading-snug tracking-tight drop-shadow-sm">
              {t(titleKey)}
            </h3>
            <div className="flex flex-1 items-center justify-center py-2">
              <Icon className="h-12 w-12 stroke-[1.35] opacity-95 drop-shadow-md sm:h-14 sm:w-14" aria-hidden />
            </div>
            <span
              className="pointer-events-none absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md ring-2 ring-white/25"
              aria-hidden
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </span>
          </div>

          <div
            className="absolute inset-0 flex flex-col rounded-2xl border border-border bg-card p-3.5 text-card-foreground shadow-inner [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <h3 className="line-clamp-3 text-pretty break-words text-sm font-bold text-primary">{t(titleKey)}</h3>
            <p className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-y-contain border-l-2 border-primary/25 pl-2.5 text-xs leading-relaxed text-muted-foreground [-webkit-overflow-scrolling:touch]">
              {t(bodyKey)}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

function HighlightFeaturePanel({ feature }: { feature: HighlightFeature }) {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-[1.1fr_1fr] md:gap-5 md:items-start">
      <div className="min-w-0 rounded-2xl border border-border/70 bg-[#F1F5F9] p-1.5 shadow-sm sm:p-2 md:p-3">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[10px] border border-border/60 bg-white">
          <img
            src={feature.imageSrc}
            alt={t(feature.imageAltKey)}
            width={FEATURE_SCREENSHOT_HINT_W}
            height={FEATURE_SCREENSHOT_HINT_H}
            className="absolute inset-0 h-full w-full object-contain object-top"
            loading="lazy"
          />
          {feature.mascotSrc ? (
            <div
              className={cn(
                'pointer-events-none absolute z-[2]',
                feature.mascotAnchor === 'bottom-left' &&
                  'bottom-0 left-[12%] translate-y-[14px] h-[min(16vw,3.25rem)] w-[min(18vw,3.5rem)] sm:left-[16%] sm:translate-y-[18px] sm:h-28 sm:w-32 md:left-[19%] md:translate-y-[22px] md:h-32 md:w-36',
                feature.mascotAnchor === 'sidebar-bottom' &&
                  'bottom-[5%] left-[0.5%] h-[min(12vw,2.65rem)] w-[min(13vw,2.85rem)] sm:bottom-[6%] sm:left-[1%] sm:h-20 sm:w-20 md:bottom-[7%] md:left-[1.25%] md:h-24 md:w-24',
                feature.mascotAnchor === 'content-bottom-center' &&
                  'bottom-[0.5%] left-[1%] h-[min(20vw,5rem)] w-[min(22vw,5.5rem)] translate-y-[18px] sm:bottom-[1%] sm:left-[1.25%] sm:h-28 sm:w-32 sm:translate-y-[20px] md:bottom-[1.5%] md:left-[1.25%] md:h-32 md:w-36 md:translate-y-[22px]',
                (feature.mascotAnchor === undefined || feature.mascotAnchor === 'bottom-right') &&
                  (feature.mascotSize === 'compact'
                    ? 'bottom-0 right-0 h-[min(18vw,4.25rem)] w-[min(21vw,4.75rem)] sm:bottom-2 sm:right-2 sm:h-28 sm:w-32 sm:max-h-none sm:max-w-none md:h-32 md:w-36'
                    : 'bottom-0 right-0 h-[min(28vw,6.5rem)] w-[min(32vw,7.25rem)] sm:bottom-2 sm:right-2 sm:h-40 sm:w-44 sm:max-h-none sm:max-w-none md:h-44 md:w-48'),
              )}
            >
              <img
                src={feature.mascotSrc}
                alt=""
                width={800}
                height={800}
                className={cn(
                  'h-full w-full object-contain object-bottom drop-shadow-md',
                  (feature.mascotAnchor === 'bottom-left' || feature.mascotAnchor === 'sidebar-bottom') &&
                    'object-left',
                  feature.mascotAnchor === 'content-bottom-center' && 'object-left',
                )}
                aria-hidden
                decoding="async"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-center gap-3 rounded-2xl bg-muted/30 p-3 sm:gap-4 sm:p-4 md:p-6">
        <h3 className="text-balance text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
          {t(feature.titleKey)}
        </h3>
        <p className="min-w-0 text-sm leading-relaxed text-muted-foreground md:text-base">{t(feature.bodyKey)}</p>
      </div>
    </div>
  );
}

export function FeaturesMarketingSection() {
  useLanguage();
  const [flippedKey, setFlippedKey] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [activeFeatureId, setActiveFeatureId] = useState(HIGHLIGHT_FEATURES[0].id);
  const [highlightRotationEpoch, setHighlightRotationEpoch] = useState(0);
  /** Flip-card carousel: after any card click, stop auto-scroll for good (manual scroll only). */
  const [marqueeStoppedAfterCardClick, setMarqueeStoppedAfterCardClick] = useState(false);
  const [desktopHighlightDisplayId, setDesktopHighlightDisplayId] = useState(activeFeatureId);
  const [desktopHighlightFade, setDesktopHighlightFade] = useState(1);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const desktopMq = window.matchMedia('(min-width: 768px)');
    const runInterval = (): ReturnType<typeof setInterval> | undefined => {
      if (!desktopMq.matches) return undefined;
      return window.setInterval(() => {
        setActiveFeatureId((current) => {
          const idx = HIGHLIGHT_FEATURES.findIndex((f) => f.id === current);
          const safeIdx = idx === -1 ? 0 : idx;
          return HIGHLIGHT_FEATURES[(safeIdx + 1) % HIGHLIGHT_FEATURES.length].id;
        });
      }, 5000);
    };
    let timerId = runInterval();
    const onDesktopChange = () => {
      if (timerId !== undefined) window.clearInterval(timerId);
      timerId = runInterval();
    };
    desktopMq.addEventListener('change', onDesktopChange);
    return () => {
      desktopMq.removeEventListener('change', onDesktopChange);
      if (timerId !== undefined) window.clearInterval(timerId);
    };
  }, [prefersReducedMotion, highlightRotationEpoch]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDesktopHighlightDisplayId(activeFeatureId);
      setDesktopHighlightFade(1);
      return undefined;
    }
    if (activeFeatureId === desktopHighlightDisplayId) return undefined;
    setDesktopHighlightFade(0);
    const timeoutId = window.setTimeout(() => {
      setDesktopHighlightDisplayId(activeFeatureId);
      requestAnimationFrame(() => setDesktopHighlightFade(1));
    }, 160);
    return () => window.clearTimeout(timeoutId);
  }, [activeFeatureId, desktopHighlightDisplayId, prefersReducedMotion]);

  const loopSlides = prefersReducedMotion ? FEATURE_SLIDES : [...FEATURE_SLIDES, ...FEATURE_SLIDES];

  const handleCardActivate = useCallback((instanceKey: string) => {
    setMarqueeStoppedAfterCardClick(true);
    setFlippedKey((prev) => (prev === instanceKey ? null : instanceKey));
  }, []);

  const activeFeature = HIGHLIGHT_FEATURES.find((feature) => feature.id === activeFeatureId) ?? HIGHLIGHT_FEATURES[0];
  const desktopDisplayedFeature =
    HIGHLIGHT_FEATURES.find((feature) => feature.id === desktopHighlightDisplayId) ?? HIGHLIGHT_FEATURES[0];

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-primary/[0.07] via-background to-background">
      <FeaturesBrandBackdrop />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-border to-transparent"
        aria-hidden
      />
      <div className="relative z-[1] mx-auto max-w-6xl px-3 pb-14 pt-14 sm:px-4 md:pb-16 md:pt-16">
        <div className="relative rounded-3xl border border-border/60 bg-muted/15 px-3 py-6 shadow-sm sm:px-8 sm:py-10 md:px-10 md:py-12">
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[min(100vw,48rem)] -translate-x-1/2 rounded-full bg-[#D4FF00]/15 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t('marketing.features.heroTag')}
            </p>
            <h2 className="mx-auto max-w-3xl text-balance text-center text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-4xl">
              {t('marketing.features.heroTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('marketing.features.heroSubtitle')}
            </p>
          </div>

          <div className="relative mt-8 space-y-5">
            <div className="hidden md:block">
              <div className="mx-auto w-full max-w-5xl rounded-full border border-border/70 bg-background/80 p-2">
                <div className="flex flex-wrap justify-center gap-2">
                  {HIGHLIGHT_FEATURES.map((feature) => (
                    <button
                      key={feature.id}
                      type="button"
                      onClick={() => {
                        setActiveFeatureId(feature.id);
                        setHighlightRotationEpoch((n) => n + 1);
                      }}
                      className={cn(
                        'min-h-11 touch-manipulation rounded-full px-4 py-2 text-center text-sm font-semibold leading-snug tracking-wide transition-colors',
                        activeFeature.id === feature.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-background text-foreground hover:bg-muted',
                      )}
                      aria-pressed={activeFeature.id === feature.id}
                    >
                      <span className="block text-pretty">{t(feature.titleKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden rounded-[1.25rem] border border-border/80 bg-card/85 p-3 sm:rounded-[1.5rem] sm:p-4 md:block md:p-6">
              <div
                className="min-w-0 [contain:layout] motion-reduce:transition-none"
                style={{
                  opacity: desktopHighlightFade,
                  transition: 'opacity 160ms ease-out',
                }}
              >
                <HighlightFeaturePanel feature={desktopDisplayedFeature} />
              </div>
            </div>

            <div className="md:hidden">
              <div
                className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 pb-2 pt-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="list"
                aria-label={t('marketing.features.heroTitle')}
              >
                {HIGHLIGHT_FEATURES.map((feature) => (
                  <article
                    key={feature.id}
                    role="listitem"
                    className="w-[min(100%,22rem)] shrink-0 snap-center snap-always sm:w-[24rem]"
                  >
                    <div className="rounded-[1.25rem] border border-border/80 bg-card/85 p-3">
                      <HighlightFeaturePanel feature={feature} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-10 md:mt-12">
          <div className="mb-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <PawPrint className="h-5 w-5 text-primary" aria-hidden />
            <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-primary">
              {t('marketing.features.carouselEyebrow')}
            </p>
          </div>

          <div
            className={cn(
              'features-marquee-container pb-3 pt-1',
              prefersReducedMotion || marqueeStoppedAfterCardClick
                ? 'overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                : 'overflow-hidden',
            )}
            aria-label={t('marketing.features.heroTitle')}
          >
            <div
              className={cn(
                'flex w-max gap-3',
                !prefersReducedMotion &&
                  !marqueeStoppedAfterCardClick &&
                  'animate-features-marquee',
              )}
            >
              {loopSlides.map((slide, index) => {
                const instanceKey = `${slide.id}-${index}`;
                return (
                  <FlipFeatureCard
                    key={instanceKey}
                    slide={slide}
                    flipped={flippedKey === instanceKey}
                    onActivate={() => handleCardActivate(instanceKey)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
