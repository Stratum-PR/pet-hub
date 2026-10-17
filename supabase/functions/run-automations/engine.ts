// Automation engine: finds what each automation is about (subjects), applies conditions and runs its action.
// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped service-role queries (no generated types for Deno) */
import {
  actionSupportsCoupon,
  addDays,
  conditionsMatch,
  couponOfferLabel,
  daysBetween,
  displayDate,
  displayTime,
  fillPlaceholders,
  isMarketingMessage,
  localNow,
  localYmd,
  makeCouponCode,
  normalizeAppointmentStatus,
  safeTimeZone,
  SAMPLE_PLACEHOLDER_VALUES,
  scheduleDue,
  triggerDef,
  ymdKey,
  type ActionConfig,
  type Condition,
  type ConditionFacts,
  type Schedule,
  type TeamRecipients,
  type TriggerType,
} from "./catalog.ts";
import { birthdayDueToday, petAge, senderName } from "./logic.ts";
import { buildReport, type BizCtx, type BuiltReport } from "./reports.ts";
import { base64Utf8, messageHtml, sendEmail, sendSms, tableHtml, type DeliveryEnv } from "./delivery.ts";
import { toCsv } from "./catalog.ts";

export type AutomationRow = {
  id: string;
  name: string;
  business_id: string | null;
  template_key: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, any> | null;
  action_type: string;
  action_config: ActionConfig | null;
  conditions: Condition[] | null;
  schedule: Schedule | null;
  enabled: boolean;
  last_run_at: string | null;
  event_cursor: string | null;
};

export type EngineCtx = {
  db: any;
  env: DeliveryEnv;
  now: Date;
  siteUrl: string;
  lang: "es" | "en";
};

export type Mode = "run" | "preview" | "test";

export type PreviewItem = { label: string; recipient: string; channel: string; note?: string };

export type Outcome = {
  sent: number;
  failed: number;
  skipped: number;
  already_sent: number;
  /** Back-compat with the first admin page. */
  skipped_no_optin: number;
  preview: PreviewItem[];
  report?: { columns: string[]; headers: Record<string, string>; rows: Record<string, unknown>[]; total: number };
  ran: boolean;
  detail?: string;
};

type Subject = {
  key: string;
  occurrence: string;
  label: string;
  businessId: string;
  petId?: string | null;
  clientId?: string | null;
  staffId?: string | null;
  facts: ConditionFacts;
  values: Record<string, string>;
};

