import type { ReactNode } from 'react';
import { Calendar, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { profileDialogPrimaryHeroInnerClassName } from '@/lib/profileDialogLayout';
import { cn } from '@/lib/utils';

export type ProfileHeroKpi = { label: string; value: ReactNode };

export type ProfileDialogPrimaryHeroProps = {
  avatar: ReactNode;
  title: string;
  subtitle?: ReactNode;
  kpis?: ProfileHeroKpi[];
  /** E.164 or raw digits — passed to tel: after stripping non-digits */
  contactTel?: string | null;
  contactEmail?: string | null;
  phoneAriaLabel?: string;
  emailAriaLabel?: string;
  /** Optional third quick action (e.g. calendar) */
  onCalendar?: () => void;
  calendarLabel?: string;
  children?: ReactNode;
};

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits ? `tel:${digits}` : null;
}

export function ProfileDialogPrimaryHero({
  avatar,
  title,
  subtitle,
  kpis,
  contactTel,
  contactEmail,
  phoneAriaLabel,
  emailAriaLabel,
  onCalendar,
  calendarLabel,
  children,
}: ProfileDialogPrimaryHeroProps) {
  const tel = contactTel ? telHref(contactTel) : null;

  return (
    <div className="shrink-0 bg-primary text-primary-foreground">
      <div className={profileDialogPrimaryHeroInnerClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {avatar}
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-primary-foreground">{title}</h2>
              {subtitle != null && subtitle !== '' ? (
                <div className="mt-0.5 text-sm text-primary-foreground/80">{subtitle}</div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {tel ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-primary-foreground hover:bg-primary-foreground/15"
                asChild
              >
                <a href={tel} aria-label={phoneAriaLabel ?? 'Phone'}>
                  <Phone className="h-5 w-5" />
                </a>
              </Button>
            ) : null}
            {contactEmail ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-primary-foreground hover:bg-primary-foreground/15"
                asChild
              >
                <a href={`mailto:${contactEmail}`} aria-label={emailAriaLabel ?? 'Email'}>
                  <Mail className="h-5 w-5" />
                </a>
              </Button>
            ) : null}
            {onCalendar ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-primary-foreground hover:bg-primary-foreground/15"
                aria-label={calendarLabel ?? 'Calendar'}
                onClick={onCalendar}
              >
                <Calendar className="h-5 w-5" />
              </Button>
            ) : null}
          </div>
        </div>

        {kpis && kpis.length > 0 ? (
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-primary-foreground/15 pt-4">
            {kpis.map((k) => (
              <div key={k.label} className="min-w-0 text-center sm:text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">{k.label}</p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-primary-foreground">{k.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {children ? (
          <div
            className={cn(
              'border-t border-primary-foreground/15',
              kpis?.length ? 'mt-4 pt-3' : 'mt-5 pt-4',
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
