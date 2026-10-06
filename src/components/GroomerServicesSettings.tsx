import { useMemo, useState } from 'react';
import { Info, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/translations';
import type { Service } from '@/hooks/useBusinessData';
import type { Employee } from '@/types';
import type { StaffServiceRateRow } from '@/hooks/useStaffServiceRates';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { cn } from '@/lib/utils';

interface Props {
  employees: Employee[];
  services: Service[];
  rates: StaffServiceRateRow[];
  canEdit: boolean;
  onUpdateOffered: (staffId: string, offeredServiceIds: string[]) => Promise<boolean>;
  onSaveRate: (staffId: string, serviceId: string, price: number | null, duration: number | null) => Promise<boolean>;
}

function parseOptionalNumber(raw: string, { int }: { int?: boolean } = {}): number | null | 'invalid' {
  const v = raw.trim();
  if (v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 'invalid';
  return int ? Math.round(n) : Math.round(n * 100) / 100;
}

/**
 * Per-groomer service menu: which services each groomer does, and optional price / duration
 * overrides. Blank price or duration = use the service's default.
 */
export function GroomerServicesSettings({ employees, services, rates, canEdit, onUpdateOffered, onSaveRate }: Props) {
  const staff = useMemo(() => employees.filter((e) => e.status === 'active'), [employees]);
  const activeServices = useMemo(() => services.filter((s) => s.is_active !== false), [services]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = staff.find((e) => e.id === selectedId) ?? staff[0] ?? null;

  if (staff.length === 0 || activeServices.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {staff.length === 0 ? t('groomerSettings.noStaff') : t('groomerSettings.noServices')}
      </div>
    );
  }

  const offered = (e: Employee) => e.offered_service_ids ?? [];
  const offersAll = (e: Employee) => offered(e).length === 0;
  const offers = (e: Employee, serviceId: string) => offersAll(e) || offered(e).includes(serviceId);

  const toggle = async (e: Employee, serviceId: string, on: boolean) => {
    const base = offersAll(e) ? activeServices.map((s) => s.id) : offered(e);
    let next = on ? [...new Set([...base, serviceId])] : base.filter((id) => id !== serviceId);
    if (next.length === 0) {
      toast.error(t('groomerSettings.needOneService'));
      return;
    }
    // Every active service selected → store as "all" (empty list) so new services are included automatically.
    if (activeServices.every((s) => next.includes(s.id))) next = [];
    const ok = await onUpdateOffered(e.id, next);
    if (!ok) toast.error(t('groomerSettings.saveFailed'));
  };

  const saveRate = async (e: Employee, svc: Service, priceRaw: string, durRaw: string) => {
    const price = parseOptionalNumber(priceRaw);
    const dur = parseOptionalNumber(durRaw, { int: true });
    if (price === 'invalid' || dur === 'invalid' || (typeof dur === 'number' && (dur < 5 || dur > 720))) {
      toast.error(t('groomerSettings.invalidNumber'));
      return;
    }
    const existing = rates.find((r) => r.staff_id === e.id && r.service_id === svc.id);
    if ((existing?.price ?? null) === price && (existing?.duration_minutes ?? null) === dur) return;
    const ok = await onSaveRate(e.id, svc.id, price, dur);
    if (ok) toast.success(t('groomerSettings.saved'));
    else toast.error(t('groomerSettings.saveFailed'));
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{t('groomerSettings.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('groomerSettings.subtitle')}</p>
      </div>
      {!canEdit ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> {t('groomerSettings.readOnly')}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row">
        <nav className="flex gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible" aria-label={t('groomerSettings.groomers')}>
          {staff.map((e) => {
            const count = offersAll(e) ? activeServices.length : offered(e).length;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={cn(
                  'flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
                  current?.id === e.id ? 'bg-primary/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <span className="truncate">{formatStaffNameAggregated(e.name)}</span>
                <span className="text-xs tabular-nums">{count}</span>
              </button>
            );
          })}
        </nav>

        {current ? (
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[1fr_5.5rem_5.5rem_3rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>{t('groomerSettings.service')}</span>
              <span>{t('groomerSettings.price')}</span>
              <span>{t('groomerSettings.minutes')}</span>
              <span className="text-right">{t('groomerSettings.offers')}</span>
            </div>
            {activeServices.map((svc) => {
              const on = offers(current, svc.id);
              const rate = rates.find((r) => r.staff_id === current.id && r.service_id === svc.id);
              return (
                <ServiceRow
                  key={`${current.id}-${svc.id}-${rate?.price ?? ''}-${rate?.duration_minutes ?? ''}`}
                  svc={svc}
                  on={on}
                  canEdit={canEdit}
                  price={rate?.price ?? null}
                  duration={rate?.duration_minutes ?? null}
                  onToggle={(v) => void toggle(current, svc.id, v)}
                  onSave={(p, d) => void saveRate(current, svc, p, d)}
                />
              );
            })}
            <p className="flex items-start gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('groomerSettings.blankHint')}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ServiceRow({
  svc,
  on,
  canEdit,
  price,
  duration,
  onToggle,
  onSave,
}: {
  svc: Service;
  on: boolean;
  canEdit: boolean;
  price: number | null;
  duration: number | null;
  onToggle: (v: boolean) => void;
  onSave: (price: string, duration: string) => void;
}) {
  const [p, setP] = useState(price == null ? '' : String(price));
  const [d, setD] = useState(duration == null ? '' : String(duration));
  const disabled = !canEdit || !on;
  return (
    <div className={cn('grid grid-cols-[1fr_5.5rem_5.5rem_3rem] items-center gap-2 border-b px-3 py-2 last:border-b-0', !on && 'opacity-55')}>
      <span className="truncate text-sm font-medium" title={svc.name}>
        {svc.name}
      </span>
      <Input
        className="h-8 text-sm tabular-nums"
        inputMode="decimal"
        placeholder={`$${Number(svc.price).toFixed(0)}`}
        aria-label={`${svc.name} – price`}
        value={p}
        disabled={disabled}
        onChange={(e) => setP(e.target.value)}
        onBlur={() => onSave(p, d)}
      />
      <Input
        className="h-8 text-sm tabular-nums"
        inputMode="numeric"
        placeholder={String(svc.duration_minutes)}
        aria-label={`${svc.name} – minutes`}
        value={d}
        disabled={disabled}
        onChange={(e) => setD(e.target.value.replace(/\D/g, ''))}
        onBlur={() => onSave(p, d)}
      />
      <div className="flex justify-end">
        <Switch checked={on} disabled={!canEdit} onCheckedChange={onToggle} aria-label={svc.name} />
      </div>
    </div>
  );
}
