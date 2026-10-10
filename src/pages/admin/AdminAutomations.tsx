import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { ArrowRight, Cake, Eye, Loader2, Mail, Pencil, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdminBusinesses } from '@/lib/adminData';
import {
  PLACEHOLDERS,
  SAMPLE_VALUES,
  automationKeys,
  automationsTable,
  invokeAutomations,
  renderTemplate,
  useAutomationRuns,
  useAutomations,
  type Automation,
  type PreviewItem,
} from '@/lib/automations';
import { devConsole } from '@/lib/clientDebug';
import { t } from '@/lib/translations';

export function AdminAutomations() {
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? esLocale : enUS;
  const queryClient = useQueryClient();
  const automationsQuery = useAutomations();
  const runsQuery = useAutomationRuns();
  const businessesQuery = useAdminBusinesses();
  const [editing, setEditing] = useState<Automation | null>(null);
  const [preview, setPreview] = useState<{ automation: Automation; items: PreviewItem[] | null } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    if (automationsQuery.isError) toast.error(t('admin.automations.loadError'));
  }, [automationsQuery.isError]);

  const toggleMutation = useMutation({
    mutationFn: async (a: Automation) => {
      const { error } = await automationsTable().update({ enabled: !a.enabled }).eq('id', a.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: automationKeys.list }),
    onError: (e) => {
      devConsole.error('[automations] toggle', e);
      toast.error(t('common.genericError'));
    },
  });

  const openPreview = async (a: Automation) => {
    setPreview({ automation: a, items: null });
    try {
      const data = await invokeAutomations({ mode: 'preview', automation_id: a.id });
      setPreview({ automation: a, items: data.results?.[a.id]?.preview ?? [] });
    } catch {
      setPreview(null);
      toast.error(t('admin.automations.serverNotReady'));
    }
  };

  const sendTest = async (a: Automation) => {
    setTestingId(a.id);
    try {
      const data = await invokeAutomations({ mode: 'test', automation_id: a.id });
      toast.success(t('admin.automations.testSent', { email: data.sent_to ?? '' }));
      void queryClient.invalidateQueries({ queryKey: automationKeys.runs });
    } catch {
      toast.error(t('admin.automations.serverNotReady'));
    } finally {
      setTestingId(null);
    }
  };

  const businessName = (id: string | null) => businessesQuery.data?.find((b) => b.id === id)?.name ?? '—';
  const automationName = (id: string) => automationsQuery.data?.find((a) => a.id === id)?.name ?? '—';
  const automations = automationsQuery.data ?? [];

  return (
    <PawLoadedContent loading={automationsQuery.isLoading} loaderLabel={t('admin.loading')}>
      <div className="max-w-3xl space-y-6">
        <ul className="space-y-3">
          {automations.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{a.name}</p>
                    <label className="flex items-center gap-2 text-sm">
                      <span className={a.enabled ? 'font-medium' : 'text-muted-foreground'}>
                        {a.enabled ? t('admin.automations.on') : t('admin.automations.off')}
                      </span>
                      <Switch
                        checked={a.enabled}
                        disabled={toggleMutation.isPending}
                        onCheckedChange={() => toggleMutation.mutate(a)}
                        aria-label={a.name}
                      />
                    </label>
                  </div>

                  <RuleLine automation={a} />

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('admin.automations.edit')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void openPreview(a)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('admin.automations.whoToday')}
                    </Button>
                    <Button variant="outline" size="sm" disabled={testingId === a.id} onClick={() => void sendTest(a)}>
                      {testingId === a.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {t('admin.automations.sendTest')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('admin.automations.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            {(runsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.automations.noHistory')}</p>
            ) : (
              <ul className="divide-y text-sm">
                {(runsQuery.data ?? []).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="w-28 shrink-0 text-muted-foreground">
                      {format(new Date(r.created_at), 'PP', { locale: dateLocale })}
                    </span>
                    <span className="font-medium">{automationName(r.automation_id)}</span>
                    <span className="text-muted-foreground">
                      {r.status === 'test' ? t('admin.automations.testLabel') : businessName(r.business_id)}
                    </span>
                    <span className="min-w-0 break-all text-muted-foreground">{r.recipient}</span>
                    <Badge
                      variant={r.status === 'failed' ? 'destructive' : r.status === 'test' ? 'outline' : 'secondary'}
                      className="ml-auto"
                    >
                      {t(`admin.automations.status.${r.status}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {editing && (
        <AutomationEditor
          automation={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void queryClient.invalidateQueries({ queryKey: automationKeys.list });
          }}
        />
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.automations.whoToday')}</DialogTitle>
            <DialogDescription>{t('admin.automations.whoTodayDesc')}</DialogDescription>
          </DialogHeader>
          {preview?.items == null ? (
            <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
          ) : preview.items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t('admin.automations.nobodyToday')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {preview.items.map((i) => (
                <li key={`${i.business}-${i.pet}-${i.email}`} className="flex flex-wrap gap-x-3 py-2">
                  <span className="font-medium">{i.pet}</span>
                  <span>{i.owner}</span>
                  <span className="break-all text-muted-foreground">{i.email}</span>
                  <span className="ml-auto text-muted-foreground">{i.business}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </PawLoadedContent>
  );
}

/** Trello-style "When … → Then …" line. */
function RuleLine({ automation }: { automation: Automation }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.automations.when')}</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
        <Cake className="h-4 w-4" aria-hidden />
        {t(`admin.automations.trigger.${automation.trigger_type}`)}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.automations.then')}</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
        <Mail className="h-4 w-4" aria-hidden />
        {t(`admin.automations.action.${automation.action_type}`)}
      </span>
    </div>
  );
}

function AutomationEditor({
  automation,
  onClose,
  onSaved,
}: {
  automation: Automation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(automation.name);
  const [subject, setSubject] = useState(automation.action_config?.subject ?? '');
  const [body, setBody] = useState(automation.action_config?.body ?? '');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<'subject' | 'body'>('body');

  /** Insert a {{field}} where the cursor is, in whichever box was used last. */
  const insertField = (field: string) => {
    const token = `{{${field}}}`;
    if (lastFocused.current === 'subject') {
      const el = subjectRef.current;
      const start = el?.selectionStart ?? subject.length;
      const end = el?.selectionEnd ?? subject.length;
      setSubject(subject.slice(0, start) + token + subject.slice(end));
      requestAnimationFrame(() => el?.focus());
      return;
    }
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await automationsTable()
      .update({ name: name.trim() || automation.name, action_config: { ...automation.action_config, subject, body } })
      .eq('id', automation.id);
    setSaving(false);
    if (error) {
      devConsole.error('[automations] save', error);
      toast.error(t('common.genericError'));
      return;
    }
    toast.success(t('admin.automations.saved'));
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('admin.automations.edit')}</DialogTitle>
          <DialogDescription>{t('admin.automations.editorDesc')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="automation-name">{t('admin.automations.name')}</Label>
              <Input id="automation-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1 rounded-lg border p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.automations.when')}</p>
              <p className="font-medium">{t(`admin.automations.trigger.${automation.trigger_type}`)}</p>
              <p className="text-muted-foreground">{t(`admin.automations.triggerHelp.${automation.trigger_type}`)}</p>
            </div>
            <div className="space-y-1 rounded-lg border p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.automations.then')}</p>
              <p className="font-medium">{t(`admin.automations.action.${automation.action_type}`)}</p>
              <p className="text-muted-foreground">{t(`admin.automations.actionHelp.${automation.action_type}`)}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="automation-subject">{t('admin.automations.subject')}</Label>
              <Input
                id="automation-subject"
                ref={subjectRef}
                value={subject}
                onFocus={() => (lastFocused.current = 'subject')}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="automation-body">{t('admin.automations.message')}</Label>
              <Textarea
                id="automation-body"
                ref={bodyRef}
                value={body}
                rows={10}
                onFocus={() => (lastFocused.current = 'body')}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">{t('admin.automations.insertField')}</p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertField(p)}
                  >
                    {t(`admin.automations.field.${p}`)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('admin.automations.preview')}</p>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="mb-3 border-b pb-2 font-semibold">{renderTemplate(subject, SAMPLE_VALUES)}</p>
              <div className="whitespace-pre-wrap leading-relaxed">{renderTemplate(body, SAMPLE_VALUES)}</div>
            </div>
            <p className="text-xs text-muted-foreground">{t('admin.automations.previewNote')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('logout.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={saving || !subject.trim() || !body.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('admin.automations.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
