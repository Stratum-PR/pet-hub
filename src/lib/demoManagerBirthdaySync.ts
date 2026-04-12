import { supabase } from '@/integrations/supabase/client';
import { DEMO_WORKSPACE_BUSINESS_ID } from '@/lib/demoWorkspace';
import { devConsole } from '@/lib/clientDebug';

const DEMO_MANAGER_EMAIL = 'demo.manager@pethub.demo';

/** Clears the daily birthday-jobs flag so useNotifications will re-run RPC/fallbacks (e.g. after saving a staff DOB). */
export function clearPetHubBirthdayJobLocalKey(businessId: string | null | undefined): void {
  if (!businessId) return;
  const d = new Date();
  const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  try {
    localStorage.removeItem(`pet-hub-daily-birthday-jobs:${businessId}:${dayKey}`);
  } catch {
    /* ignore */
  }
}

/**
 * Aligns the demo workspace manager row with the viewer's local calendar date (month/day/year).
 * Runs at most once per local day from useNotifications; keeps Supabase in sync so birthday RPC matches "today".
 */
export async function syncDemoManagerBirthdayToClientToday(
  businessId: string | null | undefined
): Promise<{ ok: boolean; changed: boolean }> {
  if (!businessId || businessId !== DEMO_WORKSPACE_BUSINESS_ID) {
    return { ok: true, changed: false };
  }
  const n = new Date();
  const birth_month = n.getMonth() + 1;
  const birth_day = n.getDate();
  const birth_year = n.getFullYear() - 35;

  const { data: row, error: selErr } = await supabase
    .from('staff')
    .select('birth_month, birth_day, birth_year')
    .eq('business_id', businessId)
    .eq('email', DEMO_MANAGER_EMAIL)
    .maybeSingle();

  if (selErr) {
    devConsole.warn('[syncDemoManagerBirthdayToClientToday] select', selErr.message);
    return { ok: false, changed: false };
  }
  if (!row) return { ok: true, changed: false };

  const same =
    Number(row.birth_month) === birth_month &&
    Number(row.birth_day) === birth_day &&
    Number(row.birth_year) === birth_year;
  if (same) return { ok: true, changed: false };

  const { error: upErr } = await supabase
    .from('staff')
    .update({ birth_month, birth_day, birth_year } as Record<string, unknown>)
    .eq('business_id', businessId)
    .eq('email', DEMO_MANAGER_EMAIL);

  if (upErr) {
    devConsole.warn('[syncDemoManagerBirthdayToClientToday] update', upErr.message);
    return { ok: false, changed: false };
  }
  return { ok: true, changed: true };
}