const PLATFORM_TZ = "America/Puerto_Rico";
const blank = (): Outcome => ({ sent: 0, failed: 0, skipped: 0, already_sent: 0, skipped_no_optin: 0, preview: [], ran: false });
const fullName = (c: any) => [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim();
const isEmail = (s: string | null | undefined) => !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/* ------------------------------------------------------------------ business */

export async function loadBiz(db: any, businessId: string, now: Date): Promise<BizCtx | null> {
  const [{ data: b }, { data: s }] = await Promise.all([
    db.from("businesses").select("id, name, email, slug").eq("id", businessId).maybeSingle(),
    db
      .from("settings")
      .select("business_name, timezone, pay_schedule_anchor_date, pay_schedule_cadence_weeks")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);
  if (!b) return null;
  const tz = safeTimeZone(s?.timezone);
  return {
    id: b.id,
    name: (s?.business_name ?? "").trim() || b.name,
    email: b.email ?? null,
    slug: b.slug ?? null,
    tz,
    today: ymdKey(localNow(now, tz)),
    pay: {
      anchor: s?.pay_schedule_anchor_date ?? null,
      cadenceWeeks: s?.pay_schedule_cadence_weeks ? Number(s.pay_schedule_cadence_weeks) : null,
    },
  };
}

function bookingLink(ctx: EngineCtx, biz: BizCtx): string {
  return biz.slug ? `${ctx.siteUrl.replace(/\/$/, "")}/${biz.slug}/reservar` : ctx.siteUrl;
}

function baseValues(ctx: EngineCtx, biz: BizCtx): Record<string, string> {
  return { business_name: biz.name, booking_link: bookingLink(ctx, biz), today: displayDate(biz.today) };
}

/* ------------------------------------------------------------------ subjects */

async function petSubjects(ctx: EngineCtx, biz: BizCtx, pets: any[], occurrence: (p: any) => string): Promise<Subject[]> {
  const clientIds = [...new Set(pets.map((p) => p.client_id).filter(Boolean))];
  const { data: clients } = clientIds.length
    ? await ctx.db.from("clients").select("id, first_name, last_name").in("id", clientIds)
    : { data: [] };
  const byId = new Map((clients ?? []).map((c: any) => [c.id, c]));
  const year = Number(biz.today.slice(0, 4));
  return pets
    .filter((p) => p.client_id)
    .map((p) => {
      const c: any = byId.get(p.client_id);
      return {
        key: `pet:${p.id}`,
        occurrence: occurrence(p),
        label: `${p.name} · ${fullName(c)}`,
        businessId: biz.id,
        petId: p.id,
        clientId: p.client_id,
        facts: { species: p.species ?? null },
        values: {
          ...baseValues(ctx, biz),
          pet_name: p.name ?? "",
          pet_age: petAge(p.birth_year, year),
          owner_first_name: c?.first_name?.trim() || fullName(c),
          owner_name: fullName(c),
        },
      };
    });
}

async function appointmentSubjects(ctx: EngineCtx, biz: BizCtx, appts: any[], occurrence: (a: any) => string): Promise<Subject[]> {
  const ids = (k: string) => [...new Set(appts.map((a) => a[k]).filter(Boolean).map(String))];
  const [clients, pets, staff] = await Promise.all([
    ids("client_id").length ? ctx.db.from("clients").select("id, first_name, last_name, created_at").in("id", ids("client_id")) : { data: [] },
    ids("pet_id").length ? ctx.db.from("pets").select("id, name, species").in("id", ids("pet_id")) : { data: [] },
    ids("staff_id").length ? ctx.db.from("staff").select("id, name").in("id", ids("staff_id")) : { data: [] },
  ]);
  const cm = new Map((clients.data ?? []).map((c: any) => [String(c.id), c]));
  const pm = new Map((pets.data ?? []).map((p: any) => [String(p.id), p]));
  const sm = new Map((staff.data ?? []).map((s: any) => [String(s.id), s]));
  return appts
    .filter((a) => a.client_id)
    .map((a) => {
      const c: any = cm.get(String(a.client_id));
      const p: any = pm.get(String(a.pet_id));
      const s: any = sm.get(String(a.staff_id));
      const isNew = c?.created_at ? daysBetween(localYmd(c.created_at, biz.tz), a.appointment_date ?? biz.today) <= 1 : false;
      return {
        key: `appointment:${a.id}`,
        occurrence: occurrence(a),
        label: `${a.appointment_date ?? ""} ${String(a.start_time ?? "").slice(0, 5)} · ${p?.name ?? ""} · ${fullName(c)}`.trim(),
        businessId: biz.id,
        petId: a.pet_id ?? null,
        clientId: a.client_id,
        staffId: a.staff_id ?? null,
        facts: {
          species: p?.species ?? null,
          service_ids: (a.service_ids ?? (a.service_id ? [a.service_id] : [])).map(String),
          staff_id: a.staff_id ? String(a.staff_id) : null,
          booking_source: a.booking_source ?? null,
          is_new_client: isNew,
        },
        values: {
          ...baseValues(ctx, biz),
          owner_first_name: c?.first_name?.trim() || fullName(c),
          owner_name: fullName(c),
          pet_name: p?.name ?? "",
          appointment_date: displayDate(a.appointment_date),
          appointment_time: displayTime(a.start_time),
          service: a.service_type ?? "",
          groomer: s?.name ?? "",
        },
      };
    });
}

async function staffById(db: any, ids: string[]): Promise<Map<string, any>> {
  if (!ids.length) return new Map();
  const { data } = await db.from("staff").select("id, name, email").in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((s: any) => [String(s.id), s]));
}

function staffSubject(ctx: EngineCtx, biz: BizCtx, key: string, occurrence: string, staff: any, detail: string): Subject {
  return {
    key,
    occurrence,
    label: `${staff?.name ?? ""}${detail ? ` · ${detail}` : ""}`,
    businessId: biz.id,
    staffId: staff?.id ? String(staff.id) : null,
    facts: { staff_id: staff?.id ? String(staff.id) : null },
    values: { ...baseValues(ctx, biz), staff_name: staff?.name ?? "", detail },
  };
}

const ACTIVE_STATUSES = (s: string) => !["canceled", "no_show", "completed"].includes(normalizeAppointmentStatus(s));

/** Records for one business-level trigger. `since` is the event window start (event triggers only). */
async function collectBusinessSubjects(ctx: EngineCtx, biz: BizCtx, a: AutomationRow, since: string | null): Promise<Subject[]> {
  const db = ctx.db;
  const cfg = a.trigger_config ?? {};
  const def = triggerDef(a.trigger_type)!;
  const nowIso = ctx.now.toISOString();
  const today = biz.today;

  switch (a.trigger_type) {
    case "schedule":
      return [{ key: "schedule", occurrence: today, label: biz.name, businessId: biz.id, facts: {}, values: baseValues(ctx, biz) }];

    case "pet_birthday": {
      const t = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)), day: Number(today.slice(8, 10)) };
      const { data } = await db
        .from("pets")
        .select("id, name, species, birth_month, birth_day, birth_year, client_id")
        .eq("business_id", biz.id)
        .eq("birth_month", t.month);
      const due = (data ?? []).filter((p: any) => birthdayDueToday(p, t));
      return petSubjects(ctx, biz, due, () => String(t.year));
    }

    case "grooming_due": {
      const weeks = Math.max(1, Number(cfg.weeks ?? def.defaults.weeks ?? 6));
      // Completed visits whose next grooming falls today (2-day catch-up), no upcoming appointment.
      const { data: visits } = await db
        .from("appointments")
        .select("pet_id, appointment_date")
        .eq("business_id", biz.id)
        .eq("status", "completed")
        .gte("appointment_date", addDays(today, -(52 * 7 + 3)))
        .limit(50000);
      const last = new Map<string, string>();
      for (const v of visits ?? []) if (v.pet_id && String(v.appointment_date) > (last.get(String(v.pet_id)) ?? "")) last.set(String(v.pet_id), String(v.appointment_date));
      const { data: upcoming } = await db
        .from("appointments")
        .select("pet_id, status")
        .eq("business_id", biz.id)
        .gte("appointment_date", today)
        .limit(20000);
      const busy = new Set((upcoming ?? []).filter((u: any) => ACTIVE_STATUSES(u.status)).map((u: any) => String(u.pet_id)));
      const ids = [...last.keys()].filter((id) => !busy.has(id));
      if (!ids.length) return [];
      const { data: pets } = await db.from("pets").select("id, name, species, birth_year, client_id, grooming_interval_weeks").in("id", ids.slice(0, 2000));
      const due = (pets ?? []).filter((p: any) => {
        const w = Number(p.grooming_interval_weeks ?? weeks);
        const d = daysBetween(addDays(last.get(String(p.id))!, w * 7), today);
        return d >= 0 && d <= 2;
      });
      return petSubjects(ctx, biz, due, (p) => last.get(String(p.id)) ?? today);
    }

    case "client_inactive": {
      const days = Math.max(7, Number(cfg.days ?? def.defaults.days ?? 90));
      const { data: visits } = await db
        .from("appointments")
        .select("client_id, appointment_date, status")
        .eq("business_id", biz.id)
        .gte("appointment_date", addDays(today, -(days + 400)))
        .limit(50000);
      const last = new Map<string, string>();
      const busy = new Set<string>();
      for (const v of visits ?? []) {
        if (!v.client_id) continue;
        const k = String(v.client_id);
        if (normalizeAppointmentStatus(v.status) === "completed" && String(v.appointment_date) > (last.get(k) ?? "")) last.set(k, String(v.appointment_date));
        if (String(v.appointment_date) >= today && ACTIVE_STATUSES(v.status)) busy.add(k);
      }
      const due = [...last.entries()].filter(([k, d]) => {
        if (busy.has(k)) return false;
        const since = daysBetween(d, today);
        return since >= days && since <= days + 2;
      });
      if (!due.length) return [];
      const ids = due.map(([k]) => k);
      const [{ data: clients }, { data: pets }] = await Promise.all([
        db.from("clients").select("id, first_name, last_name, merged_into_client_id").in("id", ids),
        db.from("pets").select("client_id, name").in("client_id", ids),
      ]);
      const petNames = new Map<string, string[]>();
      for (const p of pets ?? []) petNames.set(String(p.client_id), [...(petNames.get(String(p.client_id)) ?? []), p.name]);
      const lastBy = new Map(due);
      return (clients ?? [])
        .filter((c: any) => !c.merged_into_client_id)
        .map((c: any) => ({
          key: `client:${c.id}`,
          occurrence: lastBy.get(String(c.id)) ?? today,
          label: fullName(c),
          businessId: biz.id,
          clientId: c.id,
          facts: {},
          values: {
            ...baseValues(ctx, biz),
            owner_first_name: c.first_name?.trim() || fullName(c),
            owner_name: fullName(c),
            pet_names: (petNames.get(String(c.id)) ?? []).join(", "),
            last_visit: displayDate(lastBy.get(String(c.id))),
          },
        }));
    }

    case "appointment_before":
    case "appointment_after": {
      const days = Math.max(0, Number(cfg.days ?? def.defaults.days ?? 1));
      const before = a.trigger_type === "appointment_before";
      // after: completed appointments days ago (2-day catch-up); before: active appointments in N days.
      const from = before ? addDays(today, days) : addDays(today, -(days + 2));
      const to = before ? addDays(today, days) : addDays(today, -days);
      const { data } = await db
        .from("appointments")
        .select("id, appointment_date, start_time, status, service_type, service_id, service_ids, staff_id, client_id, pet_id, booking_source")
        .eq("business_id", biz.id)
        .gte("appointment_date", from)
        .lte("appointment_date", to);
      const list = (data ?? []).filter((x: any) =>
        before ? ACTIVE_STATUSES(x.status) && normalizeAppointmentStatus(x.status) !== "pending" : normalizeAppointmentStatus(x.status) === "completed",
      );
      return appointmentSubjects(ctx, biz, list, (x) => `${before ? "before" : "after"}:${x.appointment_date}`);
    }

    case "appointment_status": {
      if (!since) return [];
      const want = String(cfg.status ?? "no_show");
      const { data } = await db
        .from("appointments")
        .select("id, appointment_date, start_time, status, service_type, service_id, service_ids, staff_id, client_id, pet_id, booking_source, updated_at")
        .eq("business_id", biz.id)
        .gt("updated_at", since)
        .lte("updated_at", nowIso)
        .limit(2000);
      const list = (data ?? []).filter((x: any) => normalizeAppointmentStatus(x.status) === want);
      return appointmentSubjects(ctx, biz, list, () => `status:${want}`);
    }

    case "booking_request": {
      if (!since) return [];
      const { data } = await db
        .from("appointments")
        .select("id, appointment_date, start_time, status, service_type, service_id, service_ids, staff_id, client_id, pet_id, booking_source")
        .eq("business_id", biz.id)
        .eq("booking_source", "online")
        .gt("created_at", since)
        .lte("created_at", nowIso)
        .limit(2000);
      return appointmentSubjects(ctx, biz, data ?? [], () => "request");
    }

    case "new_client": {
      if (!since) return [];
      const { data } = await db
        .from("clients")
        .select("id, first_name, last_name")
        .eq("business_id", biz.id)
        .is("merged_into_client_id", null)
        .gt("created_at", since)
        .lte("created_at", nowIso)
        .limit(2000);
      return (data ?? []).map((c: any) => ({
        key: `client:${c.id}`,
        occurrence: "new",
        label: fullName(c),
        businessId: biz.id,
        clientId: c.id,
        facts: { is_new_client: true },
        values: { ...baseValues(ctx, biz), owner_first_name: c.first_name?.trim() || fullName(c), owner_name: fullName(c), pet_names: "" },
      }));
    }

    case "new_pet": {
      if (!since) return [];
      const { data } = await db
        .from("pets")
        .select("id, name, species, birth_year, client_id")
        .eq("business_id", biz.id)
        .gt("created_at", since)
        .lte("created_at", nowIso)
        .limit(2000);
      return petSubjects(ctx, biz, data ?? [], () => "new");
    }

    case "sale_completed": {
      if (!since) return [];
      const min = Math.round(Number(cfg.min_amount ?? 0) * 100);
      const { data } = await db
        .from("transactions")
        .select("id, transaction_number, customer_id, staff_id, total, status, is_test, created_at")
        .eq("business_id", biz.id)
        .gt("created_at", since)
        .lte("created_at", nowIso)
        .limit(2000);
      const list = (data ?? []).filter((t: any) => !t.is_test && t.status === "paid" && Number(t.total ?? 0) >= min && t.customer_id);
      const ids = [...new Set(list.map((t: any) => t.customer_id))];
      const { data: clients } = ids.length ? await db.from("clients").select("id, first_name, last_name").in("id", ids) : { data: [] };
      const cm = new Map((clients ?? []).map((c: any) => [c.id, c]));
      return list.map((t: any) => {
        const c: any = cm.get(t.customer_id);
        return {
          key: `sale:${t.id}`,
          occurrence: "paid",
          label: `#${t.transaction_number ?? ""} · ${fullName(c)} · $${(Number(t.total) / 100).toFixed(2)}`,
          businessId: biz.id,
          clientId: t.customer_id,
          facts: { amount: Number(t.total) / 100, staff_id: t.staff_id ? String(t.staff_id) : null },
          values: {
            ...baseValues(ctx, biz),
            owner_first_name: c?.first_name?.trim() || fullName(c),
            owner_name: fullName(c),
            sale_total: `$${(Number(t.total) / 100).toFixed(2)}`,
            sale_number: String(t.transaction_number ?? ""),
          },
        };
      });
    }

    case "refund_issued": {
      if (!since) return [];
      const { data: txns } = await db.from("transactions").select("id, transaction_number").eq("business_id", biz.id).limit(50000);
      const ids = (txns ?? []).map((t: any) => t.id);
      const num = new Map((txns ?? []).map((t: any) => [t.id, t.transaction_number]));
      const out: Subject[] = [];
      for (let i = 0; i < ids.length && i < 5000; i += 300) {
        const { data } = await db
          .from("transaction_refunds")
          .select("id, transaction_id, amount, reason")
          .in("transaction_id", ids.slice(i, i + 300))
          .gt("created_at", since)
          .lte("created_at", nowIso);
        for (const r of data ?? [])
          out.push({
            key: `refund:${r.id}`,
            occurrence: "refund",
            label: `#${num.get(r.transaction_id) ?? ""} · $${(Number(r.amount ?? 0) / 100).toFixed(2)}`,
            businessId: biz.id,
            facts: { amount: Number(r.amount ?? 0) / 100 },
            values: { ...baseValues(ctx, biz), sale_number: String(num.get(r.transaction_id) ?? ""), sale_total: `$${(Number(r.amount ?? 0) / 100).toFixed(2)}`, detail: r.reason ?? "" },
          });
      }
      return out;
    }

    case "payment_failed": {
      if (!since) return [];
      const { data } = await db
        .from("payments")
        .select("id, status, amount_cents, last_error, updated_at")
        .eq("business_id", biz.id)
        .in("status", ["failed", "expired", "canceled"])
        .gt("updated_at", since)
        .lte("updated_at", nowIso)
        .limit(2000);
      return (data ?? []).map((p: any) => ({
        key: `payment:${p.id}`,
        occurrence: p.status,
        label: `$${(Number(p.amount_cents) / 100).toFixed(2)} · ${p.status}`,
        businessId: biz.id,
        facts: { amount: Number(p.amount_cents) / 100 },
        values: { ...baseValues(ctx, biz), sale_total: `$${(Number(p.amount_cents) / 100).toFixed(2)}`, detail: p.last_error ?? p.status },
      }));
    }

    case "low_stock": {
      if (!since) return [];
      const { data } = await db
        .from("inventory")
        .select("id, product_name, quantity_on_hand, reorder_level, is_active, updated_at")
        .eq("business_id", biz.id)
        .gt("updated_at", since)
        .lte("updated_at", nowIso)
        .limit(2000);
      return (data ?? [])
        .filter((i: any) => i.is_active !== false && Number(i.quantity_on_hand ?? 0) <= Number(i.reorder_level ?? 0))
        .map((i: any) => ({
          key: `product:${i.id}`,
          occurrence: today,
          label: `${i.product_name} (${i.quantity_on_hand})`,
          businessId: biz.id,
          facts: {},
          values: { ...baseValues(ctx, biz), product_name: i.product_name, quantity: String(i.quantity_on_hand ?? 0), reorder_level: String(i.reorder_level ?? 0) },
        }));
    }

    case "off_schedule_clock_in": {
      if (!since) return [];
      const { data } = await db
        .from("time_entries")
        .select("id, staff_id, clock_in, is_off_schedule")
        .eq("business_id", biz.id)
        .eq("is_off_schedule", true)
        .gt("created_at", since)
        .lte("created_at", nowIso)
        .limit(2000);
      const staff = await staffById(db, (data ?? []).map((e: any) => String(e.staff_id)));
      return (data ?? []).map((e: any) =>
        staffSubject(ctx, biz, `time:${e.id}`, "off_schedule", staff.get(String(e.staff_id)), new Intl.DateTimeFormat("es-PR", { timeZone: biz.tz, hour: "numeric", minute: "2-digit" }).format(new Date(e.clock_in))),
      );
    }

    case "missed_clock_out": {
      const { data } = await db
        .from("time_entries")
        .select("id, staff_id, clock_in, clock_out")
        .eq("business_id", biz.id)
        .is("clock_out", null)
        .gte("clock_in", new Date(ctx.now.getTime() - 7 * 86_400_000).toISOString())
        .lt("clock_in", new Date(ctx.now.getTime() - 12 * 3_600_000).toISOString())
        .limit(500);
      const staff = await staffById(db, (data ?? []).map((e: any) => String(e.staff_id)));
      return (data ?? []).map((e: any) => staffSubject(ctx, biz, `time:${e.id}`, "missed_out", staff.get(String(e.staff_id)), displayDate(localYmd(e.clock_in, biz.tz))));
    }

    case "shift_change_request":
    case "time_edit_request": {
      if (!since) return [];
      const table = a.trigger_type === "shift_change_request" ? "staff_shift_change_requests" : "time_entry_edit_requests";
      const { data } = await db
        .from(table)
        .select("id, staff_id, reason, status")
        .eq("business_id", biz.id)
        .gt("created_at", since)
        .lte("created_at", nowIso)
        .limit(500);
      const staff = await staffById(db, (data ?? []).map((r: any) => String(r.staff_id)));
      return (data ?? []).map((r: any) => staffSubject(ctx, biz, `${table}:${r.id}`, "request", staff.get(String(r.staff_id)), r.reason ?? ""));
    }

    case "staff_birthday": {
      const m = Number(today.slice(5, 7));
      const d = Number(today.slice(8, 10));
      const { data } = await db
        .from("staff")
        .select("id, name, email, birth_month, birth_day, status")
        .eq("business_id", biz.id)
        .eq("birth_month", m)
        .eq("birth_day", d);
      return (data ?? []).filter((s: any) => s.status !== "inactive").map((s: any) => staffSubject(ctx, biz, `staff:${s.id}`, today.slice(0, 4), s, ""));
    }
  }
  return [];
}

