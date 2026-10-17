import { useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  CONDITIONS_BY_SUBJECT,
  DATE_RANGES,
  PLACEHOLDERS_BY_SUBJECT,
  REPORT_SOURCES,
  sourceDef,
  type Condition,
  type ConditionField,
  type ReportSpec,
  type Schedule,
  type TeamRecipients,
  type TriggerDef,
  type TriggerSubject,
} from '@/lib/automations';
import type { AutomationOutcome } from '@/lib/automations';
import { t } from '@/lib/translations';
import { colLabel } from './automationText';

type Option = { id: string; name: string };

/** Small pill toggle used for multi-selects (weekdays, staff, services…). */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[] | undefined, value: T): T[] {
  const s = new Set(list ?? []);
  if (s.has(value)) s.delete(value);
  else s.add(value);
  return [...s];
}

/* ---------------------------------------------------------------- timing */

export function TimingEditor({ def, schedule, onChange }: { def: TriggerDef; schedule: Schedule; onChange: (s: Schedule) => void }) {
  if (def.kind === 'event') return <p className="text-sm text-muted-foreground">{t('auto.schedule.event')}</p>;
  const time = (
    <div className="space-y-1.5">
      <Label>{def.kind === 'daily' ? t('auto.schedule.dailyAt') : t('auto.schedule.time')}</Label>
      <Input type="time" className="w-36" value={schedule.time ?? '09:00'} onChange={(e) => onChange({ ...schedule, time: e.target.value })} />
    </div>
  );
  if (def.kind === 'daily') return time;
  const freq = schedule.frequency ?? 'daily';
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label>{t('auto.schedule.frequency')}</Label>
        <Select value={freq} onValueChange={(v) => onChange({ ...schedule, frequency: v as Schedule['frequency'] })}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['daily', 'weekly', 'monthly', 'pay_period'] as const).map((f) => (
              <SelectItem key={f} value={f}>
                {t(`auto.schedule.${f}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {freq === 'weekly' && (
        <div className="space-y-1.5">
          <Label>{t('auto.schedule.weekday')}</Label>
          <Select value={String(schedule.weekday ?? 1)} onValueChange={(v) => onChange({ ...schedule, weekday: Number(v) })}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {t(`auto.weekday.${d}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {freq === 'monthly' && (
        <div className="space-y-1.5">
          <Label>{t('auto.schedule.monthday')}</Label>
          <Select value={String(schedule.monthday ?? 1)} onValueChange={(v) => onChange({ ...schedule, monthday: Number(v) })}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...Array.from({ length: 28 }, (_, i) => i + 1), 31].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d === 31 ? t('auto.schedule.lastDay') : d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {time}
      {freq === 'pay_period' && <p className="w-full text-xs text-muted-foreground">{t('auto.schedule.payHelp')}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- conditions */

export function ConditionsEditor({
  subject,
  conditions,
  onChange,
  services,
  staff,
}: {
  subject: TriggerSubject;
  conditions: Condition[];
  onChange: (c: Condition[]) => void;
  services: Option[];
  staff: Option[];
}) {
  const fields = CONDITIONS_BY_SUBJECT[subject] ?? [];
  const used = new Set(conditions.map((c) => c.field));
  const free = fields.filter((f) => !used.has(f));
  const update = (i: number, c: Condition) => onChange(conditions.map((x, j) => (j === i ? c : x)));
  const add = (field: ConditionField) => {
    const defaults: Record<ConditionField, Condition> = {
      species: { field, op: 'in', value: ['dog'] },
      service_id: { field, op: 'in', value: [] },
      staff_id: { field, op: 'in', value: [] },
      booking_source: { field, op: 'in', value: ['online'] },
      min_amount: { field, op: 'gte', value: 50 },
      max_amount: { field, op: 'lte', value: 100 },
      weekday: { field, op: 'in', value: ['1', '2', '3', '4', '5'] },
      is_new_client: { field, op: 'eq', value: 'true' },
    };
    onChange([...conditions, defaults[field]]);
  };
  const list = (c: Condition) => (Array.isArray(c.value) ? c.value.map(String) : [String(c.value)]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('auto.cond.help')}</p>
      {conditions.length === 0 && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{t('auto.cond.none')}</p>}
      {conditions.map((c, i) => (
        <div key={c.field} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t(`auto.cond.field.${c.field}`)}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(conditions.filter((_, j) => j !== i))} aria-label={t('auto.delete')}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.field === 'species' &&
              ['dog', 'cat', 'other'].map((s) => (
                <Chip key={s} active={list(c).includes(s)} onClick={() => update(i, { ...c, value: toggle(list(c), s) })}>
                  {t(`auto.species.${s}`)}
                </Chip>
              ))}
            {c.field === 'service_id' &&
              services.map((s) => (
                <Chip key={s.id} active={list(c).includes(s.id)} onClick={() => update(i, { ...c, value: toggle(list(c), s.id) })}>
                  {s.name}
                </Chip>
              ))}
            {c.field === 'staff_id' &&
              staff.map((s) => (
                <Chip key={s.id} active={list(c).includes(s.id)} onClick={() => update(i, { ...c, value: toggle(list(c), s.id) })}>
                  {s.name}
                </Chip>
              ))}
            {c.field === 'booking_source' &&
              ['online', 'in_person'].map((s) => (
                <Chip key={s} active={list(c).includes(s)} onClick={() => update(i, { ...c, value: toggle(list(c), s) })}>
                  {t(`auto.cond.${s}`)}
                </Chip>
              ))}
            {c.field === 'weekday' &&
              ['1', '2', '3', '4', '5', '6', '0'].map((d) => (
                <Chip key={d} active={list(c).includes(d)} onClick={() => update(i, { ...c, value: toggle(list(c), d) })}>
                  {t(`auto.weekday.${d}`).slice(0, 3)}
                </Chip>
              ))}
            {c.field === 'is_new_client' &&
              ['true', 'false'].map((v) => (
                <Chip key={v} active={String(c.value) === v} onClick={() => update(i, { ...c, value: v })}>
                  {t(v === 'true' ? 'auto.cond.yes' : 'auto.cond.no')}
                </Chip>
              ))}
            {(c.field === 'min_amount' || c.field === 'max_amount') && (
              <Input
                type="number"
                min={0}
                className="w-32"
                value={String(c.value)}
                onChange={(e) => update(i, { ...c, value: Number(e.target.value) || 0 })}
              />
            )}
          </div>
        </div>
      ))}
      {free.length > 0 && (
        <Select value="" onValueChange={(v) => add(v as ConditionField)}>
          <SelectTrigger className="w-60">
            <span className="flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" />
              {t('auto.cond.add')}
            </span>
          </SelectTrigger>
          <SelectContent>
            {free.map((f) => (
              <SelectItem key={f} value={f}>
                {t(`auto.cond.field.${f}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- message */

export function MessageEditor({
  subject,
  showSubject = true,
  subjectValue,
  bodyValue,
  smsValue,
  showSms,
  onChange,
}: {
  subject: TriggerSubject;
  showSubject?: boolean;
  subjectValue: string;
  bodyValue: string;
  smsValue?: string;
  showSms?: boolean;
  onChange: (patch: { subject?: string; body?: string; sms_body?: string }) => void;
}) {
  const refs = {
    subject: useRef<HTMLInputElement>(null),
    body: useRef<HTMLTextAreaElement>(null),
    sms_body: useRef<HTMLTextAreaElement>(null),
  };
  const last = useRef<'subject' | 'body' | 'sms_body'>('body');
  const values = { subject: subjectValue, body: bodyValue, sms_body: smsValue ?? '' };

  const insert = (field: string) => {
    const token = `{{${field}}}`;
    const key = last.current;
    const el = refs[key].current;
    const current = values[key];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    onChange({ [key]: current.slice(0, start) + token + current.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-3">
      {showSubject && (
        <div className="space-y-1.5">
          <Label>{t('auto.subject')}</Label>
          <Input ref={refs.subject} value={subjectValue} onFocus={() => (last.current = 'subject')} onChange={(e) => onChange({ subject: e.target.value })} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>{t('auto.body')}</Label>
        <Textarea ref={refs.body} rows={8} value={bodyValue} onFocus={() => (last.current = 'body')} onChange={(e) => onChange({ body: e.target.value })} />
      </div>
      {showSms && (
        <div className="space-y-1.5">
          <Label>{t('auto.smsBody')}</Label>
          <Textarea
            ref={refs.sms_body}
            rows={3}
            value={smsValue ?? ''}
            onFocus={() => (last.current = 'sms_body')}
            onChange={(e) => onChange({ sms_body: e.target.value })}
          />
          <p className="text-right text-xs text-muted-foreground">{(smsValue ?? '').length}/320</p>
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground">{t('auto.insertField')}</p>
        <div className="flex flex-wrap gap-1.5">
          {(PLACEHOLDERS_BY_SUBJECT[subject] ?? []).map((p) => (
            <Button
              key={p}
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 rounded-full px-3 text-xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(p)}
            >
              {t(`auto.field.${p}`)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- recipients */

export function RecipientsEditor({
  value,
  onChange,
  allowAssigned,
  assignedLabel,
  allowEmails,
}: {
  value: TeamRecipients;
  onChange: (r: TeamRecipients) => void;
  allowAssigned?: boolean;
  assignedLabel?: string;
  allowEmails?: boolean;
}) {
  const roles = value.roles ?? [];
  return (
    <div className="space-y-2">
      <Label>{t('auto.rcpt.title')}</Label>
      <div className="flex flex-wrap gap-4">
        {(['manager', 'admin', 'staff'] as const).map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <Checkbox checked={roles.includes(r)} onCheckedChange={() => onChange({ ...value, roles: toggle(roles, r) })} />
            {t(`auto.rcpt.${r}`)}
          </label>
        ))}
        {allowAssigned && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!!value.assigned_staff} onCheckedChange={(v) => onChange({ ...value, assigned_staff: v === true })} />
            {assignedLabel ?? t('auto.rcpt.assigned')}
          </label>
        )}
      </div>
      {allowEmails && (
        <div className="space-y-1">
          <Input
            placeholder={t('auto.rcpt.emails')}
            value={(value.emails ?? []).join(', ')}
            onChange={(e) =>
              onChange({
                ...value,
                emails: e.target.value
                  .split(/[,\s;]+/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <p className="text-xs text-muted-foreground">{t('auto.rcpt.emailsHelp')}</p>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- report */

const APPOINTMENT_STATUSES = ['pending', 'scheduled', 'confirmed', 'completed', 'canceled', 'no_show'];

export function ReportEditor({ spec, onChange, services, staff }: { spec: ReportSpec; onChange: (s: ReportSpec) => void; services: Option[]; staff: Option[] }) {
  const def = sourceDef(spec.source) ?? REPORT_SOURCES[0];
  const cols = spec.columns?.length ? spec.columns : def.defaultColumns;
  const f = spec.filters ?? {};
  const setFilters = (patch: Partial<NonNullable<ReportSpec['filters']>>) => onChange({ ...spec, filters: { ...f, ...patch } });
  const groupable = cols.filter((c) => !def.columns.find((d) => d.key === c)?.numeric);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label>{t('auto.report.source')}</Label>
          <Select
            value={spec.source}
            onValueChange={(v) => {
              const nd = sourceDef(v)!;
              onChange({ source: nd.source, columns: nd.defaultColumns, date_range: nd.dated ? nd.defaultRange : undefined, filters: {}, group_by: null });
            }}
          >
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_SOURCES.map((s) => (
                <SelectItem key={s.source} value={s.source}>
                  {t(`auto.report.source.${s.source}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {def.dated && (
          <div className="space-y-1.5">
            <Label>{t('auto.report.range')}</Label>
            <Select value={spec.date_range ?? def.defaultRange} onValueChange={(v) => onChange({ ...spec, date_range: v as ReportSpec['date_range'] })}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`auto.range.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>{t('auto.report.columns')}</Label>
        <div className="flex flex-wrap gap-1.5">
          {def.columns.map((c) => (
            <Chip
              key={c.key}
              active={cols.includes(c.key)}
              onClick={() => {
                const next = cols.includes(c.key) ? cols.filter((x) => x !== c.key) : def.columns.map((d) => d.key).filter((k) => k === c.key || cols.includes(k));
                onChange({ ...spec, columns: next, group_by: next.includes(spec.group_by ?? '') ? spec.group_by : null });
              }}
            >
              {colLabel(c.key)}
            </Chip>
          ))}
        </div>
      </div>

      {groupable.length > 0 && def.columns.some((c) => c.numeric && cols.includes(c.key)) && (
        <div className="space-y-1.5">
          <Label>{t('auto.report.groupBy')}</Label>
          <Select value={spec.group_by ?? 'none'} onValueChange={(v) => onChange({ ...spec, group_by: v === 'none' ? null : v })}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('auto.report.noGroup')}</SelectItem>
              {groupable.map((c) => (
                <SelectItem key={c} value={c}>
                  {colLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {def.filters.length > 0 && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">{t('auto.report.filters')}</p>
          {def.filters.includes('statuses') && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!f.statuses?.length} onClick={() => setFilters({ statuses: [] })}>
                {t('auto.report.allStatuses')}
              </Chip>
              <Chip active={!!f.statuses?.includes('completed_unbilled')} onClick={() => setFilters({ statuses: f.statuses?.includes('completed_unbilled') ? [] : ['completed_unbilled'] })}>
                {t('auto.report.unbilledOnly')}
              </Chip>
              {APPOINTMENT_STATUSES.map((s) => (
                <Chip
                  key={s}
                  active={!!f.statuses?.includes(s)}
                  onClick={() => setFilters({ statuses: toggle((f.statuses ?? []).filter((x) => x !== 'completed_unbilled'), s) })}
                >
                  {t(`auto.apptStatus.${s}`) === `auto.apptStatus.${s}` ? s : t(`auto.apptStatus.${s}`)}
                </Chip>
              ))}
            </div>
          )}
          {def.filters.includes('staff_ids') && staff.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!f.staff_ids?.length} onClick={() => setFilters({ staff_ids: [] })}>
                {t('auto.report.allStaff')}
              </Chip>
              {staff.map((s) => (
                <Chip key={s.id} active={!!f.staff_ids?.includes(s.id)} onClick={() => setFilters({ staff_ids: toggle(f.staff_ids, s.id) })}>
                  {s.name}
                </Chip>
              ))}
            </div>
          )}
          {def.filters.includes('service_ids') && services.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!f.service_ids?.length} onClick={() => setFilters({ service_ids: [] })}>
                {t('auto.report.allServices')}
              </Chip>
              {services.map((s) => (
                <Chip key={s.id} active={!!f.service_ids?.includes(s.id)} onClick={() => setFilters({ service_ids: toggle(f.service_ids, s.id) })}>
                  {s.name}
                </Chip>
              ))}
            </div>
          )}
          {def.filters.includes('payment_methods') && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!f.payment_methods?.length} onClick={() => setFilters({ payment_methods: [] })}>
                {t('auto.report.allMethods')}
              </Chip>
              {['cash', 'card', 'ath_movil'].map((m) => (
                <Chip key={m} active={!!f.payment_methods?.includes(m)} onClick={() => setFilters({ payment_methods: toggle(f.payment_methods, m) })}>
                  {t(`auto.pm.${m}`)}
                </Chip>
              ))}
            </div>
          )}
          {def.filters.includes('species') && (
            <div className="flex flex-wrap gap-1.5">
              {['dog', 'cat', 'other'].map((s) => (
                <Chip key={s} active={!!f.species?.includes(s)} onClick={() => setFilters({ species: toggle(f.species, s) })}>
                  {t(`auto.species.${s}`)}
                </Chip>
              ))}
            </div>
          )}
          {def.filters.includes('below_reorder_only') && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!f.below_reorder_only} onCheckedChange={(v) => setFilters({ below_reorder_only: v })} />
              {t('auto.report.belowReorder')}
            </label>
          )}
          {def.filters.includes('marketing_opt_in_only') && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!f.marketing_opt_in_only} onCheckedChange={(v) => setFilters({ marketing_opt_in_only: v })} />
              {t('auto.report.optInOnly')}
            </label>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('auto.report.emptySkip')}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- preview */

export function PreviewPanel({ outcome }: { outcome: AutomationOutcome }) {
  if (outcome.report) {
    const r = outcome.report;
    if (r.total === 0) return <p className="text-sm text-muted-foreground">{t('auto.review.reportEmpty')}</p>;
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('auto.review.rows', { n: r.total })}</p>
        <div className="max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {r.columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-left font-medium">
                    {r.headers[c] ?? c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-t">
                  {r.columns.map((c) => (
                    <td key={c} className="px-2 py-1">
                      {row[c] == null ? '' : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  const items = outcome.preview ?? [];
  const reached = items.filter((i) => !i.note || /^\d+$/.test(i.note));
  const skipped = items.filter((i) => i.note && !/^\d+$/.test(i.note));
  return (
    <div className="space-y-2 text-sm">
      {reached.length === 0 && <p className="text-muted-foreground">{t('auto.review.nobody')}</p>}
      {reached.length > 0 && (
        <ul className="max-h-60 divide-y overflow-y-auto rounded-md border">
          {reached.map((i, k) => (
            <li key={k} className="flex flex-wrap gap-x-3 px-3 py-1.5">
              <span className="font-medium">{i.label}</span>
              <span className="break-all text-muted-foreground">{i.recipient}</span>
              <span className="ml-auto text-xs uppercase text-muted-foreground">{i.channel}</span>
            </li>
          ))}
        </ul>
      )}
      {outcome.already_sent > 0 && <p className="text-muted-foreground">{t('auto.review.alreadySent', { n: outcome.already_sent })}</p>}
      {skipped.length > 0 && (
        <details className="text-muted-foreground">
          <summary className="cursor-pointer">{t('auto.review.skipped', { n: skipped.length })}</summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {skipped.slice(0, 50).map((i, k) => (
              <li key={k}>
                {i.label} · {i.note === 'no_optin' ? t('auto.review.noOptin') : t('auto.review.noContact')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
