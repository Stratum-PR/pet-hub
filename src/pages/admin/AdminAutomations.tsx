import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { ArrowRight, Eye, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { AutomationBuilderDialog } from '@/components/automations/AutomationBuilderDialog';
import { PreviewPanel } from '@/components/automations/BuilderParts';
import { actionText, emptyDraft, lang, timingText, toDraft, triggerText } from '@/components/automations/automationText';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdminBusinesses } from '@/lib/adminData';
import {
  automationKeys,
  automationsTable,
  invokeAutomations,
  useAutomationRuns,
  useAutomations,
  type Automation,
  type AutomationDraft,
  type AutomationOutcome,
} from '@/lib/automations';
import { devConsole } from '@/lib/clientDebug';
import { t } from '@/lib/translations';

/** Grumi's own automations (trial ending, past due, inactive businesses…), managed by super admins. */
export function AdminAutomations() {
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? esLocale : enUS;
  const queryClient = useQueryClient();
  const automationsQuery = useAutomations();
  const runsQuery = useAutomationRuns(null, 50);
  const businessesQuery = useAdminBusinesses();
  const [editing, setEditing] = useState<AutomationDraft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; outcome: AutomationOutcome | null } | null>(null);

  const automations = automationsQuery.data ?? [];
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: automationKeys.list });
    void queryClient.invalidateQueries({ queryKey: automationKeys.runs });
  };
  const businessName = (id: string | null) => businessesQuery.data?.find((b) => b.id === id)?.name ?? '—';
  const automationName = (id: string) => automations.find((a) => a.id === id)?.name ?? '—';

  const toggle = async (a: Automation) => {
    const { error } = await automationsTable().update({ enabled: !a.enabled }).eq('id', a.id);
    if (error) {
      devConsole.error('[admin automations] toggle', error);
      toast.error(t('common.genericError'));
    }
    refresh();
  };

  const remove = async (a: Automation) => {
    if (!window.confirm(t('auto.deleteConfirm'))) return;
    const { error } = await automationsTable().delete().eq('id', a.id);
    if (error) toast.error(t('common.genericError'));
    refresh();
  };

  const act = async (a: Automation, mode: 'preview' | 'test') => {
    setBusy(`${a.id}:${mode}`);
    if (mode === 'preview') setPreview({ name: a.name, outcome: null });
    try {
      const data = await invokeAutomations({ mode, automation_id: a.id, lang: lang() });
      if (mode === 'preview') setPreview({ name: a.name, outcome: data.results?.[a.id] ?? null });
      else toast.success(t('auto.testSent', { email: data.sent_to ?? '' }));
      refresh();
    } catch {
      if (mode === 'preview') setPreview(null);
      toast.error(t('auto.serverError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PawLoadedContent loading={automationsQuery.isLoading} loaderLabel={t('admin.loading')}>
      <div className="max-w-3xl space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setEditing(emptyDraft('platform', null))}>
            <Plus className="mr-2 h-4 w-4" />
            {t('auto.new')}
          </Button>
        </div>
        {automationsQuery.isError && <p className="text-sm text-destructive">{t('auto.loadError')}</p>}
        <ul className="space-y-3">
          {automations.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{a.name}</p>
                    <label className="flex items-center gap-2 text-sm">
                      <span className={a.enabled ? 'font-medium' : 'text-muted-foreground'}>{a.enabled ? t('auto.on') : t('auto.off')}</span>
                      <Switch checked={a.enabled} onCheckedChange={() => void toggle(a)} aria-label={a.name} />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">{triggerText(a)}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">{actionText(a)}</Badge>
                    <span className="text-xs text-muted-foreground">{timingText(a)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(toDraft(a))}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('auto.edit')}
                    </Button>
                    <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void act(a, 'preview')}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('auto.preview')}
                    </Button>
                    <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void act(a, 'test')}>
                      {busy === `${a.id}:test` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {t('auto.sendTest')}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(a)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('auto.delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('auto.tabs.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            {(runsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('auto.history.empty')}</p>
            ) : (
              <ul className="divide-y text-sm">
                {(runsQuery.data ?? []).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="w-28 shrink-0 text-muted-foreground">{format(new Date(r.created_at), 'PP', { locale: dateLocale })}</span>
                    <span className="font-medium">{automationName(r.automation_id)}</span>
                    <span className="text-muted-foreground">{businessName(r.business_id)}</span>
                    <span className="min-w-0 break-all text-muted-foreground">{r.recipient}</span>
                    <Badge variant={r.status === 'failed' ? 'destructive' : r.status === 'test' ? 'outline' : 'secondary'} className="ml-auto">
                      {t(`auto.run.${r.status}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {editing && (
        <AutomationBuilderDialog
          scope="platform"
          businessId={null}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>{t('auto.preview')}</DialogDescription>
          </DialogHeader>
          {preview?.outcome == null ? <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" /> : <PreviewPanel outcome={preview.outcome} />}
        </DialogContent>
      </Dialog>
    </PawLoadedContent>
  );
}