/** Grumi-side triggers: one subject per business that matches. */
async function collectPlatformSubjects(ctx: EngineCtx, a: AutomationRow, today: string): Promise<Subject[]> {
  const db = ctx.db;
  const cfg = a.trigger_config ?? {};
  const def = triggerDef(a.trigger_type)!;
  const { data: businesses } = await db
    .from("businesses")
    .select("id, name, email, slug, subscription_status, trial_ends_at, onboarding_completed, owner_id, created_at")
    .limit(5000);
  const list = (businesses ?? []) as any[];
  const owners = new Map<string, any>();
  const ownerIds = list.map((b) => b.owner_id).filter(Boolean);
  if (ownerIds.length) {
    const { data } = await db.from("profiles").select("id, full_name, email").in("id", ownerIds);
    for (const p of data ?? []) owners.set(p.id, p);
  }
  const mk = (b: any, occurrence: string, extra: Record<string, string> = {}): Subject => ({
    key: `business:${b.id}`,
    occurrence,
    label: b.name,
    businessId: b.id,
    facts: {},
    values: { business_name: b.name, owner_name: owners.get(b.owner_id)?.full_name ?? "", today: displayDate(today), ...extra },
  });
  const days = Number(cfg.days ?? def.defaults.days ?? 3);
  switch (a.trigger_type) {
    case "trial_ending":
      return list
        .filter((b) => b.subscription_status === "trialing" && b.trial_ends_at && daysBetween(today, localYmd(b.trial_ends_at, PLATFORM_TZ)) === days)
        .map((b) => mk(b, `trial:${localYmd(b.trial_ends_at, PLATFORM_TZ)}`, { trial_ends: displayDate(localYmd(b.trial_ends_at, PLATFORM_TZ)), days_left: String(days) }));
    case "subscription_past_due": {
      const week = `${today.slice(0, 4)}-w${Math.floor(daysBetween(`${today.slice(0, 4)}-01-01`, today) / 7)}`;
      return list.filter((b) => ["past_due", "unpaid"].includes(String(b.subscription_status))).map((b) => mk(b, week));
    }
    case "onboarding_incomplete":
      return list.filter((b) => b.onboarding_completed === false && daysBetween(localYmd(b.created_at, PLATFORM_TZ), today) === days).map((b) => mk(b, "onboarding"));
    case "business_inactive": {
      const since = new Date(ctx.now.getTime() - days * 86_400_000).toISOString();
      const [{ data: appts }, { data: txns }] = await Promise.all([
        db.from("appointments").select("business_id").gte("created_at", since).limit(50000),
        db.from("transactions").select("business_id").gte("created_at", since).limit(50000),
      ]);
      const active = new Set([...(appts ?? []), ...(txns ?? [])].map((r: any) => r.business_id));
      return list.filter((b) => !active.has(b.id) && daysBetween(localYmd(b.created_at, PLATFORM_TZ), today) > days).map((b) => mk(b, today.slice(0, 7)));
    }
  }
  return [];
}

