import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';
import type {
  ActionConfig,
  ActionType,
  Condition,
  Schedule,
  TriggerType,
} from '../../supabase/functions/run-automations/catalog.ts';

export * from '../../supabase/functions/run-automations/catalog.ts';

/**
 * Automations (trigger -> conditions -> action), run by the run-automations Edge Function.
 * business_id = null: Grumi's own (admin portal); otherwise a business's.
 */
export type Automation = {
  id: string;
  name: string;
  business_id: string | null;
  template_key: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, number | string>;
  action_type: ActionType;
  action_config: ActionConfig;
  conditions: Condition[];
  schedule: Schedule;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationDraft = Omit<Automation, 'id' | 'created_at' | 'updated_at' | 'last_run_at'> & { id?: string };

export type AutomationRun = {
  id: string;
  automation_id: string;
  business_id: string | null;
  pet_id: string | null;
  client_id: string | null;
  status: 'sent' | 'failed' | 'test' | 'skipped';
  recipient: string | null;
  detail: string | null;
  created_at: string;
};

/** First automation's placeholders (admin editor back-compat). */
export const PLACEHOLDERS = ['pet_name', 'owner_first_name', 'owner_name', 'business_name', 'pet_age'] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export const SAMPLE_VALUES: Record<Placeholder, string> = {
  pet_name: 'Luna',
  owner_first_name: 'Ana',
  owner_name: 'Ana Rivera',
  business_name: 'Pawsome Grooming',
  pet_age: '3',
};

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key: string) => (key in values ? values[key] : m));
}

export const automationKeys = {
  list: ['automations'] as const,
  business: (businessId: string) => ['automations', 'business', businessId] as const,
  runs: ['automation_runs'] as const,
  businessRuns: (businessId: string) => ['automation_runs', 'business', businessId] as const,
  businessSettings: (businessId: string) => ['business_automation_settings', businessId] as const,
  capabilities: ['automation_capabilities'] as const,
};

/* The new tables aren't in the generated Supabase types yet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const automationsTable = () => supabase.from('automations' as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const automationRunsTable = () => supabase.from('automation_runs' as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const businessAutomationSettingsTable = () => supabase.from('business_automation_settings' as any);

const AUTOMATION_COLUMNS =
  'id, name, business_id, template_key, trigger_type, trigger_config, action_type, action_config, conditions, schedule, enabled, last_run_at, created_at, updated_at';
const LEGACY_COLUMNS = 'id, name, trigger_type, trigger_config, action_type, action_config, enabled, created_at, updated_at';

function normalize(row: Record<string, unknown>): Automation {
  return {
    business_id: null,
    template_key: null,
    conditions: [],
    schedule: {},
    last_run_at: null,
    ...(row as object),
    trigger_config: (row.trigger_config as Automation['trigger_config']) ?? {},
    action_config: (row.action_config as Automation['action_config']) ?? {},
  } as Automation;
}

/** Grumi's own automations (business_id is null). Works before and after the v2 migration. */
export function useAutomations() {
  return useQuery({
    queryKey: automationKeys.list,
    queryFn: async () => {
      let res = await automationsTable().select(AUTOMATION_COLUMNS).is('business_id', null).order('created_at', { ascending: true });
      if (res.error) {
        // Before the v2 migration there is no business_id column: every row is Grumi's.
        res = await automationsTable().select(LEGACY_COLUMNS).order('created_at', { ascending: true });
      }
      if (res.error) {
        devConsole.error('[automations] list', res.error);
        throw res.error;
      }
      return ((res.data ?? []) as unknown as Record<string, unknown>[]).map(normalize);
    },
    retry: false,
  });
}

export function useBusinessAutomations(businessId: string | null) {
  return useQuery({
    queryKey: automationKeys.business(businessId ?? 'none'),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await automationsTable()
        .select(AUTOMATION_COLUMNS)
        .eq('business_id', businessId!)
        .order('created_at', { ascending: true });
      if (error) {
        devConsole.error('[automations] business list', error);
        throw error;
      }
      return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalize);
    },
    retry: false,
  });
}

export function useAutomationRuns(businessId?: string | null, limit = 50) {
  return useQuery({
    queryKey: businessId ? automationKeys.businessRuns(businessId) : automationKeys.runs,
    queryFn: async () => {
      let q = automationRunsTable()
        .select('id, automation_id, business_id, pet_id, client_id, status, recipient, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (businessId) q = q.eq('business_id', businessId);
      const { data, error } = await q;
      if (error) {
        devConsole.error('[automations] runs', error);
        throw error;
      }
      return (data ?? []) as unknown as AutomationRun[];
    },
    retry: false,
  });
}

/** Sent counts per automation over the last 30 days. */
export function useAutomationStats(businessId: string | null) {
  return useQuery({
    queryKey: ['automation_stats', businessId ?? 'none'],
    enabled: !!businessId,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [{ data: runs }, { data: coupons }] = await Promise.all([
        automationRunsTable().select('automation_id, status').eq('business_id', businessId!).gte('created_at', since).limit(10000),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from('coupons' as any).select('automation_id, status').eq('business_id', businessId!).not('automation_id', 'is', null).limit(10000),
      ]);
      const out = new Map<string, { sent: number; failed: number; issued: number; redeemed: number }>();
      const get = (id: string) => {
        const v = out.get(id) ?? { sent: 0, failed: 0, issued: 0, redeemed: 0 };
        out.set(id, v);
        return v;
      };
      for (const r of (runs ?? []) as unknown as { automation_id: string; status: string }[]) {
        if (r.status === 'sent') get(r.automation_id).sent += 1;
        if (r.status === 'failed') get(r.automation_id).failed += 1;
      }
      for (const c of (coupons ?? []) as unknown as { automation_id: string; status: string }[]) {
        get(c.automation_id).issued += 1;
        if (c.status === 'redeemed') get(c.automation_id).redeemed += 1;
      }
      return out;
    },
    retry: false,
  });
}

export type PreviewItem = { label: string; recipient: string; channel: string; note?: string };

export type AutomationOutcome = {
  sent: number;
  failed: number;
  skipped: number;
  already_sent: number;
  preview: PreviewItem[];
  report?: { columns: string[]; headers: Record<string, string>; rows: Record<string, string | number | null>[]; total: number };
  detail?: string;
};

type InvokeBody =
  | { mode: 'preview' | 'test' | 'run'; automation_id: string; lang?: 'es' | 'en' }
  | { mode: 'preview' | 'test'; draft: Partial<AutomationDraft>; lang?: 'es' | 'en' }
  | { mode: 'capabilities' };

/** Calls the run-automations function as the signed-in user. */
export async function invokeAutomations(body: InvokeBody) {
  const { data, error } = await supabase.functions.invoke('run-automations', { body });
  if (error) {
    devConsole.error('[automations] invoke', body.mode, error);
    throw error;
  }
  return data as {
    ok: boolean;
    sent_to?: string;
    sms?: boolean;
    results?: Record<string, AutomationOutcome>;
  };
}

/** Whether SMS is set up on the server (texts fall back to email until then). */
export function useAutomationCapabilities() {
  return useQuery({
    queryKey: automationKeys.capabilities,
    queryFn: async () => {
      try {
        const data = await invokeAutomations({ mode: 'capabilities' });
        return { sms: !!data.sms };
      } catch {
        return { sms: false };
      }
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
}
