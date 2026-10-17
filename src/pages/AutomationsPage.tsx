import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { ArrowRight, Copy, Eye, Gift, Loader2, Pencil, Play, Plus, Send, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AutomationBuilderDialog } from '@/components/automations/AutomationBuilderDialog';
import { CouponsPanel } from '@/components/automations/CouponsPanel';
import { PreviewPanel } from '@/components/automations/BuilderParts';
import {
  actionText,
  draftFromTemplate,
  emptyDraft,
  lang,
  templateName,
  timingText,
  toDraft,
  triggerText,
} from '@/components/automations/automationText';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useCanManageAutomations } from '@/hooks/useCanManageAutomations';
import { useClients, useEmployees, useServices } from '@/hooks/useSupabaseData';
import { useInventory } from '@/hooks/useInventory';
import {
  automationKeys,
  automationsTable,
  invokeAutomations,
  TEMPLATES,
  useAutomationRuns,
  useAutomationStats,
  useBusinessAutomations,
  type Automation,
  type AutomationDraft,
  type AutomationOutcome,
} from '@/lib/automations';
import { devConsole } from '@/lib/clientDebug';
import { t } from '@/lib/translations';

export function AutomationsPage() {
  const businessId = useBusinessId();
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? esLocale : enUS;
  const queryClient = useQueryClient();
  const { canManage, loading: permLoading } = useCanManageAutomations();
  const automationsQuery = useBusinessAutomations(businessId);
  const runsQuery = useAutomationRuns(businessId);
  const statsQuery = useAutomationStats(businessId);
  const { services } = useServices();
  const { employees } = useEmployees({ includeSensitive: false });
  const { products } = useInventory();
  const { clients } = useClients();
  const [tab, setTab] = useState('automations');
  const [editing, setEditing] = useState<AutomationDraft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; outcome: AutomationOutcome | null } | null>(null);

  const serviceOptions = useMemo(() => (services ?? []).map((s: { id: string; name: string }) => ({ id: String(s.id), name: s.name })), [services]);
  const staffOptions = useMemo(
    () => (employees ?? []).filter((e) => e.status !== 'inactive').map((e) => ({ id: String(e.id), name: e.name })),
    [employees],
  );
  const productOptions = useMemo(() => (products ?? []).map((p) => ({ id: String(p.id), name: p.name })), [products]);
  const clientOptions = useMemo(
    () =>
      (clients ?? []).map((c: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }) => ({
        id: String(c.id),
        name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email || '—',
      })),
    [clients],
  );

  const automations = automationsQuery.data ?? [];
  const refresh = () => {
    if (!businessId) return;
    void queryClient.invalidateQueries({ queryKey: automationKeys.business(businessId) });
    void queryClient.invalidateQueries({ queryKey: automationKeys.businessRuns(businessId) });
    void queryClient.invalidateQueries({ queryKey: ['automation_stats', businessId] });
  };

  const toggle = async (a: Automation) => {
    const { error } = await automationsTable().update({ enabled: !a.enabled }).eq('id', a.id);
    if (error) {
      devConsole.error('[automations] toggle', error);
      toast.error(t('common.genericError'));
    }
    refresh();
  };

  const remove = async (a: Automation) => {
    if (!window.confirm(t('auto.deleteConfirm'))) return;
    const { error } = await automationsTable().delete().eq('id', a.id);
    if (error) toast.error(t('common.genericError'));
    else toast.success(t('auto.deleted'));
    refresh();
  };

  const act = async (a: Automation, mode: 'preview' | 'test' | 'run') => {
    setBusyId(`${a.id}:${mode}`);
    if (mode === 'preview') setPreview({ name: a.name, outcome: null });
    try {
      const data = await invokeAutomations({ mode, automation_id: a.id, lang: lang() });
      const outcome = data.results?.[a.id] ?? null;
      if (mode === 'preview') setPreview({ name: a.name, outcome });
      if (mode === 'test') toast.success(t('auto.testSent', { email: data.sent_to ?? '' }));
      if (mode === 'run') toast.success(t('auto.ranNow', { sent: outcome?.sent ?? 0 }));
      refresh();
    } catch {
      if (mode === 'preview') setPreview(null);
      toast.error(t('auto.serverError'));
    } finally {
      setBusyId(null);
    }
  };

  if (!businessId) return null;

  return (
    <PawLoadedContent loading={automationsQuery.isLoading || permLoading} loaderLabel={t('auto.title')}>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Zap className="h-5 w-5 text-primary" />
              {t('auto.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('auto.subtitle')}</p>
          </div>
          {canManage && (
            <Button onClick={() => setEditing(emptyDraft('business', businessId))}>
              <Plus className="mr-2 h-4 w-4" />
              {t('auto.new')}
            </Button>
          )}
        </div>

        {!canManage && <p className="rounded-lg border bg-muted/40 p-4 text-sm">{t('auto.noPermission')}</p>}
        {automationsQuery.isError && <p className="rounded-lg border border-destructive/40 p-4 text-sm">{t('auto.loadError')}</p>}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="automations">{t('auto.tabs.automations')}</TabsTrigger>
            <TabsTrigger value="templates">{t('auto.tabs.templates')}</TabsTrigger>
            <TabsTrigger value="coupons">{t('auto.tabs.coupons')}</TabsTrigger>
            <TabsTrigger value="history">{t('auto.tabs.history')}</TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="space-y-3 pt-4">
            {automations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">{t('auto.empty')}</p>
                <Button variant="outline" className="mt-3" onClick={() => setTab('templates')}>
                  {t('auto.tabs.templates')}
                </Button>
              </div>
            ) : (
              automations.map((a) => {
                const s = statsQuery.data?.get(a.id);
                return (
                  <Card key={a.id}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{a.name}</p>
                        <label className="flex items-center gap-2 text-sm">
                          <span className={a.enabled ? 'font-medium' : 'text-muted-foreground'}>{a.enabled ? t('auto.on') : t('auto.off')}</span>
                          <Switch checked={a.enabled} disabled={!canManage} onCheckedChange={() => void toggle(a)} aria-label={a.name} />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary">{triggerText(a)}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary">{actionText(a)}</Badge>
                        {a.action_config?.coupon_offer_id && (
                          <Badge variant="outline">
                            <Gift className="mr-1 h-3 w-3" />
                            {t('auto.coupon.attach')}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{timingText(a)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('auto.stats', { sent: s?.sent ?? 0 })}
                        {s?.issued ? ` · ${t('auto.statsCoupons', { redeemed: s.redeemed, issued: s.issued })}` : ''}
                        {' · '}
                        {a.last_run_at ? t('auto.lastRun', { date: format(new Date(a.last_run_at), 'PPp', { locale: dateLocale }) }) : t('auto.never')}
                      </p>
                      {canManage && (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditing(toDraft(a))}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('auto.edit')}
                          </Button>
                          <Button variant="outline" size="sm" disabled={!!busyId} onClick={() => void act(a, 'preview')}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('auto.preview')}
                          </Button>
                          <Button variant="outline" size="sm" disabled={!!busyId} onClick={() => void act(a, 'test')}>
                            {busyId === `${a.id}:test` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            {t('auto.sendTest')}
                          </Button>
                          {a.enabled && (
                            <Button variant="outline" size="sm" disabled={!!busyId} onClick={() => void act(a, 'run')}>
                              {busyId === `${a.id}:run` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                              {t('auto.runNow')}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setEditing({ ...toDraft(a), id: undefined, name: `${a.name} (2)`, enabled: false })}>
                            <Copy className="mr-2 h-4 w-4" />
                            {t('auto.duplicate')}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(a)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('auto.delete')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">{t('auto.templatesIntro')}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((tpl) => (
                <Card key={tpl.key}>
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <p className="font-semibold">{templateName(tpl.key)}</p>
                    <p className="flex-1 text-sm text-muted-foreground">{t(`auto.template.${tpl.key}.desc`)}</p>
                    {tpl.suggestsCoupon && (
                      <Badge variant="outline" className="w-fit">
                        <Gift className="mr-1 h-3 w-3" />
                        {t('auto.giftSuggested')}
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" disabled={!canManage} onClick={() => setEditing(draftFromTemplate(tpl, businessId))}>
                      {t('auto.useTemplate')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="coupons" className="pt-4">
            <CouponsPanel businessId={businessId} canManage={canManage} services={serviceOptions} products={productOptions} clients={clientOptions} />
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            {(runsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('auto.history.empty')}</p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {(runsQuery.data ?? []).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <span className="w-40 shrink-0 text-muted-foreground">{format(new Date(r.created_at), 'PPp', { locale: dateLocale })}</span>
                    <span className="font-medium">{automations.find((a) => a.id === r.automation_id)?.name ?? '—'}</span>
                    <span className="min-w-0 break-all text-muted-foreground">{r.recipient}</span>
                    <Badge variant={r.status === 'failed' ? 'destructive' : r.status === 'test' ? 'outline' : 'secondary'} className="ml-auto">
                      {t(`auto.run.${r.status}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {editing && (
        <AutomationBuilderDialog
          scope="business"
          businessId={businessId}
          initial={editing}
          services={serviceOptions}
          staff={staffOptions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
          onManageCoupons={() => {
            setEditing(null);
            setTab('coupons');
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

export default AutomationsPage;