/* ------------------------------------------------------------------- people */

type Person = { email: string | null; profileId: string | null; name: string; staffId?: string | null };

async function resolveTeam(db: any, businessId: string, r: TeamRecipients | undefined, subject?: Subject): Promise<Person[]> {
  const out: Person[] = [];
  const recipients = r ?? { roles: ["manager"] };
  const [{ data: profiles }, { data: staff }] = await Promise.all([
    db.from("profiles").select("id, email, full_name, role, staff_id").eq("business_id", businessId),
    db.from("staff").select("id, name, email, access_role, user_id, status").eq("business_id", businessId),
  ]);
  const ps = (profiles ?? []) as any[];
  const ss = ((staff ?? []) as any[]).filter((s) => s.status !== "inactive");
  const profileForStaff = (s: any) => ps.find((p) => p.id === s.user_id || p.staff_id === s.id) ?? null;
  const personForStaff = (s: any): Person => {
    const p = profileForStaff(s);
    return { email: s.email ?? p?.email ?? null, profileId: p?.id ?? null, name: s.name ?? p?.full_name ?? "", staffId: String(s.id) };
  };
  for (const role of recipients.roles ?? []) {
    if (role === "manager") {
      for (const p of ps.filter((p) => p.role === "manager")) out.push({ email: p.email, profileId: p.id, name: p.full_name ?? "" });
      for (const s of ss.filter((s) => s.access_role === "manager")) out.push(personForStaff(s));
    } else {
      for (const s of ss.filter((s) => s.access_role === role)) out.push(personForStaff(s));
    }
  }
  for (const id of recipients.profile_ids ?? []) {
    const p = ps.find((x) => x.id === id);
    if (p) out.push({ email: p.email, profileId: p.id, name: p.full_name ?? "" });
  }
  for (const e of recipients.emails ?? []) if (isEmail(e)) out.push({ email: e.trim(), profileId: null, name: e.trim() });
  if (recipients.assigned_staff && subject?.staffId) {
    const s = ss.find((x) => String(x.id) === String(subject.staffId));
    if (s) out.push(personForStaff(s));
  }
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = (p.email ?? p.profileId ?? "").toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ------------------------------------------------------------------- coupons */

async function issueCoupon(ctx: EngineCtx, biz: BizCtx, a: AutomationRow, offerId: string, clientId: string | null, prefix: string, send: boolean) {
  const { data: offer } = await ctx.db
    .from("coupon_offers")
    .select("id, business_id, name, kind, value, service_id, product_id, code_mode, shared_code, valid_days, expires_on, active")
    .eq("id", offerId)
    .eq("business_id", biz.id)
    .maybeSingle();
  if (!offer || !offer.active) return null;
  let serviceName: string | null = null;
  let productName: string | null = null;
  if (offer.service_id) serviceName = (await ctx.db.from("services").select("name").eq("id", offer.service_id).maybeSingle()).data?.name ?? null;
  if (offer.product_id) productName = (await ctx.db.from("inventory").select("product_name").eq("id", offer.product_id).maybeSingle()).data?.product_name ?? null;
  const label = couponOfferLabel({ kind: offer.kind, value: offer.value, service_name: serviceName, product_name: productName }, ctx.lang);
  if (offer.code_mode === "shared") {
    return { code: offer.shared_code as string, label, expires: offer.expires_on ? displayDate(offer.expires_on) : "" };
  }
  const days = Number(offer.valid_days ?? 30);
  const expiresAt = new Date(ctx.now.getTime() + days * 86_400_000);
  const expires = displayDate(localYmd(expiresAt, biz.tz));
  if (!send) return { code: makeCouponCode(prefix), label, expires };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCouponCode(prefix);
    const { error } = await ctx.db.from("coupons").insert({
      business_id: biz.id,
      offer_id: offer.id,
      client_id: clientId,
      code,
      automation_id: a.id,
      expires_at: expiresAt.toISOString(),
    });
    if (!error) return { code, label, expires };
  }
  return null;
}

