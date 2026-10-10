import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  automationKeys,
  businessAutomationSettingsTable,
  useAutomations,
} from '@/lib/automations';
import { devConsole } from '@/lib/clientDebug';
import { t } from '@/lib/translations';

/**
 * Business settings: the platform's automatic client emails (set up by Grumi in the admin portal),
 * each on by default; a manager can switch any of them off for this business.
 */
export function ClientEmailAutomationsCard({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const automationsQuery = useAutomations();
  const settingsQuery = useQuery({
    queryKey: automationKeys.businessSettings(businessId),
    queryFn: async () => {
      const { data, error } = await businessAutomationSettingsTable()
        .select('automation_id, enabled')
        .eq('business_id', businessId);
      if (error) throw error;
      return new Map(((data ?? []) as unknown as { automation_id: string; enabled: boolean }[]).map((r) => [r.automation_id, r.enabled]));
    },
    retry: false,
  });

  const toggle = useMutation({
    mutationFn: async ({ automationId, enabled }: { automationId: string; enabled: boolean }) => {
      const { error } = await businessAutomationSettingsTable().upsert(
        { business_id: businessId, automation_id: automationId, enabled },
        { onConflict: 'business_id,automation_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationKeys.businessSettings(businessId) });
      toast.success(t('clientEmails.saved'));
    },
    onError: (e) => {
      devConsole.error('[ClientEmailAutomationsCard] toggle', e);
      toast.error(t('common.genericError'));
    },
  });

  const live = (automationsQuery.data ?? []).filter((a) => a.enabled);
  // Nothing to show until the platform has an active automation (or the tables aren't there yet).
  if (automationsQuery.isError || settingsQuery.isError || live.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('clientEmails.title')}</CardTitle>
        <CardDescription>{t('clientEmails.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {live.map((a) => {
          const on = settingsQuery.data?.get(a.id) ?? true;
          return (
            <div key={a.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">{t(`clientEmails.desc.${a.trigger_type}`)}</p>
              </div>
              <Switch
                checked={on}
                disabled={toggle.isPending || settingsQuery.isLoading}
                onCheckedChange={(enabled) => toggle.mutate({ automationId: a.id, enabled })}
                aria-label={a.name}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
