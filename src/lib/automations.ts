import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';

/** Admin-portal automations (trigger -> action), run daily by the run-automations Edge Function. */

export type TriggerType = 'pet_birthday';
export type ActionType = 'email_owner';

export type Automation = {
  id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  action_type: ActionType;
  action_config: { subject?: string; body?: string };
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type AutomationRun = {
  id: string;
  automation_id: string;
  business_id: string | null;
  pet_id: string | null;
  status: 'sent' | 'failed' | 'test';
  recipient: string | null;
  created_at: string;
};

export const TRIGGERS: TriggerType[] = ['pet_birthday'];
export const ACTIONS: ActionType[] = ['email_owner'];

/** Placeholders the email can use; keep in sync with supabase/functions/run-automations/logic.ts. */
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
  runs: ['automation_runs'] as const,
  businessSettings: (businessId: string) => ['business_automation_settings', businessId] as const,
};

/* The new tables aren't in the generated Supabase types yet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const automationsTable = () => supabase.from('automations' as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const automationRunsTable = () => supabase.from('automation_runs' as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const businessAutomationSettingsTable = () => supabase.from('business_automation_settings' as any);

export function useAutomations() {
  return useQuery({
    queryKey: automationKeys.list,
    queryFn: async () => {
      const { data, error } = await automationsTable().select('*').order('created_at', { ascending: true });
      if (error) {
        devConsole.error('[automations] list', error);
        throw error;
      }
      return (data ?? []) as unknown as Automation[];
    },
    retry: false,
  });
}

export function useAutomationRuns() {
  return useQuery({
    queryKey: automationKeys.runs,
    queryFn: async () => {
      const { data, error } = await automationRunsTable()
        .select('id, automation_id, business_id, pet_id, status, recipient, created_at')
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) {
        devConsole.error('[automations] runs', error);
        throw error;
      }
      return (data ?? []) as unknown as AutomationRun[];
    },
    retry: false,
  });
}

export type PreviewItem = { business: string; pet: string; owner: string; email: string };

/** Calls the run-automations function as the signed-in super admin. */
export async function invokeAutomations(body: { mode: 'preview' | 'test' | 'run'; automation_id?: string }) {
  const { data, error } = await supabase.functions.invoke('run-automations', { body });
  if (error) {
    devConsole.error('[automations] invoke', body.mode, error);
    throw error;
  }
  return data as {
    ok: boolean;
    sent_to?: string;
    results?: Record<string, { sent: number; failed: number; skipped_no_optin: number; already_sent: number; preview: PreviewItem[] }>;
  };
}