/* -------------------------------------------------------------------- run */

async function claim(ctx: EngineCtx, a: AutomationRow, s: Subject, recipient: string) {
  const { data, error } = await ctx.db
    .from("automation_runs")
    .insert({
      automation_id: a.id,
      business_id: s.businessId,
      pet_id: s.petId ?? null,
      client_id: s.clientId ?? null,
      subject_key: s.key,
      occurrence_key: s.occurrence,
      status: "sent",
      recipient,
    })
    .select("id")
    .single();
  return error || !data ? null : (data.id as string);
}

async function markFailed(ctx: EngineCtx, runId: string, detail: string) {
  await ctx.db.from("automation_runs").update({ status: "failed", detail: detail.slice(0, 500) }).eq("id", runId);
}

async function alreadySent(ctx: EngineCtx, a: AutomationRow, subjects: Subject[]): Promise<Set<string>> {
  const keys = [...new Set(subjects.map((s) => s.key))];
  const out = new Set<string>();
  for (let i = 0; i < keys.length; i += 300) {
    const { data } = await ctx.db
      .from("automation_runs")
      .select("subject_key, occurrence_key")
      .eq("automation_id", a.id)
      .eq("status", "sent")
      .in("subject_key", keys.slice(i, i + 300));
    for (const r of data ?? []) out.add(`${r.subject_key}|${r.occurrence_key}`);
  }
  // Legacy rows (first birthday automation) keyed by pet_id only.
  if (a.trigger_type === "pet_birthday") {
    const pets = subjects.map((s) => s.petId).filter(Boolean) as string[];
    if (pets.length) {
      const { data } = await ctx.db.from("automation_runs").select("pet_id, occurrence_key").eq("automation_id", a.id).eq("status", "sent").in("pet_id", pets);
      for (const r of data ?? []) out.add(`pet:${r.pet_id}|${r.occurrence_key}`);
    }
  }
  return out;
}

