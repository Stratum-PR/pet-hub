import { useMemo, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import type { Service } from '@/hooks/useBusinessData';
import type { Employee } from '@/types';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { cn } from '@/lib/utils';

interface Props {
  employees: Employee[];
  services: Service[];
  canEdit: boolean;
  onUpdateOffered: (staffId: string, offeredServiceIds: string[]) => Promise<boolean>;
}

/**
 * Which services each groomer does: a plain checklist per groomer.
 * Price and duration always come from the service itself (set in Services).
 */
export function GroomerServicesSettings({ employees, services, canEdit, onUpdateOffered }: Props) {
  const staff = useMemo(() => employees.filter((e) => e.status === 'active'), [employees]);
  const activeServices = useMemo(() => services.filter((s) => s.is_active !== false), [services]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const current = staff.find((e) => e.id === selectedId) ?? staff[0] ?? null;

  if (staff.length === 0 || activeServices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {staff.length === 0 ? t('groomerSettings.noStaff') : t('groomerSettings.noServices')}
      </p>
    );
  }

  const offered = (e: Employee) => e.offered_service_ids ?? [];
  const offersAll = (e: Employee) => offered(e).length === 0;
  const offers = (e: Employee, serviceId: string) => offersAll(e) || offered(e).includes(serviceId);
  const offeredCount = (e: Employee) => activeServices.filter((s) => offers(e, s.id)).length;

  const toggle = async (e: Employee, serviceId: string) => {
    const on = !offers(e, serviceId);
    const base = offersAll(e) ? activeServices.map((s) => s.id) : offered(e);
    let next = on ? [...new Set([...base, serviceId])] : base.filter((id) => id !== serviceId);
    if (next.length === 0) {
      toast.error(t('groomerSettings.needOneService'));
      return;
    }
    // Every active service selected → store as "all" (empty list) so new services are included automatically.
    if (activeServices.every((s) => next.includes(s.id))) next = [];
    setSaving(serviceId);
    const ok = await onUpdateOffered(e.id, next);
    setSaving(null);
    if (!ok) toast.error(t('groomerSettings.saveFailed'));
  };

  return (
    <div className="flex flex-col gap-3">
      {!canEdit ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> {t('groomerSettings.readOnly')}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[14rem_minmax(0,1fr)]">
        {/* Groomers */}
        <div className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {staff.map((e) => {
            const active = current?.id === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={cn(
                  'flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active ? 'bg-primary/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <span className="truncate">{formatStaffNameAggregated(e.name)}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {offeredCount(e)}/{activeServices.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Services checklist */}
        {current ? (
          <div className="rounded-lg border bg-card">
            <ul className="divide-y">
              {activeServices.map((s) => {
                const on = offers(current, s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!canEdit || saving === s.id}
                      onClick={() => void toggle(current, s.id)}
                      aria-pressed={on}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                        )}
                      >
                        {on ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? '#7DD3FC' }} />
                      <span className={cn('min-w-0 flex-1 truncate', !on && 'text-muted-foreground')}>{s.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
