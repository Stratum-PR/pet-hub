import {
  columnLabel,
  couponOfferLabel,
  templateByKey,
  triggerDef,
  type AutomationTemplate,
  type CouponKind,
} from '@/lib/automations';
import type { Automation, AutomationDraft } from '@/lib/automations';
import { getLanguage, t } from '@/lib/translations';

export const lang = (): 'es' | 'en' => (getLanguage() === 'en' ? 'en' : 'es');

export const colLabel = (key: string) => columnLabel(key, lang());

export function offerLabel(o: { kind: CouponKind; value: number | null }, serviceName?: string | null, productName?: string | null) {
  return couponOfferLabel({ kind: o.kind, value: o.value, service_name: serviceName, product_name: productName }, lang());
}

export function templateName(key: string) {
  return t(`auto.template.${key}.name`);
}

/** A new draft from a template (Spanish texts are the template's; the business edits them). */
export function draftFromTemplate(tpl: AutomationTemplate, businessId: string | null): AutomationDraft {
  return {
    name: templateName(tpl.key),
    business_id: businessId,
    template_key: tpl.key,
    trigger_type: tpl.trigger_type,
    trigger_config: { ...tpl.trigger_config },
    action_type: tpl.action_type,
    action_config: JSON.parse(JSON.stringify(tpl.action_config)),
    conditions: [],
    schedule: { ...tpl.schedule },
    enabled: false,
  };
}

export function emptyDraft(scope: 'business' | 'platform', businessId: string | null): AutomationDraft {
  return scope === 'platform'
    ? {
        name: '',
        business_id: null,
        template_key: null,
        trigger_type: 'trial_ending',
        trigger_config: { days: 3 },
        action_type: 'email_business',
        action_config: { subject: '', body: '' },
        conditions: [],
        schedule: { time: '09:00' },
        enabled: false,
      }
    : {
        name: '',
        business_id: businessId,
        template_key: null,
        trigger_type: 'schedule',
        trigger_config: {},
        action_type: 'send_report',
        action_config: { recipients: { roles: ['manager'] }, report: { source: 'appointments', columns: [] } },
        conditions: [],
        schedule: { frequency: 'daily', time: '08:00' },
        enabled: false,
      };
}

export function toDraft(a: Automation): AutomationDraft {
  const { id, name, business_id, template_key, trigger_type, trigger_config, action_type, action_config, conditions, schedule, enabled } = a;
  return { id, name, business_id, template_key, trigger_type, trigger_config, action_type, action_config, conditions, schedule, enabled };
}

/** One-line "When …" description of an automation's timing. */
export function timingText(d: Pick<AutomationDraft, 'trigger_type' | 'schedule' | 'trigger_config'>): string {
  const def = triggerDef(d.trigger_type);
  if (!def) return '';
  const time = d.schedule?.time ?? '09:00';
  if (def.kind === 'event') return t('auto.schedule.event');
  if (def.kind === 'daily') return `${t('auto.schedule.dailyAt')} ${time}`;
  switch (d.schedule?.frequency ?? 'daily') {
    case 'weekly':
      return `${t('auto.schedule.weekly')} · ${t(`auto.weekday.${d.schedule?.weekday ?? 1}`)} · ${time}`;
    case 'monthly':
      return `${t('auto.schedule.monthly')} · ${d.schedule?.monthday === 31 ? t('auto.schedule.lastDay') : d.schedule?.monthday ?? 1} · ${time}`;
    case 'pay_period':
      return `${t('auto.schedule.pay_period')} · ${time}`;
    default:
      return `${t('auto.schedule.daily')} · ${time}`;
  }
}

export function triggerText(d: Pick<AutomationDraft, 'trigger_type' | 'trigger_config'>): string {
  const base = t(`auto.trigger.${d.trigger_type}`);
  const c = d.trigger_config ?? {};
  if (c.days != null && d.trigger_type !== 'schedule') return `${base} (${c.days} ${t('auto.cfg.days').toLowerCase()})`;
  if (c.weeks != null) return `${base} (${c.weeks} sem.)`;
  if (c.status) return `${base}: ${t(`auto.apptStatus.${c.status}`)}`;
  if (c.min_amount) return `${base} (≥ $${c.min_amount})`;
  return base;
}

export function actionText(d: Pick<AutomationDraft, 'action_type' | 'action_config'>): string {
  const base = t(`auto.action.${d.action_type}`);
  if (d.action_type === 'send_report' && d.action_config?.report?.source) {
    return `${base}: ${t(`auto.report.source.${d.action_config.report.source}`)}`;
  }
  return base;
}

export { templateByKey };