const FOOTER = (business: string, lang: "es" | "en") =>
  lang === "es"
    ? `Recibes este mensaje porque eres cliente de ${business}. Si no deseas recibir más, responde a este correo.`
    : `You're receiving this because you're a client of ${business}. Reply to this email to stop receiving these.`;

async function messageClient(ctx: EngineCtx, biz: BizCtx, a: AutomationRow, s: Subject, mode: Mode, out: Outcome) {
  const cfg = a.action_config ?? {};
  const { data: c } = await ctx.db
    .from("clients")
    .select("id, email, phone, first_name, last_name, contact_preference, marketing_email_opt_in, marketing_sms_opt_in, merged_into_client_id")
    .eq("id", s.clientId)
    .maybeSingle();
  const marketing = isMarketingMessage(a.trigger_type, !!cfg.coupon_offer_id);
  const email = c?.email?.trim() || null;
  const phone = c?.phone || null;
  const pref = (c?.contact_preference ?? "email") as string;
  const emailOk = !!c && !c.merged_into_client_id && pref !== "none" && isEmail(email) && (!marketing || c.marketing_email_opt_in === true);
  const smsOk = !!c && !c.merged_into_client_id && pref !== "none" && !!phone && !!ctx.env.twilio && (!marketing || c.marketing_sms_opt_in === true);
  const want = a.action_type === "email_owner" ? "email" : cfg.channel ?? "email";
  let channel: "email" | "sms" | null = null;
  if (want === "email") channel = emailOk ? "email" : null;
  else if (want === "sms") channel = smsOk ? "sms" : null;
  else channel = pref === "sms" && smsOk ? "sms" : emailOk ? "email" : smsOk ? "sms" : null;

  if (!channel) {
    out.skipped += 1;
    out.skipped_no_optin += 1;
    if (mode === "preview") out.preview.push({ label: s.label, recipient: email ?? phone ?? "—", channel: "—", note: marketing ? "no_optin" : "no_contact" });
    return;
  }
  const recipient = channel === "email" ? email! : phone!;
  if (mode === "preview") {
    out.preview.push({ label: s.label, recipient, channel });
    return;
  }

  const runId = await claim(ctx, a, s, recipient);
  if (!runId) {
    out.already_sent += 1;
    return;
  }
  const values = { ...s.values };
  if (cfg.coupon_offer_id && actionSupportsCoupon(a.action_type as any)) {
    const coupon = await issueCoupon(ctx, biz, a, cfg.coupon_offer_id, s.clientId ?? null, s.values.pet_name || s.values.owner_first_name || "", true);
    if (!coupon) {
      await markFailed(ctx, runId, "coupon_unavailable");
      out.failed += 1;
      return;
    }
    Object.assign(values, { coupon_code: coupon.code, coupon_offer: coupon.label, coupon_expires: coupon.expires });
  }
  let result;
  if (channel === "email") {
    const subject = fillPlaceholders(cfg.subject ?? a.name, values).trim() || a.name;
    const body = fillPlaceholders(cfg.body ?? "", values);
    const footer = FOOTER(biz.name, ctx.lang);
    result = await sendEmail(ctx.env, {
      fromName: senderName(biz.name),
      to: [email!],
      replyTo: biz.email,
      subject,
      html: messageHtml(body, biz.name, footer),
      text: `${body}\n\n${footer}`,
    });
  } else {
    const body = fillPlaceholders(cfg.sms_body || cfg.body || "", values);
    result = await sendSms(ctx.env, phone!, `${body}\n${ctx.lang === "es" ? "Responde STOP para no recibir más." : "Reply STOP to opt out."}`);
  }
  if (result.ok) out.sent += 1;
  else {
    out.failed += 1;
    await markFailed(ctx, runId, result.detail);
  }
}

async function teamAction(ctx: EngineCtx, biz: BizCtx, a: AutomationRow, s: Subject, mode: Mode, out: Outcome) {
  const cfg = a.action_config ?? {};
  const people = await resolveTeam(ctx.db, biz.id, cfg.recipients, s);
  const subject = fillPlaceholders(cfg.subject ?? a.name, s.values).trim() || a.name;
  const body = fillPlaceholders(cfg.body ?? "", s.values);
  if (a.action_type === "notify_team") {
    const targets = people.filter((p) => p.profileId);
    if (mode === "preview") {
      for (const p of targets) out.preview.push({ label: s.label, recipient: p.name || p.email || "", channel: "app" });
      return;
    }
    if (!targets.length) return;
    const runId = await claim(ctx, a, s, targets.map((p) => p.name).join(", ").slice(0, 200));
    if (!runId) {
      out.already_sent += 1;
      return;
    }
    const { error } = await ctx.db.from("notifications").insert(
      targets.map((p) => ({
        user_id: p.profileId,
        business_id: biz.id,
        message: [subject, body].filter(Boolean).join(" — ").slice(0, 500),
        notification_type: "general",
        read: false,
        metadata: { automation_id: a.id },
      })),
    );
    if (error) {
      out.failed += 1;
      await markFailed(ctx, runId, error.message);
    } else out.sent += 1;
    return;
  }
  // email_team
  const emails = people.map((p) => p.email).filter(isEmail) as string[];
  if (mode === "preview") {
    for (const p of people) out.preview.push({ label: s.label, recipient: p.email ?? p.name, channel: "email" });
    return;
  }
  if (!emails.length) return;
  const runId = await claim(ctx, a, s, emails.join(", ").slice(0, 200));
  if (!runId) {
    out.already_sent += 1;
    return;
  }
  const result = await sendEmail(ctx.env, { fromName: "Grumi", to: emails, subject, html: messageHtml(body || subject, biz.name, null), text: body || subject });
  if (result.ok) out.sent += 1;
  else {
    out.failed += 1;
    await markFailed(ctx, runId, result.detail);
  }
}

