import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { devConsole } from '@/lib/clientDebug';
import type { StaffServiceRate } from '@/lib/groomerAvailability';

export interface StaffServiceRateRow extends StaffServiceRate {
  id?: string;
  business_id?: string;
}

/**
 * Per-groomer price/duration overrides (table `staff_service_rates`).
 * A missing table (migration not applied yet) is treated as "no overrides" so the page still works.
 */
export function useStaffServiceRates() {
  const businessId = useBusinessId();
  const demoBrowseOnly = useDemoBrowseOnly();
  const [rates, setRates] = useState<StaffServiceRateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('staff_service_rates' as never)
      .select('id, business_id, staff_id, service_id, price, duration_minutes')
      .eq('business_id', businessId);
    if (error) {
      devConsole.warn('[useStaffServiceRates] fetch failed', error.message);
      setRates([]);
    } else {
      setRates(((data ?? []) as unknown as StaffServiceRateRow[]).map((r) => ({
        ...r,
        price: r.price == null ? null : Number(r.price),
        duration_minutes: r.duration_minutes == null ? null : Number(r.duration_minutes),
      })));
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    void fetchRates();
  }, [fetchRates]);

  /**
   * Set (or clear, when both values are null) a groomer's override for one service.
   * Returns false on failure.
   */
  const saveRate = useCallback(
    async (staffId: string, serviceId: string, price: number | null, duration: number | null): Promise<boolean> => {
      if (!businessId) return false;
      const clearing = price == null && duration == null;
      const apply = (prev: StaffServiceRateRow[]) => {
        const rest = prev.filter((r) => !(r.staff_id === staffId && r.service_id === serviceId));
        return clearing
          ? rest
          : [...rest, { business_id: businessId, staff_id: staffId, service_id: serviceId, price, duration_minutes: duration }];
      };
      if (demoBrowseOnly) {
        setRates(apply);
        return true;
      }
      const table = supabase.from('staff_service_rates' as never);
      const { error } = clearing
        ? await table.delete().eq('staff_id', staffId).eq('service_id', serviceId)
        : await table.upsert(
            { business_id: businessId, staff_id: staffId, service_id: serviceId, price, duration_minutes: duration } as never,
            { onConflict: 'staff_id,service_id' },
          );
      if (error) {
        devConsole.error('[useStaffServiceRates] save failed', error.message);
        return false;
      }
      setRates(apply);
      return true;
    },
    [businessId, demoBrowseOnly],
  );

  return { rates, loading, refetch: fetchRates, saveRate };
}
