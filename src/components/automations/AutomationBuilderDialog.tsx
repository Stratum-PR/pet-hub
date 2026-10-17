import { useMemo, useState } from 'react';
import { ArrowRight, Check, Eye, Gift, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { devConsole } from '@/lib/clientDebug';
import { useAuth } from '@/contexts/AuthContext';
import {
  actionSupportsCoupon,
  actionsForTrigger,
  APPOINTMENT_STATUSES,
  automationsTable,
  fillPlaceholders,
  invokeAutomations,
  isMarketingMessage,
  sourceDef,
  SAMPLE_PLACEHOLDER_VALUES,
  triggerDef,
  useAutomationCapabilities,
  type ActionType,
  type AutomationDraft,
  type AutomationOutcome,
  type TriggerType,
} from '@/lib/automations';
import { useCouponOffers } from '@/lib/coupons';
import { t } from '@/lib/translations';
import { ConditionsEditor, MessageEditor, PreviewPanel, RecipientsEditor, ReportEditor, TimingEditor } from './BuilderParts';
import { actionText, lang, offerLabel, timingText, triggerText } from './automationText';

const STEPS = ['trigger', 'conditions', 'action', 'review'] as const;
type Step = (typeof STEPS)[number];

const BUSINESS_GROUPS: { id: string; triggers: TriggerType[] }[] = [
  { id: 'schedule', triggers: ['schedule'] },
  { id: 'dates', triggers: ['pet_birthday', 'grooming_due', 'client_inactive', 'appointment_before', 'appointment_after'] },
  {
    id: 'events',
    triggers: ['appointment_status', 'booking_request', 'new_client', 'new_pet', 'sale_completed', 'refund_issued', 'payment_failed', 'low_stock'],
  },
  { id: 'team', triggers: ['off_schedule_clock_in', 'missed_clock_out', 'shift_change_request', 'time_edit_request', 'staff_birthday'] },
];
const PLATFORM_GROUPS: { id: string; triggers: TriggerType[] }[] = [
  { id: 'platform', triggers: ['trial_ending', 'subscription_past_due', 'business_inactive', 'onboarding_incomplete'] },
];

type Option = { id: string; name: string };

export function AutomationBuilderDialog({
  scope,
  businessId,
  initial,
  services = [],
  staff = [],
  onClose,
  onSaved,
  onManageCoupons,
}: {
  scope: 'business' | 'platform';
  businessId: string | null;
  initial: AutomationDraft;
  services?: Option[];
  staff?: Option[];
  onClose: () => void;
  onSaved: () => void;
  onManageCoupons?: () => void;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<AutomationDraft>(initial);
  const [step, setStep] = useState<Step>(initial.id || initial.template_key ? 'review' : 'trigger');
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [outcome, setOutcome] = useState<AutomationOutcome | null>(null);
  const capabilities = useAutomationCapabilities();
  const offersQuery = useCouponOffers(scope === 'business' ? businessId : null);
  const offers = (offersQuery.data ?? []).filter((o) => o.active);
  const def = triggerDef(draft.trigger_type)!;
  const allowedActions = actionsForTrigger(draft.trigger_type);
  const cfg = draft.action_config ?? {};
  const isMessage = draft.action_type === 'message_client' || draft.action_type === 'email_owner';
  const groups = scope === 'platform' ? PLATFORM_GROUPS : BUSINESS_GROUPS;

  const patch = (p: Partial<AutomationDraft>) => {
    setOutcome(null);
    setDraft((d) => ({ ...d, ...p }));
  };
  const patchConfig = (p: Partial<AutomationDraft['action_config']>) => patch({ action_config: { ...cfg, ...p } });

  const chooseTrigger = (type: TriggerType) => {
    const nd = triggerDef(type)!;
    const actions = actionsForTrigger(type);
    const action: ActionType = actions.includes(draft.action_type) ? draft.action_type : actions[0];
    patch({
      trigger_type: type,
      trigger_config: { ...nd.defaults } as AutomationDraft['trigger_config'],
      action_type: action,
      action_config:
        action === 'send_report'
          ? { recipients: { roles: ['manager'] }, report: cfg.report ?? { source: 'appointments', columns: sourceDef('appointments')!.defaultColumns } }
          : action === 'message_client'
            ? { channel: cfg.channel ?? 'preferred', subject: cfg.subject ?? '', body: cfg.body ?? '', sms_body: cfg.sms_body ?? '', coupon_offer_id: cfg.coupon_offer_id ?? null }
            : { ...cfg, recipients: cfg.recipients ?? { roles: ['manager'] } },
      conditions: draft.trigger_type === type ? draft.conditions : [],
      schedule: nd.kind === 'schedule' ? { frequency: 'daily', time: '08:00', ...draft.schedule } : { time: draft.schedule?.time ?? '09:00' },
    });
  };

  const stepValid = (s: Step): boolean => {
    if (s === 'action') {
      if (isMessage || draft.action_type === 'email_business') return !!(cfg.body ?? '').trim() || !!(cfg.sms_body ?? '').trim();
      if (draft.action_type === 'send_report') return !!cfg.report?.source && (cfg.report.columns?.length ?? 0) > 0;
      const r = cfg.recipients ?? {};
      return !!(r.roles?.length || r.emails?.length || r.assigned_staff || r.profile_ids?.length);
    }
    if (s === 'review') return !!draft.name.trim() && stepValid('action');
    return true;
  };

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const data = draft.id
        ? await invokeAutomations({ mode: 'preview', draft: { ...draft, id: undefined }, lang: lang() })
        : await invokeAutomations({ mode: 'preview', draft, lang: lang() });
      setOutcome(Object.values(data.results ?? {})[0] ?? null);
    } catch {
      toast.error(t('auto.serverError'));
    } finally {
      setPreviewing(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const data = await invokeAutomations({ mode: 'test', draft: { ...draft, id: undefined }, lang: lang() });
      toast.success(t('auto.testSent', { email: data.sent_to ?? '' }));
    } catch {
      toast.error(t('auto.serverError'));
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const row = {
      name: draft.name.trim(),
      business_id: scope === 'business' ? businessId : null,
      template_key: draft.template_key,
      trigger_type: draft.trigger_type,
      trigger_config: draft.trigger_config ?? {},
      action_type: draft.action_type,
      action_config: draft.action_config ?? {},
      conditions: draft.conditions ?? [],
      schedule: draft.schedule ?? {},
      enabled: draft.enabled,
      updated_by: user?.id ?? null,
    };
    const res = draft.id
      ? await automationsTable().update(row).eq('id', draft.id)
      : await automationsTable().insert({ ...row, created_by: user?.id ?? null });
    setSaving(false);
    if (res.error) {
      devConsole.error('[automations] save', res.error);
      toast.error(t('common.genericError'));
      return;
    }
    toast.success(t('auto.saved'));
    onSaved();
  };

  const selectedOffer = offers.find((o) => o.id === cfg.coupon_offer_id) ?? null;
  const sampleValues = useMemo(() => {
    const v: Record<string, string> = { ...SAMPLE_PLACEHOLDER_VALUES };
    if (selectedOffer) {
      v.coupon_offer = offerLabel(selectedOffer, services.find((s) => s.id === selectedOffer.service_id)?.name);
      v.coupon_code = selectedOffer.code_mode === 'shared' ? selectedOffer.shared_code ?? v.coupon_code : v.coupon_code;
    }
    return v;
  }, [selectedOffer, services]);

  const stepIndex = STEPS.indexOf(step);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? t('auto.edit') : t('auto.new')}</DialogTitle>
          <DialogDescription className="sr-only">{t('auto.subtitle')}</DialogDescription>
        </DialogHeader>

        {/* steps */}
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(s)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1',
                  s === step ? 'bg-primary text-primary-foreground' : i < stepIndex ? 'bg-muted' : 'text-muted-foreground',
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">{i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}</span>
                {t(`auto.step.${s}`)}
              </button>
              {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </li>
          ))}
        </ol>

        {step === 'trigger' && (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.id} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`auto.triggerGroup.${g.id}`)}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.triggers.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => chooseTrigger(type)}
                      className={cn(
                        'rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60',
                        draft.trigger_type === type && 'border-primary ring-1 ring-primary',
                      )}
                    >
                      <p className="font-medium">{t(`auto.trigger.${type}`)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t(`auto.triggerHelp.${type}`)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-wrap gap-4">
                {def.fields.includes('days') && (
                  <div className="space-y-1.5">
                    <Label>{t(`auto.cfg.days.${draft.trigger_type}`) === `auto.cfg.days.${draft.trigger_type}` ? t('auto.cfg.days') : t(`auto.cfg.days.${draft.trigger_type}`)}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={730}
                      className="w-32"
                      value={String(draft.trigger_config?.days ?? '')}
                      onChange={(e) => patch({ trigger_config: { ...draft.trigger_config, days: Math.max(0, Number(e.target.value) || 0) } })}
                    />
                  </div>
                )}
                {def.fields.includes('weeks') && (
                  <div className="space-y-1.5">
                    <Label>{t('auto.cfg.weeks')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={52}
                      className="w-32"
                      value={String(draft.trigger_config?.weeks ?? '')}
                      onChange={(e) => patch({ trigger_config: { ...draft.trigger_config, weeks: Math.min(52, Math.max(1, Number(e.target.value) || 1)) } })}
                    />
                    <p className="text-xs text-muted-foreground">{t('auto.cfg.weeksHelp')}</p>
                  </div>
                )}
                {def.fields.includes('status') && (
                  <div className="space-y-1.5">
                    <Label>{t('auto.cfg.status')}</Label>
                    <Select value={String(draft.trigger_config?.status ?? 'no_show')} onValueChange={(v) => patch({ trigger_config: { ...draft.trigger_config, status: v } })}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APPOINTMENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`auto.apptStatus.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {def.fields.includes('min_amount') && (
                  <div className="space-y-1.5">
                    <Label>{t('auto.cfg.min_amount')}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-32"
                      value={String(draft.trigger_config?.min_amount ?? 0)}
                      onChange={(e) => patch({ trigger_config: { ...draft.trigger_config, min_amount: Math.max(0, Number(e.target.value) || 0) } })}
                    />
                  </div>
                )}
              </div>
              <TimingEditor def={def} schedule={draft.schedule ?? {}} onChange={(s) => patch({ schedule: s })} />
            </div>
          </div>
        )}

        {step === 'conditions' && (
          <ConditionsEditor subject={def.subject} conditions={draft.conditions ?? []} onChange={(c) => patch({ conditions: c })} services={services} staff={staff} />
        )}

        {step === 'action' && (
          <div className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {allowedActions.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() =>
                    patch({
                      action_type: a,
                      action_config:
                        a === 'send_report'
                          ? { subject: cfg.subject ?? '', recipients: cfg.recipients ?? { roles: ['manager'] }, report: cfg.report ?? { source: 'appointments', columns: sourceDef('appointments')!.defaultColumns } }
                          : { ...cfg, recipients: cfg.recipients ?? { roles: ['manager'] }, channel: cfg.channel ?? 'preferred' },
                    })
                  }
                  className={cn('rounded-lg border p-3 text-left text-sm hover:bg-muted/60', draft.action_type === a && 'border-primary ring-1 ring-primary')}
                >
                  <p className="font-medium">{t(`auto.action.${a}`)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(`auto.actionHelp.${a}`)}</p>
                </button>
              ))}
            </div>

            {isMessage && (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('auto.channel')}</Label>
                    <RadioGroup value={cfg.channel ?? 'email'} onValueChange={(v) => patchConfig({ channel: v as 'email' | 'sms' | 'preferred' })} className="flex flex-wrap gap-4">
                      {(['preferred', 'email', 'sms'] as const).map((c) => (
                        <label key={c} className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value={c} />
                          {t(`auto.channel.${c}`)}
                        </label>
                      ))}
                    </RadioGroup>
                    {!capabilities.data?.sms && cfg.channel !== 'email' && <p className="text-xs text-muted-foreground">{t('auto.channel.smsNotReady')}</p>}
                  </div>
                  <MessageEditor
                    subject={def.subject}
                    showSubject={cfg.channel !== 'sms'}
                    subjectValue={cfg.subject ?? ''}
                    bodyValue={cfg.body ?? ''}
                    smsValue={cfg.sms_body ?? ''}
                    showSms={cfg.channel !== 'email'}
                    onChange={(p) => patchConfig(p)}
                  />
                  {actionSupportsCoupon(draft.action_type) && scope === 'business' && (
                    <div className="space-y-2 rounded-lg border p-3">
                      <Label className="flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        {t('auto.coupon.attach')}
                      </Label>
                      {offers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('auto.coupon.createFirst')}</p>
                      ) : (
                        <Select value={cfg.coupon_offer_id ?? 'none'} onValueChange={(v) => patchConfig({ coupon_offer_id: v === 'none' ? null : v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('auto.coupon.none')}</SelectItem>
                            {offers.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.name} · {offerLabel(o, services.find((s) => s.id === o.service_id)?.name)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-xs text-muted-foreground">{t('auto.coupon.help')}</p>
                      {onManageCoupons && (
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={onManageCoupons}>
                          {t('auto.coupon.manage')}
                        </Button>
                      )}
                    </div>
                  )}
                  {isMarketingMessage(draft.trigger_type, !!cfg.coupon_offer_id) && <p className="text-xs text-muted-foreground">{t('auto.optinNote')}</p>}
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{t('auto.preview.title')}</p>
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                    {cfg.channel !== 'sms' && <p className="mb-3 border-b pb-2 font-semibold">{fillPlaceholders(cfg.subject ?? '', sampleValues)}</p>}
                    <div className="whitespace-pre-wrap leading-relaxed">{fillPlaceholders(cfg.channel === 'sms' ? cfg.sms_body || cfg.body || '' : cfg.body ?? '', sampleValues)}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('auto.preview.note')}</p>
                </div>
              </div>
            )}

            {(draft.action_type === 'email_team' || draft.action_type === 'notify_team' || draft.action_type === 'email_business') && (
              <div className="space-y-4">
                {draft.action_type !== 'email_business' && (
                  <RecipientsEditor
                    value={cfg.recipients ?? {}}
                    onChange={(r) => patchConfig({ recipients: r })}
                    allowAssigned={def.subject === 'appointment' || def.subject === 'staff'}
                    allowEmails={draft.action_type === 'email_team'}
                  />
                )}
                <MessageEditor
                  subject={def.subject}
                  showSubject
                  subjectValue={cfg.subject ?? ''}
                  bodyValue={cfg.body ?? ''}
                  onChange={(p) => patchConfig(p)}
                />
              </div>
            )}

            {draft.action_type === 'send_report' && (
              <div className="space-y-4">
                <ReportEditor
                  spec={cfg.report ?? { source: 'appointments', columns: [] }}
                  onChange={(r) => patchConfig({ report: r })}
                  services={services}
                  staff={staff}
                />
                <RecipientsEditor
                  value={cfg.recipients ?? {}}
                  onChange={(r) => patchConfig({ recipients: r })}
                  allowAssigned={cfg.report?.source === 'appointments'}
                  assignedLabel={t('auto.rcpt.assignedAgenda')}
                  allowEmails
                />
                <div className="space-y-1.5">
                  <Label>{t('auto.subject')}</Label>
                  <Input value={cfg.subject ?? ''} onChange={(e) => patchConfig({ subject: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-5">
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <p>
                <span className="mr-2 text-xs font-semibold uppercase text-muted-foreground">{t('auto.review.when')}</span>
                <Badge variant="secondary">{triggerText(draft)}</Badge> <span className="text-muted-foreground">· {timingText(draft)}</span>
              </p>
              {(draft.conditions ?? []).length > 0 && (
                <p>
                  <span className="mr-2 text-xs font-semibold uppercase text-muted-foreground">{t('auto.review.if')}</span>
                  {draft.conditions.map((c) => t(`auto.cond.field.${c.field}`)).join(' · ')}
                </p>
              )}
              <p>
                <span className="mr-2 text-xs font-semibold uppercase text-muted-foreground">{t('auto.review.then')}</span>
                <Badge variant="secondary">{actionText(draft)}</Badge>
                {selectedOffer && (
                  <Badge variant="outline" className="ml-2">
                    <Gift className="mr-1 h-3 w-3" />
                    {offerLabel(selectedOffer, services.find((s) => s.id === selectedOffer.service_id)?.name)}
                  </Badge>
                )}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="automation-name">{t('auto.name')}</Label>
                <Input id="automation-name" value={draft.name} maxLength={120} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <label className="flex items-center gap-3 self-end pb-2 text-sm">
                <Switch checked={draft.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
                {t('auto.enabled')}
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={previewing || !stepValid('action')} onClick={() => void runPreview()}>
                {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                {t('auto.review.seeWho')}
              </Button>
              <Button variant="outline" size="sm" disabled={testing || !stepValid('action')} onClick={() => void runTest()}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {t('auto.sendTest')}
              </Button>
            </div>
            {outcome && <PreviewPanel outcome={outcome} />}
            {!draft.id && <p className="text-xs text-muted-foreground">{t('auto.review.saveFirstNote')}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('auto.cancel')}
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button variant="outline" onClick={() => setStep(STEPS[stepIndex - 1])}>
                {t('auto.back')}
              </Button>
            )}
            {step !== 'review' ? (
              <Button onClick={() => setStep(STEPS[stepIndex + 1])} disabled={!stepValid(step)}>
                {t('auto.next')}
              </Button>
            ) : (
              <Button onClick={() => void save()} disabled={saving || !stepValid('review')}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('auto.save')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
