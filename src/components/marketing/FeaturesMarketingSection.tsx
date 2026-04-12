import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Package,
  PawPrint,
  Plus,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FeaturesBrandBackdrop } from './MarketingBrandMotifs';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

type FeatureSlide = {
  id: string;
  titleKey: string;
  bodyKey: string;
  Icon: LucideIcon;
  /** Deep gradients aligned with `index.css` (olive primary, clay, chart greens/teals, shell). */
  frontClass: string;
};

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    id: 'c1',
    titleKey: 'marketing.features.c1.title',
    bodyKey: 'marketing.features.c1.body',
    Icon: CalendarDays,
    frontClass:
      'bg-gradient-to-br from-[hsl(127_22%_38%)] to-[hsl(127_28%_26%)] dark:from-[hsl(127_26%_46%)] dark:to-[hsl(127_30%_30%)]',
  },
  {
    id: 'c2',
    titleKey: 'marketing.features.c2.title',
    bodyKey: 'marketing.features.c2.body',
    Icon: Users,
    frontClass:
      'bg-gradient-to-br from-[hsl(25_32%_40%)] to-[hsl(25_36%_28%)] dark:from-[hsl(25_28%_48%)] dark:to-[hsl(25_32%_34%)]',
  },
  {
    id: 'c3',
    titleKey: 'marketing.features.c3.title',
    bodyKey: 'marketing.features.c3.body',
    Icon: Bell,
    frontClass:
      'bg-gradient-to-br from-[hsl(145_32%_34%)] to-[hsl(145_38%_24%)] dark:from-[hsl(145_28%_42%)] dark:to-[hsl(145_34%_28%)]',
  },
  {
    id: 'c4',
    titleKey: 'marketing.features.c4.title',
    bodyKey: 'marketing.features.c4.body',
    Icon: PawPrint,
    frontClass:
      'bg-gradient-to-br from-[hsl(180_30%_34%)] to-[hsl(195_34%_24%)] dark:from-[hsl(180_26%_42%)] dark:to-[hsl(195_30%_30%)]',
  },
  {
    id: 'c5',
    titleKey: 'marketing.features.c5.title',
    bodyKey: 'marketing.features.c5.body',
    Icon: LayoutDashboard,
    frontClass:
      'bg-gradient-to-br from-[hsl(200_26%_30%)] to-[hsl(200_30%_16%)] dark:from-[hsl(200_22%_38%)] dark:to-[hsl(200_26%_22%)]',
  },
  {
    id: 'c6',
    titleKey: 'marketing.features.c6.title',
    bodyKey: 'marketing.features.c6.body',
    Icon: Package,
    frontClass:
      'bg-gradient-to-br from-[hsl(127_18%_30%)] to-[hsl(25_26%_32%)] dark:from-[hsl(127_22%_38%)] dark:to-[hsl(25_22%_36%)]',
  },
];

const CARD_W = 260;
const SCROLL_SPEED = 0.3;

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
    <div className="relative shrink-0 perspective-[1000px]" style={{ width: CARD_W, height: 340 }}>
      <button
        type="button"
        onClick={onActivate}
        aria-expanded={flipped}
        aria-label={t(titleKey)}
        className="group absolute inset-0 rounded-[1.35rem] border-0 bg-transparent p-0 text-left shadow-lg outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          <div
            className={`absolute inset-0 flex flex-col rounded-[1.35rem] p-5 text-white [backface-visibility:hidden] ${frontClass}`}
          >
            <h3 className="text-lg font-bold leading-snug tracking-tight drop-shadow-sm">{t(titleKey)}</h3>
            <div className="flex flex-1 items-center justify-center py-4">
              <Icon className="h-[4.5rem] w-[4.5rem] stroke-[1.35] opacity-95 drop-shadow-md" aria-hidden />
            </div>
            <span
              className="pointer-events-none absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md ring-2 ring-white/25"
              aria-hidden
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </span>
          </div>

          <div
            className="absolute inset-0 flex flex-col rounded-[1.35rem] border border-border bg-card p-5 text-card-foreground shadow-inner [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <h3 className="text-base font-bold text-primary">{t(titleKey)}</h3>
            <p className="mt-3 flex-1 overflow-y-auto border-l-2 border-primary/25 pl-3 text-sm leading-relaxed text-muted-foreground">
              {t(bodyKey)}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

export function FeaturesMarketingSection() {
  useLanguage();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const flippedKeyRef = useRef<string | null>(null);
  const [flippedKey, setFlippedKey] = useState<string | null>(null);
  flippedKeyRef.current = flippedKey;

  const loopSlides = [...FEATURE_SLIDES, ...FEATURE_SLIDES];

  useEffect(() => {
    if (flippedKey !== null) return;
    let alive = true;
    let raf = 0;
    const tick = () => {
      if (!alive) return;
      const el = scrollerRef.current;
      if (flippedKeyRef.current === null && el) {
        el.scrollLeft += SCROLL_SPEED;
        const half = el.scrollWidth / 2;
        if (half > 0 && el.scrollLeft >= half - 1) {
          el.scrollLeft = 0;
        }
      }
      if (alive) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [flippedKey]);

  const scrollCarousel = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    setFlippedKey(null);
    el.scrollBy({ left: direction * (CARD_W + 16), behavior: 'smooth' });
  }, []);

  const handleCardActivate = useCallback((instanceKey: string) => {
    setFlippedKey((prev) => (prev === instanceKey ? null : instanceKey));
  }, []);

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-primary/[0.07] via-background to-background">
      <FeaturesBrandBackdrop />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-border to-transparent"
        aria-hidden
      />
      <div className="relative z-[1] mx-auto max-w-6xl px-4 pb-14 pt-16 md:pb-16">
        <div className="relative rounded-3xl border border-border/60 bg-muted/15 px-5 py-10 shadow-sm sm:px-8 sm:py-12 md:px-12 md:py-14">
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[min(100vw,48rem)] -translate-x-1/2 rounded-full bg-[#D4FF00]/15 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t('marketing.features.heroTag')}
            </p>
            <h2 className="mx-auto max-w-3xl text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {t('marketing.features.heroTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('marketing.features.heroSubtitle')}
            </p>
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
            ref={scrollerRef}
            className="flex gap-4 overflow-x-auto pb-3 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollBehavior: 'auto' }}
            tabIndex={0}
            aria-label={t('marketing.features.heroTitle')}
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

          <div className="mt-4 flex justify-end gap-2 pr-1 sm:pr-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-border/80 bg-muted/50 text-foreground shadow-sm hover:bg-muted"
              aria-label={t('marketing.features.carouselPrev')}
              onClick={() => scrollCarousel(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-border/80 bg-muted/50 text-foreground shadow-sm hover:bg-muted"
              aria-label={t('marketing.features.carouselNext')}
              onClick={() => scrollCarousel(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
