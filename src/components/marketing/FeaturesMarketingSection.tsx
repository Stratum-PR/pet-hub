import type { ReactNode } from 'react';
import { FeaturesBrandBackdrop } from '@/components/marketing/MarketingBrandMotifs';
import { t } from '@/lib/translations';

type Tint = 'green' | 'amber' | 'blue' | 'pink' | 'teal' | 'gray';

const tintStyles: Record<
  Tint,
  { card: string; tag: string; icon: string; mockBorder: string; mockBg: string }
> = {
  green: {
    card: 'border-[#eaf3de]/80 bg-card/90 dark:bg-card/40',
    tag: 'bg-[#eaf3de] text-[#3b6d11]',
    icon: 'bg-[#eaf3de] text-[#3b6d11]',
    mockBorder: 'border-[#eaf3de]',
    mockBg: 'bg-[#f8fcf4]',
  },
  amber: {
    card: 'border-[#faeeda]/80 bg-card/90 dark:bg-card/40',
    tag: 'bg-[#faeeda] text-[#854f0b]',
    icon: 'bg-[#faeeda] text-[#854f0b]',
    mockBorder: 'border-[#faeeda]',
    mockBg: 'bg-[#fffbf6]',
  },
  blue: {
    card: 'border-[#e8f0fb]/80 bg-card/90 dark:bg-card/40',
    tag: 'bg-[#e8f0fb] text-[#185fa5]',
    icon: 'bg-[#e8f0fb] text-[#185fa5]',
    mockBorder: 'border-[#e8f0fb]',
    mockBg: 'bg-[#f8fbff]',
  },
  pink: {
    card: 'border-[#fbeaf0]/80 bg-card/90 dark:bg-card/40',
    tag: 'bg-[#fbeaf0] text-[#993556]',
    icon: 'bg-[#fbeaf0] text-[#993556]',
    mockBorder: 'border-[#fbeaf0]',
    mockBg: 'bg-[#fffafc]',
  },
  teal: {
    card: 'border-[#e1f5ee]/80 bg-card/90 dark:bg-card/40',
    tag: 'bg-[#e1f5ee] text-[#0f6e56]',
    icon: 'bg-[#e1f5ee] text-[#0f6e56]',
    mockBorder: 'border-[#e1f5ee]',
    mockBg: 'bg-[#f6fdfb]',
  },
  gray: {
    card: 'border-[#f1efeb]/80 bg-card/90 dark:bg-card/40',
    tag: 'bg-[#f1efeb] text-[#5f5e5a]',
    icon: 'bg-[#f1efeb] text-[#5f5e5a]',
    mockBorder: 'border-[#f1efeb]',
    mockBg: 'bg-[#faf9f7]',
  },
};

const ILLUSTRATIONS = {
  appointments: '/marketing/features/feature-appointments.svg',
  staff: '/marketing/features/feature-staff.svg',
  reminders: '/marketing/features/feature-reminders.svg',
  clients: '/marketing/features/feature-clients.svg',
  dashboard: '/marketing/features/feature-dashboard.svg',
  inventory: '/marketing/features/feature-inventory.svg',
} as const;

