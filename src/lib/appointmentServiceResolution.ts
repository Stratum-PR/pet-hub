import { supabase } from '@/integrations/supabase/client';

export type CatalogServiceLite = { id: string; name: string; price?: number };

/**
 * Ensures each selected label exists in `services` (creates minimal rows for new names).
 * Returns the primary `service_id` (first selection) and a comma-separated `service_type` label.
 */
export async function ensureAppointmentServiceIds(
  businessId: string,
  selectedNamesInOrder: string[],
  catalog: CatalogServiceLite[]
): Promise<{ ok: true; primaryServiceId: string; serviceType: string } | { ok: false; error: string }> {
  const trimmed = selectedNamesInOrder.map((s) => s.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return { ok: false, error: 'At least one service is required.' };
  }
  const byName = new Map<string, CatalogServiceLite>(catalog.map((s) => [s.name.trim(), s]));
  const ids: string[] = [];
  for (const name of trimmed) {
    let row = byName.get(name);
    if (!row) {
      const { data, error } = await supabase
        .from('services')
        .insert({
          id: crypto.randomUUID(),
          business_id: businessId,
          name,
          description: null,
          price: 0,
          duration_minutes: 30,
        })
        .select('id, name')
        .single();
      if (error) return { ok: false, error: error.message };
      row = { id: data.id, name: data.name ?? name };
      byName.set(name, row);
    }
    ids.push(row.id);
  }
  return {
    ok: true,
    primaryServiceId: ids[0],
    serviceType: trimmed.join(', '),
    serviceIds: ids,
  };
}