async function reportAction(ctx: EngineCtx, biz: BizCtx, a: AutomationRow, s: Subject, mode: Mode, out: Outcome, testTo?: string) {
  const cfg = a.action_config ?? {};
  if (!cfg.report) return;
  const report = await buildReport(ctx.db, biz, cfg.report, { lang: ctx.lang });
  out.report = { columns: report.columns, headers: report.headers, rows: report.rows.slice(0, 200), total: report.total };
  const people = testTo ? [{ email: testTo, profileId: null, name: testTo } as Person] : await resolveTeam(ctx.db, biz.id, cfg.recipients, s);
  const personal = !testTo && cfg.recipients?.assigned_staff && cfg.report.source === "appointments";
  const subject = fillPlaceholders(cfg.subject ?? a.name, s.values).trim() || a.name;
  const intro = fillPlaceholders(
    cfg.body || (ctx.lang === "es" ? "Adjunto el reporte en CSV (ábrelo con Excel o Google Sheets)." : "The report is attached as CSV (opens in Excel or Google Sheets)."),
    s.values,
  );
  const filename = `${biz.slug ?? "grumi"}-${cfg.report.source}-${biz.today}.csv`;
  const send = async (to: string[], r: BuiltReport, label: string) => {
    if (!to.length || r.total === 0) return;
    if (mode === "preview") {
      for (const e of to) out.preview.push({ label, recipient: e, channel: "email", note: `${r.total}` });
      return;
    }
    const runId = testTo ? null : await claim(ctx, a, { ...s, key: `report:${label}`, occurrence: biz.today }, to.join(", ").slice(0, 200));
    if (!testTo && !runId) {
      out.already_sent += 1;
      return;
    }
    const csv = toCsv(r.rows, r.columns, r.headers);
    const result = await sendEmail(ctx.env, {
      fromName: "Grumi",
      to,
      subject: testTo ? `[Prueba] ${subject}` : subject,
      html: messageHtml(intro, biz.name, null, tableHtml(r.columns, r.headers, r.rows)),
      text: intro,
      attachments: [{ filename, content: base64Utf8(csv) }],
    });
    if (result.ok) out.sent += 1;
    else {
      out.failed += 1;
      if (runId) await markFailed(ctx, runId, result.detail);
    }
  };
  if (personal) {
    const others = people.filter((p) => !p.staffId);
    // Every groomer with appointments gets their own list.
    const { data: staff } = await ctx.db.from("staff").select("id, name, email, user_id, status").eq("business_id", biz.id);
    for (const st of (staff ?? []).filter((x: any) => x.status !== "inactive" && isEmail(x.email))) {
      const mine = await buildReport(ctx.db, biz, cfg.report, { lang: ctx.lang, onlyStaffId: String(st.id) });
      await send([st.email], mine, `staff:${st.id}`);
    }
    await send(others.map((p) => p.email).filter(isEmail) as string[], report, "all");
  } else {
    await send(people.map((p) => p.email).filter(isEmail) as string[], report, "all");
  }
}

async function businessAction(ctx: EngineCtx, a: AutomationRow, s: Subject, mode: Mode, out: Outcome) {
  const cfg = a.action_config ?? {};
  const { data: b } = await ctx.db.from("businesses").select("id, email, owner_id").eq("id", s.businessId).maybeSingle();
  let ownerEmail: string | null = null;
  if (b?.owner_id) ownerEmail = (await ctx.db.from("profiles").select("email").eq("id", b.owner_id).maybeSingle()).data?.email ?? null;
  const to = [...new Set([b?.email, ownerEmail].filter(isEmail) as string[])];
  if (a.action_type === "notify_team") {
    // Grumi team: in-app notice to super admins.
    const { data: admins } = await ctx.db.from("profiles").select("id, full_name, business_id").eq("is_super_admin", true);
    const subject = fillPlaceholders(cfg.subject ?? a.name, s.values);
    if (mode === "preview") {
      out.preview.push({ label: s.label, recipient: (admins ?? []).map((x: any) => x.full_name).join(", "), channel: "app" });
      return;
    }
    const runId = await claim(ctx, a, s, "super_admins");
    if (!runId) return void (out.already_sent += 1);
    const rows = (admins ?? []).filter((x: any) => x.business_id).map((x: any) => ({
      user_id: x.id,
      business_id: x.business_id,
      message: `${subject} — ${s.label}`.slice(0, 500),
      notification_type: "general",
      read: false,
      metadata: { automation_id: a.id, business_id: s.businessId },
    }));
    if (rows.length) await ctx.db.from("notifications").insert(rows);
    out.sent += 1;
    return;
  }
  if (!to.length) {
    out.skipped += 1;
    if (mode === "preview") out.preview.push({ label: s.label, recipient: "—", channel: "—", note: "no_contact" });
    return;
  }
  if (mode === "preview") {
    out.preview.push({ label: s.label, recipient: to.join(", "), channel: "email" });
    return;
  }
  const runId = await claim(ctx, a, s, to.join(", "));
  if (!runId) return void (out.already_sent += 1);
  const subject = fillPlaceholders(cfg.subject ?? a.name, s.values);
  const body = fillPlaceholders(cfg.body ?? "", s.values);
  const result = await sendEmail(ctx.env, { fromName: "Grumi", to, subject, html: messageHtml(body, "Grumi", null), text: body });
  if (result.ok) out.sent += 1;
  else {
    out.failed += 1;
    await markFailed(ctx, runId, result.detail);
  }
}