function TagPill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function FeatureIllustration({
  src,
  altKey,
  frameClass,
}: {
  src: string;
  altKey: string;
  frameClass: string;
}) {
  return (
    <div className={`rounded-xl overflow-hidden border shadow-inner ${frameClass}`}>
      <img
        src={src}
        alt={t(altKey)}
        className="w-full h-auto object-cover aspect-[400/220]"
        width={400}
        height={220}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

function FeatureCard({
  tint,
  titleKey,
  bodyKey,
  tagKeys,
  iconLetter,
  illustrationSrc,
  imageAltKey,
}: {
  tint: Tint;
  titleKey: string;
  bodyKey: string;
  tagKeys: string[];
  iconLetter: string;
  illustrationSrc: string;
  imageAltKey: string;
}) {
  const s = tintStyles[tint];
  return (
    <article
      className={`rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${s.card} p-5 flex flex-col gap-3 h-full`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${s.icon}`}
          aria-hidden
        >
          {iconLetter}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-foreground tracking-tight">{t(titleKey)}</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t(bodyKey)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {tagKeys.map((k) => (
          <TagPill key={k} className={s.tag}>
            {t(k)}
          </TagPill>
        ))}
      </div>
      <div className="mt-auto pt-1">
        <FeatureIllustration src={illustrationSrc} altKey={imageAltKey} frameClass={`${s.mockBorder} ${s.mockBg}`} />
      </div>
    </article>
  );
}

export function FeaturesMarketingSection() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-primary/[0.07] via-background to-background">
      <FeaturesBrandBackdrop />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent z-[1]"
        aria-hidden
      />
      <div className="relative z-[1] max-w-6xl mx-auto px-4 pt-16 pb-14 md:pb-16">
        <div className="relative rounded-3xl border border-border/60 bg-muted/15 px-5 py-10 sm:px-8 sm:py-12 md:px-12 md:py-14 shadow-sm">
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[min(100vw,48rem)] -translate-x-1/2 rounded-full bg-[#D4FF00]/15 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              {t('marketing.features.heroTag')}
            </p>
            <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight max-w-3xl mx-auto">
              {t('marketing.features.heroTitle')}
            </h2>
            <p className="text-center text-muted-foreground mt-3 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              {t('marketing.features.heroSubtitle')}
            </p>
          </div>
        </div>

        <div className="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <FeatureCard
            tint="green"
            titleKey="marketing.features.c1.title"
            bodyKey="marketing.features.c1.body"
            tagKeys={['marketing.features.c1.t1', 'marketing.features.c1.t2', 'marketing.features.c1.t3']}
            iconLetter="1"
            illustrationSrc={ILLUSTRATIONS.appointments}
            imageAltKey="marketing.features.c1.imageAlt"
          />
          <FeatureCard
            tint="amber"
            titleKey="marketing.features.c2.title"
            bodyKey="marketing.features.c2.body"
            tagKeys={[
              'marketing.features.c2.t1',
              'marketing.features.c2.t2',
              'marketing.features.c2.t3',
              'marketing.features.c2.t4',
            ]}
            iconLetter="2"
            illustrationSrc={ILLUSTRATIONS.staff}
            imageAltKey="marketing.features.c2.imageAlt"
          />
          <FeatureCard
            tint="blue"
            titleKey="marketing.features.c3.title"
            bodyKey="marketing.features.c3.body"
            tagKeys={['marketing.features.c3.t1', 'marketing.features.c3.t2', 'marketing.features.c3.t3']}
            iconLetter="3"
            illustrationSrc={ILLUSTRATIONS.reminders}
            imageAltKey="marketing.features.c3.imageAlt"
          />
          <FeatureCard
            tint="pink"
            titleKey="marketing.features.c4.title"
            bodyKey="marketing.features.c4.body"
            tagKeys={['marketing.features.c4.t1', 'marketing.features.c4.t2', 'marketing.features.c4.t3']}
            iconLetter="4"
            illustrationSrc={ILLUSTRATIONS.clients}
            imageAltKey="marketing.features.c4.imageAlt"
          />
          <FeatureCard
            tint="teal"
            titleKey="marketing.features.c5.title"
            bodyKey="marketing.features.c5.body"
            tagKeys={['marketing.features.c5.t1', 'marketing.features.c5.t2', 'marketing.features.c5.t3']}
            iconLetter="5"
            illustrationSrc={ILLUSTRATIONS.dashboard}
            imageAltKey="marketing.features.c5.imageAlt"
          />
          <FeatureCard
            tint="gray"
            titleKey="marketing.features.c6.title"
            bodyKey="marketing.features.c6.body"
            tagKeys={['marketing.features.c6.t1', 'marketing.features.c6.t2', 'marketing.features.c6.t3']}
            iconLetter="6"
            illustrationSrc={ILLUSTRATIONS.inventory}
            imageAltKey="marketing.features.c6.imageAlt"
          />
        </div>
      </div>
    </div>
  );
}