/* ------------------------------------------------------------------ entry */

/** Should a run (cron) process this automation now? Returns the event window start for event triggers. */
export function dueNow(a: AutomationRow, tz: string, now: Date, pay?: BizCtx["pay"]): { due: boolean; since: string | null } {
  const def = triggerDef(a.trigger_type);
  if (!def) return { due: false, since: null };
  if (def.kind === "event") return { due: !!a.event_cursor, since: a.event_cursor };
  const lastDay = a.last_run_at ? localYmd(a.last_run_at, tz) : null;
  return { due: scheduleDue(a.schedule ?? {}, localNow(now, tz), lastDay, { kind: def.kind, pay: pay ?? undefined }), since: null };
}

/**
 * Run, preview or test one automation.
 * - run: only if due (cron) unless `force`; sends and logs; updates last_run_at / event_cursor.
 * - preview: who/what it would hit now (event triggers look back 7 days), nothing sent.
 * - test: one sample message to `testTo` (reports: the real report).
 */
export async function runAutomation(ctx: EngineCtx, a: AutomationRow, mode: Mode, opts: { force?: boolean; testTo?: string } = {}): Promise<Outcome> {
  const out = blank();
  const def = triggerDef(a.trigger_type);
  if (!def) return { ...out, detail: "unknown_trigger" };

  // Which businesses this automation covers.
  let businessIds: string[] = [];
  if (def.scope === "platform") businessIds = [];
  else if (a.business_id) businessIds = [a.business_id];
  else {
    // Legacy Grumi-wide client automation: every business that hasn't switched it off.
    const [{ data: all }, { data: off }] = await Promise.all([
      ctx.db.from("businesses").select("id"),
      ctx.db.from("business_automation_settings").select("business_id").eq("automation_id", a.id).eq("enabled", false),
    ]);
    const offSet = new Set((off ?? []).map((r: any) => r.business_id));
    businessIds = (all ?? []).map((b: any) => b.id).filter((id: string) => !offSet.has(id));
  }

  const nowIso = ctx.now.toISOString();

  if (mode === "test") {
    out.ran = true;
    if (!opts.testTo) return { ...out, detail: "no_test_recipient" };
    const biz = a.business_id ? await loadBiz(ctx.db, a.business_id, ctx.now) : null;
    const name = biz?.name ?? "Grumi";
    const values = { ...SAMPLE_PLACEHOLDER_VALUES, business_name: name, ...(biz ? baseValues(ctx, biz) : {}) };
    if (a.action_type === "send_report" && biz) {
      await reportAction(ctx, biz, a, { key: "test", occurrence: "test", label: "test", businessId: biz.id, facts: {}, values }, "test", out, opts.testTo);
      return out;
    }
    const cfg = a.action_config ?? {};
    const subject = `[Prueba] ${fillPlaceholders(cfg.subject ?? a.name, values)}`;
    const body = fillPlaceholders(cfg.body || cfg.sms_body || "", values);
    const result = await sendEmail(ctx.env, {
      fromName: biz ? senderName(name) : "Grumi",
      to: [opts.testTo],
      subject,
      html: messageHtml(body, name, a.action_type === "message_client" || a.action_type === "email_owner" ? FOOTER(name, ctx.lang) : null),
      text: body,
    });
    await ctx.db.from("automation_runs").insert({
      automation_id: a.id,
      business_id: a.business_id,
      occurrence_key: `test-${nowIso}`,
      status: "test",
      recipient: opts.testTo,
      detail: result.ok ? null : result.detail,
    });
    if (result.ok) out.sent = 1;
    else {
      out.failed = 1;
      out.detail = result.detail;
    }
    return out;
  }

  const process = async (biz: BizCtx | null, subjects: Subject[]) => {
    const filtered = subjects.filter((s) => conditionsMatch(a.conditions, { ...s.facts, weekday: localNow(ctx.now, biz?.tz ?? PLATFORM_TZ).weekday }));
    const sentBefore = mode === "preview" ? await alreadySent(ctx, a, filtered) : new Set<string>();
    for (const s of filtered) {
      if (mode === "preview" && sentBefore.has(`${s.key}|${s.occurrence}`)) {
        out.already_sent += 1;
        continue;
      }
      if (def.scope === "platform") await businessAction(ctx, a, s, mode, out);
      else if (a.action_type === "message_client" || a.action_type === "email_owner") await messageClient(ctx, biz!, a, s, mode, out);
      else if (a.action_type === "send_report") await reportAction(ctx, biz!, a, s, mode, out);
      else await teamAction(ctx, biz!, a, s, mode, out);
    }
  };

  if (def.scope === "platform") {
    const today = ymdKey(localNow(ctx.now, PLATFORM_TZ));
    if (mode === "run" && !opts.force && !dueNow(a, PLATFORM_TZ, ctx.now).due) return out;
    out.ran = true;
    await process(null, await collectPlatformSubjects(ctx, a, today));
    if (mode === "run") await ctx.db.from("automations").update({ last_run_at: nowIso }).eq("id", a.id);
    return out;
  }

  // Event triggers start watching from the moment they're first seen (no backfill).
  if (mode === "run" && def.kind === "event" && !a.event_cursor) {
    await ctx.db.from("automations").update({ event_cursor: nowIso }).eq("id", a.id);
    return out;
  }

  for (const id of businessIds) {
    const biz = await loadBiz(ctx.db, id, ctx.now);
    if (!biz) continue;
    let since: string | null = null;
    if (mode === "run") {
      const d = dueNow(a, biz.tz, ctx.now, biz.pay);
      if (!d.due && !opts.force) continue;
      since = d.since ?? new Date(ctx.now.getTime() - 86_400_000).toISOString();
    } else {
      since = new Date(ctx.now.getTime() - 7 * 86_400_000).toISOString();
    }
    out.ran = true;
    await process(biz, await collectBusinessSubjects(ctx, biz, a, since));
  }

  if (mode === "run" && out.ran) {
    const patch: Record<string, string> = { last_run_at: nowIso };
    if (def.kind === "event") patch.event_cursor = nowIso;
    await ctx.db.from("automations").update(patch).eq("id", a.id);
  }
  return out;
}
