// Shared catalog for automations: triggers, actions, report sources, templates and schedule helpers.
// Pure TypeScript (no Deno, no Supabase, no React) so the Edge Function, the web app and Vitest all import it.
// The web app imports this file directly; keep it free of runtime dependencies.

/* ------------------------------------------------------------------ triggers */

export type BusinessTriggerType =
  | "schedule"
  | "pet_birthday"
  | "client_inactive"
  | "grooming_due"
  | "appointment_before"
  | "appointment_after"
  | "appointment_status"
  | "booking_request"
  | "new_client"
  | "new_pet"
  | "sale_completed"
  | "refund_issued"
  | "payment_failed"
  | "low_stock"
  | "off_schedule_clock_in"
  | "missed_clock_out"
  | "shift_change_request"
  | "time_edit_request"
  | "staff_birthday";

export type PlatformTriggerType =
  | "trial_ending"
  | "subscription_past_due"
  | "business_inactive"
  | "onboarding_incomplete";

export type TriggerType = BusinessTriggerType | PlatformTriggerType;

/** What a trigger fires "about": decides which placeholders and which recipients make sense. */
export type TriggerSubject =
  | "none"
  | "pet"
  | "client"
  | "appointment"
  | "transaction"
  | "product"
  | "staff"
  | "business";

/**
 * How the engine decides when a trigger is checked:
 * - schedule: on the automation's schedule (daily / weekly / monthly / pay period at a time)
 * - daily: once a day at the automation's time (date-based rules like birthdays)
 * - event: every engine tick (about every 15 minutes), for records created/changed since the last check
 */
export type TriggerKind = "schedule" | "daily" | "event";

export type TriggerConfigField = "days" | "weeks" | "status" | "min_amount";

export type TriggerDef = {
  type: TriggerType;
  scope: "business" | "platform";
  kind: TriggerKind;
  subject: TriggerSubject;
  /** Who the subject's messages can reach. */
  clientFacing: boolean;
  fields: TriggerConfigField[];
  defaults: Partial<Record<TriggerConfigField, number | string>>;
};

export const APPOINTMENT_STATUSES = ["confirmed", "completed", "canceled", "no_show"] as const;
export type AppointmentStatusTrigger = (typeof APPOINTMENT_STATUSES)[number];

export const TRIGGERS: TriggerDef[] = [
  { type: "schedule", scope: "business", kind: "schedule", subject: "none", clientFacing: false, fields: [], defaults: {} },
  { type: "pet_birthday", scope: "business", kind: "daily", subject: "pet", clientFacing: true, fields: [], defaults: {} },
  { type: "client_inactive", scope: "business", kind: "daily", subject: "client", clientFacing: true, fields: ["days"], defaults: { days: 90 } },
  { type: "grooming_due", scope: "business", kind: "daily", subject: "pet", clientFacing: true, fields: ["weeks"], defaults: { weeks: 6 } },
  { type: "appointment_before", scope: "business", kind: "daily", subject: "appointment", clientFacing: true, fields: ["days"], defaults: { days: 3 } },
  { type: "appointment_after", scope: "business", kind: "daily", subject: "appointment", clientFacing: true, fields: ["days"], defaults: { days: 1 } },
  { type: "appointment_status", scope: "business", kind: "event", subject: "appointment", clientFacing: true, fields: ["status"], defaults: { status: "no_show" } },
  { type: "booking_request", scope: "business", kind: "event", subject: "appointment", clientFacing: true, fields: [], defaults: {} },
  { type: "new_client", scope: "business", kind: "event", subject: "client", clientFacing: true, fields: [], defaults: {} },
  { type: "new_pet", scope: "business", kind: "event", subject: "pet", clientFacing: true, fields: [], defaults: {} },
  { type: "sale_completed", scope: "business", kind: "event", subject: "transaction", clientFacing: true, fields: ["min_amount"], defaults: { min_amount: 0 } },
  { type: "refund_issued", scope: "business", kind: "event", subject: "transaction", clientFacing: false, fields: [], defaults: {} },
  { type: "payment_failed", scope: "business", kind: "event", subject: "transaction", clientFacing: false, fields: [], defaults: {} },
  { type: "low_stock", scope: "business", kind: "event", subject: "product", clientFacing: false, fields: [], defaults: {} },
  { type: "off_schedule_clock_in", scope: "business", kind: "event", subject: "staff", clientFacing: false, fields: [], defaults: {} },
  { type: "missed_clock_out", scope: "business", kind: "daily", subject: "staff", clientFacing: false, fields: [], defaults: {} },
  { type: "shift_change_request", scope: "business", kind: "event", subject: "staff", clientFacing: false, fields: [], defaults: {} },
  { type: "time_edit_request", scope: "business", kind: "event", subject: "staff", clientFacing: false, fields: [], defaults: {} },
  { type: "staff_birthday", scope: "business", kind: "daily", subject: "staff", clientFacing: false, fields: [], defaults: {} },
  // Grumi's own (admin portal) automations: they message the business, never its clients.
  { type: "trial_ending", scope: "platform", kind: "daily", subject: "business", clientFacing: false, fields: ["days"], defaults: { days: 3 } },
  { type: "subscription_past_due", scope: "platform", kind: "daily", subject: "business", clientFacing: false, fields: [], defaults: {} },
  { type: "business_inactive", scope: "platform", kind: "daily", subject: "business", clientFacing: false, fields: ["days"], defaults: { days: 30 } },
  { type: "onboarding_incomplete", scope: "platform", kind: "daily", subject: "business", clientFacing: false, fields: ["days"], defaults: { days: 3 } },
];

export function triggerDef(type: string): TriggerDef | undefined {
  return TRIGGERS.find((t) => t.type === type);
}

export const BUSINESS_TRIGGERS = TRIGGERS.filter((t) => t.scope === "business");
export const PLATFORM_TRIGGERS = TRIGGERS.filter((t) => t.scope === "platform");

/* ------------------------------------------------------------------- actions */

export type ActionType =
  | "message_client"
  | "email_team"
  | "notify_team"
  | "send_report"
  | "email_business"
  /** Legacy (first automation): same as message_client by email. */
  | "email_owner";

export type MessageChannel = "email" | "sms" | "preferred";

/** Who on the team receives a team email / in-app notice / report. */
export type TeamRecipients = {
  /** Profile ids of people in the business. */
  profile_ids?: string[];
  /** Everyone with this role in the business. */
  roles?: ("manager" | "admin" | "staff")[];
  /** Extra addresses (reports only). */
  emails?: string[];
  /** The groomer assigned to the appointment (appointment triggers / daily agenda). */
  assigned_staff?: boolean;
};

export type ActionConfig = {
  // message_client / email_team / email_business
  channel?: MessageChannel;
  subject?: string;
  body?: string;
  sms_body?: string;
  /** Optional gift: a coupon offer of the business, issued per client (unique code) or shared code. */
  coupon_offer_id?: string | null;
  // team actions and reports
  recipients?: TeamRecipients;
  // send_report
  report?: ReportSpec;
};

export function actionsForTrigger(type: TriggerType): ActionType[] {
  const def = triggerDef(type);
  if (!def) return [];
  if (def.scope === "platform") return ["email_business", "notify_team"];
  if (type === "schedule") return ["send_report", "email_team", "notify_team"];
  const base: ActionType[] = def.clientFacing ? ["message_client"] : [];
  return [...base, "email_team", "notify_team"];
}

/**
 * Client messages for these triggers are promotional: they only go to clients who accepted marketing
 * (email or SMS opt-in for that channel). The rest are service messages about the client's own appointment.
 * A message that carries a coupon is always treated as promotional.
 */
export const MARKETING_TRIGGERS: TriggerType[] = [
  "pet_birthday",
  "client_inactive",
  "grooming_due",
  "appointment_after",
  "new_client",
  "new_pet",
  "sale_completed",
];

export function isMarketingMessage(type: TriggerType, hasCoupon: boolean): boolean {
  return hasCoupon || MARKETING_TRIGGERS.includes(type);
}

/** Gifts only make sense for client messages. */
export function actionSupportsCoupon(action: ActionType): boolean {
  return action === "message_client" || action === "email_owner";
}

/* -------------------------------------------------------------- placeholders */

export const PLACEHOLDERS_BY_SUBJECT: Record<TriggerSubject, string[]> = {
  none: ["business_name", "today"],
  pet: ["pet_name", "pet_age", "owner_first_name", "owner_name", "business_name", "booking_link", "coupon_code", "coupon_offer", "coupon_expires"],
  client: ["owner_first_name", "owner_name", "pet_names", "last_visit", "business_name", "booking_link", "coupon_code", "coupon_offer", "coupon_expires"],
  appointment: ["owner_first_name", "owner_name", "pet_name", "appointment_date", "appointment_time", "service", "groomer", "business_name", "booking_link", "coupon_code", "coupon_offer", "coupon_expires"],
  transaction: ["owner_first_name", "owner_name", "sale_total", "sale_number", "business_name", "coupon_code", "coupon_offer", "coupon_expires"],
  product: ["product_name", "quantity", "reorder_level", "business_name"],
  staff: ["staff_name", "detail", "business_name"],
  business: ["business_name", "owner_name", "trial_ends", "days_left"],
};

export const SAMPLE_PLACEHOLDER_VALUES: Record<string, string> = {
  pet_name: "Luna",
  pet_age: "3",
  pet_names: "Luna, Max",
  owner_first_name: "Ana",
  owner_name: "Ana Rivera",
  business_name: "Pawsome Grooming",
  booking_link: "https://grumi.pet/pawsome/reservar",
  coupon_code: "LUNA-7K2P",
  coupon_offer: "10% de descuento",
  coupon_expires: "30/11/2026",
  last_visit: "12/07/2026",
  appointment_date: "15/10/2026",
  appointment_time: "10:00 AM",
  service: "Baño completo",
  groomer: "Carla",
  sale_total: "$65.00",
  sale_number: "1042",
  product_name: "Champú hipoalergénico",
  quantity: "2",
  reorder_level: "5",
  staff_name: "Carla",
  detail: "",
  trial_ends: "20/10/2026",
  days_left: "3",
  today: "10/10/2026",
};

/** Replaces {{placeholder}} tokens; unknown tokens are left as typed. */
export function fillPlaceholders(template: string, values: Record<string, string>): string {
  return (template ?? "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => (key in values ? values[key] : match));
}

/* --------------------------------------------------------------- conditions */

export type ConditionField =
  | "species"
  | "service_id"
  | "staff_id"
  | "booking_source"
  | "min_amount"
  | "max_amount"
  | "weekday"
  | "is_new_client";

export type Condition = { field: ConditionField; op: "eq" | "in" | "gte" | "lte"; value: string | number | boolean | string[] };

export const CONDITIONS_BY_SUBJECT: Record<TriggerSubject, ConditionField[]> = {
  none: ["weekday"],
  pet: ["species", "weekday"],
  client: ["weekday"],
  appointment: ["species", "service_id", "staff_id", "booking_source", "is_new_client", "weekday"],
  transaction: ["min_amount", "max_amount", "staff_id", "weekday"],
  product: ["weekday"],
  staff: ["staff_id", "weekday"],
  business: [],
};

export type ConditionFacts = Partial<{
  species: string | null;
  service_ids: string[];
  staff_id: string | null;
  booking_source: string | null;
  amount: number | null;
  weekday: number;
  is_new_client: boolean;
}>;

/** True when every condition holds for the facts. Missing facts never match a condition. */
export function conditionsMatch(conditions: Condition[] | null | undefined, facts: ConditionFacts): boolean {
  for (const c of conditions ?? []) {
    const values = Array.isArray(c.value) ? c.value.map(String) : [String(c.value)];
    switch (c.field) {
      case "species":
        if (!facts.species || !values.includes(facts.species)) return false;
        break;
      case "service_id":
        if (!facts.service_ids?.some((id) => values.includes(String(id)))) return false;
        break;
      case "staff_id":
        if (!facts.staff_id || !values.includes(String(facts.staff_id))) return false;
        break;
      case "booking_source":
        if (!facts.booking_source || !values.includes(facts.booking_source)) return false;
        break;
      case "min_amount":
        if (facts.amount == null || facts.amount < Number(c.value)) return false;
        break;
      case "max_amount":
        if (facts.amount == null || facts.amount > Number(c.value)) return false;
        break;
      case "weekday":
        if (facts.weekday == null || !values.includes(String(facts.weekday))) return false;
        break;
      case "is_new_client":
        if (facts.is_new_client == null || facts.is_new_client !== (String(c.value) === "true")) return false;
        break;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ schedule */

export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "pay_period";

export type Schedule = {
  frequency?: ScheduleFrequency;
  /** "HH:MM", business local time. Daily-kind triggers use only this. */
  time?: string;
  /** 0 = Sunday … 6 = Saturday (weekly). */
  weekday?: number;
  /** 1–28, or 31 for "last day of the month" (monthly). */
  monthday?: number;
};

export type LocalNow = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

export function localNow(now: Date, timeZone: string): LocalNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

export function ymdKey(d: { year: number; month: number; day: number }): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function parseTime(time: string | undefined, fallback = "09:00"): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? fallback).trim()) ?? /^(\d{1,2}):(\d{2})$/.exec(fallback)!;
  return { h: Math.min(23, Number(match[1])), m: Math.min(59, Number(match[2])) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Whole days from a (YYYY-MM-DD) to b (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const pa = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const pb = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((pb - pa) / 86_400_000);
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type PaySchedule = { anchor?: string | null; cadenceWeeks?: number | null };

/**
 * Is a scheduled run due now? Due once per occurrence: today is an occurrence day, the local time has
 * reached the scheduled time, and the last run (local date) isn't today.
 * `lastRunLocalDay` is the YYYY-MM-DD (business time) of the last run, or null.
 */
export function scheduleDue(
  schedule: Schedule | null | undefined,
  now: LocalNow,
  lastRunLocalDay: string | null,
  opts: { kind: TriggerKind; pay?: PaySchedule } = { kind: "schedule" },
): boolean {
  const s = schedule ?? {};
  const today = ymdKey(now);
  if (lastRunLocalDay === today) return false;
  const { h, m } = parseTime(s.time);
  if (now.hour * 60 + now.minute < h * 60 + m) return false;
  if (opts.kind === "daily") return true;
  switch (s.frequency ?? "daily") {
    case "daily":
      return true;
    case "weekly":
      return now.weekday === (s.weekday ?? 1);
    case "monthly": {
      const want = s.monthday ?? 1;
      const last = daysInMonth(now.year, now.month);
      return now.day === Math.min(want, last);
    }
    case "pay_period": {
      // The day after a pay period ends: anchor + k * cadence weeks (anchor = first day of a period).
      const anchor = opts.pay?.anchor;
      const cadence = Math.max(1, Number(opts.pay?.cadenceWeeks ?? 2));
      if (!anchor) return now.weekday === 1;
      const diff = daysBetween(anchor.slice(0, 10), today);
      return diff > 0 && diff % (cadence * 7) === 0;
    }
  }
  return false;
}

/* ------------------------------------------------------------------- reports */

export type ReportSource =
  | "appointments"
  | "sales"
  | "sale_items"
  | "clients"
  | "pets"
  | "inventory"
  | "time_entries"
  | "follow_ups"
  | "coupons";

export type DateRange =
  | "today"
  | "yesterday"
  | "tomorrow"
  | "next_7_days"
  | "this_week"
  | "last_week"
  | "last_7_days"
  | "this_month"
  | "last_month"
  | "last_30_days"
  | "last_pay_period"
  | "all";

export type ReportFilters = Partial<{
  staff_ids: string[];
  service_ids: string[];
  statuses: string[];
  payment_methods: string[];
  species: string[];
  below_reorder_only: boolean;
  marketing_opt_in_only: boolean;
}>;

export type ReportSpec = {
  source: ReportSource;
  columns: string[];
  date_range?: DateRange;
  filters?: ReportFilters;
  group_by?: string | null;
  format?: "csv";
};

export type ColumnDef = { key: string; numeric?: boolean; money?: boolean };

export type SourceDef = {
  source: ReportSource;
  /** Date ranges apply to this field; null = no date filter. */
  dated: boolean;
  defaultRange: DateRange;
  columns: ColumnDef[];
  defaultColumns: string[];
  filters: (keyof ReportFilters)[];
};

export const REPORT_SOURCES: SourceDef[] = [
  {
    source: "appointments",
    dated: true,
    defaultRange: "tomorrow",
    columns: [
      { key: "date" }, { key: "time" }, { key: "client" }, { key: "phone" }, { key: "pet" }, { key: "breed" },
      { key: "services" }, { key: "groomer" }, { key: "status" }, { key: "price", numeric: true, money: true },
      { key: "booking_source" }, { key: "billed" }, { key: "notes" },
    ],
    defaultColumns: ["date", "time", "client", "phone", "pet", "services", "groomer", "status"],
    filters: ["staff_ids", "service_ids", "statuses", "species"],
  },
  {
    source: "sales",
    dated: true,
    defaultRange: "last_week",
    columns: [
      { key: "date" }, { key: "number" }, { key: "client" }, { key: "staff" }, { key: "payment_method" },
      { key: "subtotal", numeric: true, money: true }, { key: "discount", numeric: true, money: true },
      { key: "tax", numeric: true, money: true }, { key: "tip", numeric: true, money: true },
      { key: "total", numeric: true, money: true }, { key: "status" },
    ],
    defaultColumns: ["date", "number", "client", "staff", "payment_method", "total", "tip"],
    filters: ["staff_ids", "payment_methods"],
  },
  {
    source: "sale_items",
    dated: true,
    defaultRange: "last_week",
    columns: [
      { key: "date" }, { key: "number" }, { key: "item" }, { key: "type" }, { key: "quantity", numeric: true },
      { key: "unit_price", numeric: true, money: true }, { key: "line_total", numeric: true, money: true },
    ],
    defaultColumns: ["date", "item", "type", "quantity", "line_total"],
    filters: [],
  },
  {
    source: "clients",
    dated: false,
    defaultRange: "all",
    columns: [
      { key: "name" }, { key: "email" }, { key: "phone" }, { key: "city" }, { key: "pets" }, { key: "last_visit" },
      { key: "visits", numeric: true }, { key: "total_spent", numeric: true, money: true }, { key: "created" },
      { key: "email_opt_in" }, { key: "sms_opt_in" },
    ],
    defaultColumns: ["name", "phone", "email", "pets", "last_visit", "total_spent"],
    filters: ["marketing_opt_in_only"],
  },
  {
    source: "pets",
    dated: false,
    defaultRange: "all",
    columns: [
      { key: "name" }, { key: "species" }, { key: "breed" }, { key: "owner" }, { key: "phone" }, { key: "birthday" },
      { key: "last_visit" },
    ],
    defaultColumns: ["name", "species", "breed", "owner", "phone", "last_visit"],
    filters: ["species"],
  },
  {
    source: "inventory",
    dated: false,
    defaultRange: "all",
    columns: [
      { key: "product" }, { key: "sku" }, { key: "category" }, { key: "quantity", numeric: true },
      { key: "reorder_level", numeric: true }, { key: "cost", numeric: true, money: true },
      { key: "retail", numeric: true, money: true }, { key: "supplier" },
    ],
    defaultColumns: ["product", "sku", "quantity", "reorder_level", "supplier"],
    filters: ["below_reorder_only"],
  },
  {
    source: "time_entries",
    dated: true,
    defaultRange: "last_pay_period",
    columns: [
      { key: "staff" }, { key: "date" }, { key: "clock_in" }, { key: "clock_out" }, { key: "hours", numeric: true },
      { key: "off_schedule" },
    ],
    defaultColumns: ["staff", "date", "clock_in", "clock_out", "hours"],
    filters: ["staff_ids"],
  },
  {
    source: "follow_ups",
    dated: false,
    defaultRange: "all",
    columns: [
      { key: "client" }, { key: "phone" }, { key: "contact_preference" }, { key: "pet" }, { key: "breed" },
      { key: "last_visit" }, { key: "weeks_since", numeric: true }, { key: "usual_service" }, { key: "usual_groomer" },
      { key: "last_contact" },
    ],
    defaultColumns: ["client", "phone", "pet", "last_visit", "weeks_since", "usual_service", "usual_groomer", "last_contact"],
    filters: ["staff_ids", "species"],
  },
  {
    source: "coupons",
    dated: true,
    defaultRange: "last_30_days",
    columns: [
      { key: "code" }, { key: "offer" }, { key: "client" }, { key: "issued" }, { key: "expires" }, { key: "status" },
      { key: "redeemed" }, { key: "discount", numeric: true, money: true },
    ],
    defaultColumns: ["code", "offer", "client", "issued", "status", "redeemed", "discount"],
    filters: [],
  },
];

/** Column headers (es/en), shared by the report email, the CSV and the builder. */
export const COLUMN_LABELS: Record<string, { es: string; en: string }> = {
  date: { es: "Fecha", en: "Date" },
  time: { es: "Hora", en: "Time" },
  client: { es: "Cliente", en: "Client" },
  phone: { es: "Teléfono", en: "Phone" },
  email: { es: "Correo", en: "Email" },
  pet: { es: "Mascota", en: "Pet" },
  breed: { es: "Raza", en: "Breed" },
  species: { es: "Especie", en: "Species" },
  services: { es: "Servicios", en: "Services" },
  groomer: { es: "Groomer", en: "Groomer" },
  status: { es: "Estado", en: "Status" },
  price: { es: "Precio", en: "Price" },
  booking_source: { es: "Origen", en: "Source" },
  billed: { es: "Cobrada", en: "Billed" },
  notes: { es: "Notas", en: "Notes" },
  number: { es: "Venta #", en: "Sale #" },
  staff: { es: "Empleado", en: "Staff" },
  payment_method: { es: "Método de pago", en: "Payment method" },
  subtotal: { es: "Subtotal", en: "Subtotal" },
  discount: { es: "Descuento", en: "Discount" },
  tax: { es: "IVU", en: "Tax" },
  tip: { es: "Propina", en: "Tip" },
  total: { es: "Total", en: "Total" },
  item: { es: "Artículo", en: "Item" },
  type: { es: "Tipo", en: "Type" },
  quantity: { es: "Cantidad", en: "Quantity" },
  unit_price: { es: "Precio unitario", en: "Unit price" },
  line_total: { es: "Total línea", en: "Line total" },
  name: { es: "Nombre", en: "Name" },
  city: { es: "Ciudad", en: "City" },
  pets: { es: "Mascotas", en: "Pets" },
  last_visit: { es: "Última visita", en: "Last visit" },
  visits: { es: "Visitas", en: "Visits" },
  total_spent: { es: "Total gastado", en: "Total spent" },
  created: { es: "Creado", en: "Created" },
  email_opt_in: { es: "Acepta correos", en: "Email opt-in" },
  sms_opt_in: { es: "Acepta SMS", en: "SMS opt-in" },
  owner: { es: "Dueño", en: "Owner" },
  birthday: { es: "Cumpleaños", en: "Birthday" },
  product: { es: "Producto", en: "Product" },
  sku: { es: "SKU", en: "SKU" },
  category: { es: "Categoría", en: "Category" },
  reorder_level: { es: "Nivel de reorden", en: "Reorder level" },
  cost: { es: "Costo", en: "Cost" },
  retail: { es: "Precio venta", en: "Retail" },
  supplier: { es: "Suplidor", en: "Supplier" },
  clock_in: { es: "Entrada", en: "Clock in" },
  clock_out: { es: "Salida", en: "Clock out" },
  hours: { es: "Horas", en: "Hours" },
  off_schedule: { es: "Fuera de horario", en: "Off schedule" },
  contact_preference: { es: "Prefiere", en: "Prefers" },
  weeks_since: { es: "Semanas", en: "Weeks" },
  usual_service: { es: "Servicio usual", en: "Usual service" },
  usual_groomer: { es: "Groomer usual", en: "Usual groomer" },
  last_contact: { es: "Último contacto", en: "Last contact" },
  code: { es: "Código", en: "Code" },
  offer: { es: "Oferta", en: "Offer" },
  issued: { es: "Emitido", en: "Issued" },
  expires: { es: "Vence", en: "Expires" },
  redeemed: { es: "Usado", en: "Redeemed" },
  count: { es: "Cantidad", en: "Count" },
};

export function columnLabel(key: string, lang: "es" | "en" = "es"): string {
  return COLUMN_LABELS[key]?.[lang] ?? key;
}

export function sourceDef(source: string): SourceDef | undefined {
  return REPORT_SOURCES.find((s) => s.source === source);
}

export const DATE_RANGES: DateRange[] = [
  "today", "yesterday", "tomorrow", "next_7_days", "this_week", "last_week", "last_7_days",
  "this_month", "last_month", "last_30_days", "last_pay_period", "all",
];

/** Resolve a relative range to inclusive YYYY-MM-DD bounds (business local dates). Weeks start Monday. */
export function resolveRange(range: DateRange | undefined, today: string, pay?: PaySchedule): { from: string | null; to: string | null } {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const mondayOffset = (weekday + 6) % 7;
  const y = Number(today.slice(0, 4));
  const mo = Number(today.slice(5, 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (range ?? "all") {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "tomorrow":
      return { from: addDays(today, 1), to: addDays(today, 1) };
    case "next_7_days":
      return { from: today, to: addDays(today, 6) };
    case "this_week":
      return { from: addDays(today, -mondayOffset), to: addDays(today, 6 - mondayOffset) };
    case "last_week":
      return { from: addDays(today, -mondayOffset - 7), to: addDays(today, -mondayOffset - 1) };
    case "last_7_days":
      return { from: addDays(today, -7), to: addDays(today, -1) };
    case "this_month":
      return { from: monthStart, to: `${today.slice(0, 7)}-${String(daysInMonth(y, mo)).padStart(2, "0")}` };
    case "last_month": {
      const py = mo === 1 ? y - 1 : y;
      const pm = mo === 1 ? 12 : mo - 1;
      const prefix = `${py}-${String(pm).padStart(2, "0")}`;
      return { from: `${prefix}-01`, to: `${prefix}-${String(daysInMonth(py, pm)).padStart(2, "0")}` };
    }
    case "last_30_days":
      return { from: addDays(today, -30), to: addDays(today, -1) };
    case "last_pay_period": {
      const cadenceDays = Math.max(1, Number(pay?.cadenceWeeks ?? 2)) * 7;
      if (!pay?.anchor) return { from: addDays(today, -cadenceDays), to: addDays(today, -1) };
      const diff = daysBetween(pay.anchor.slice(0, 10), today);
      const periodsDone = Math.floor(diff / cadenceDays);
      const currentStart = addDays(pay.anchor.slice(0, 10), periodsDone * cadenceDays);
      return { from: addDays(currentStart, -cadenceDays), to: addDays(currentStart, -1) };
    }
    case "all":
      return { from: null, to: null };
  }
  return { from: null, to: null };
}

export type ReportRow = Record<string, string | number | null>;

/** Group rows by one column, summing numeric columns; adds a final total row. */
export function groupRows(rows: ReportRow[], columns: string[], groupBy: string | null | undefined, numericKeys: Set<string>): ReportRow[] {
  const sumInto = (acc: ReportRow, row: ReportRow) => {
    for (const c of columns) {
      if (numericKeys.has(c)) acc[c] = Math.round(((Number(acc[c] ?? 0) || 0) + (Number(row[c] ?? 0) || 0)) * 100) / 100;
    }
  };
  if (!groupBy || !columns.includes(groupBy)) {
    if (!columns.some((c) => numericKeys.has(c)) || rows.length === 0) return rows;
    const total: ReportRow = { [columns[0]]: "TOTAL" };
    rows.forEach((r) => sumInto(total, r));
    return [...rows, total];
  }
  const groups = new Map<string, ReportRow>();
  for (const row of rows) {
    const key = String(row[groupBy] ?? "—");
    const acc = groups.get(key) ?? { [groupBy]: key, count: 0 };
    acc.count = Number(acc.count) + 1;
    sumInto(acc, row);
    groups.set(key, acc);
  }
  const out = [...groups.values()];
  const total: ReportRow = { [groupBy]: "TOTAL", count: rows.length };
  rows.forEach((r) => sumInto(total, r));
  return [...out, total];
}

export function toCsv(rows: ReportRow[], columns: string[], headers: Record<string, string>): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Excel formula injection guard + quoting.
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = columns.map((c) => esc(headers[c] ?? c)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\r\n");
  // BOM so Excel opens UTF-8 (accents) correctly.
  return `\uFEFF${head}\r\n${body}`;
}

/* ----------------------------------------------------------------- templates */

export type AutomationTemplate = {
  key: string;
  trigger_type: BusinessTriggerType;
  trigger_config: Record<string, number | string>;
  action_type: ActionType;
  action_config: ActionConfig;
  schedule: Schedule;
  /** Suggest attaching a coupon offer (pet birthday, win-back, welcome). */
  suggestsCoupon?: boolean;
};

export const TEMPLATES: AutomationTemplate[] = [
  {
    key: "pet_birthday_gift",
    trigger_type: "pet_birthday",
    trigger_config: {},
    action_type: "message_client",
    action_config: {
      channel: "preferred",
      subject: "¡Feliz cumpleaños, {{pet_name}}! 🎉",
      body:
        "Hola {{owner_first_name}},\n\n¡{{pet_name}} está de cumpleaños! Todo el equipo de {{business_name}} le desea un día lleno de mimos.\n\nTe regalamos {{coupon_offer}} con el código {{coupon_code}} (válido hasta {{coupon_expires}}). Úsalo al reservar: {{booking_link}}\n\n¡Un abrazo!\n{{business_name}}",
      sms_body: "¡Feliz cumpleaños a {{pet_name}}! {{business_name}} te regala {{coupon_offer}}: código {{coupon_code}}. Reserva: {{booking_link}}",
    },
    schedule: { time: "09:00" },
    suggestsCoupon: true,
  },
  {
    key: "win_back_gift",
    trigger_type: "client_inactive",
    trigger_config: { days: 90 },
    action_type: "message_client",
    action_config: {
      channel: "preferred",
      subject: "¡Te extrañamos en {{business_name}}!",
      body:
        "Hola {{owner_first_name}},\n\nHace tiempo no vemos a {{pet_names}}. Queremos consentirlos de nuevo: te regalamos {{coupon_offer}} con el código {{coupon_code}} (válido hasta {{coupon_expires}}).\n\nReserva aquí: {{booking_link}}\n\n{{business_name}}",
      sms_body: "{{business_name}}: ¡te extrañamos! {{coupon_offer}} con el código {{coupon_code}}. Reserva: {{booking_link}}",
    },
    schedule: { time: "10:00" },
    suggestsCoupon: true,
  },
  {
    key: "grooming_due_link",
    trigger_type: "grooming_due",
    trigger_config: { weeks: 6 },
    action_type: "message_client",
    action_config: {
      channel: "preferred",
      subject: "Es hora del próximo arreglo de {{pet_name}}",
      body:
        "Hola {{owner_first_name}},\n\nYa toca el próximo arreglo de {{pet_name}}. Reserva cuando te convenga: {{booking_link}}\n\n{{business_name}}",
      sms_body: "{{business_name}}: ya toca el arreglo de {{pet_name}}. Reserva: {{booking_link}}",
    },
    schedule: { time: "10:00" },
  },
  {
    key: "grooming_due_call_list",
    trigger_type: "schedule",
    trigger_config: {},
    action_type: "send_report",
    action_config: {
      subject: "Clientes para llamar ({{today}})",
      recipients: { roles: ["manager", "admin"] },
      report: { source: "follow_ups", columns: sourceDef("follow_ups")!.defaultColumns, date_range: "all" },
    },
    schedule: { frequency: "weekly", weekday: 1, time: "08:00" },
  },
  {
    key: "post_visit_thanks",
    trigger_type: "appointment_after",
    trigger_config: { days: 1 },
    action_type: "message_client",
    action_config: {
      channel: "preferred",
      subject: "¡Gracias por visitarnos, {{owner_first_name}}!",
      body:
        "Hola {{owner_first_name}},\n\nGracias por traer a {{pet_name}} a {{business_name}}. Esperamos que haya quedado feliz. Si tienes un minuto, nos encantaría saber tu opinión.\n\n{{business_name}}",
      sms_body: "¡Gracias por traer a {{pet_name}} a {{business_name}}! Nos encantaría saber tu opinión.",
    },
    schedule: { time: "11:00" },
  },
  {
    key: "no_show_follow_up",
    trigger_type: "appointment_status",
    trigger_config: { status: "no_show" },
    action_type: "message_client",
    action_config: {
      channel: "preferred",
      subject: "Te esperábamos hoy",
      body: "Hola {{owner_first_name}},\n\nHoy no pudimos ver a {{pet_name}}. ¿Quieres reprogramar? Reserva aquí: {{booking_link}}\n\n{{business_name}}",
      sms_body: "{{business_name}}: hoy no pudimos ver a {{pet_name}}. ¿Reprogramamos? {{booking_link}}",
    },
    schedule: {},
  },
  {
    key: "welcome_new_client",
    trigger_type: "new_client",
    trigger_config: {},
    action_type: "message_client",
    action_config: {
      channel: "email",
      subject: "¡Bienvenido a {{business_name}}!",
      body:
        "Hola {{owner_first_name}},\n\n¡Gracias por elegirnos! Para tu próxima visita te regalamos {{coupon_offer}} con el código {{coupon_code}}.\n\nReserva aquí: {{booking_link}}\n\n{{business_name}}",
    },
    schedule: {},
    suggestsCoupon: true,
  },
  {
    key: "daily_agenda",
    trigger_type: "schedule",
    trigger_config: {},
    action_type: "send_report",
    action_config: {
      subject: "Tu agenda de hoy ({{today}})",
      recipients: { assigned_staff: true, roles: ["manager"] },
      report: { source: "appointments", columns: ["time", "client", "phone", "pet", "breed", "services", "notes"], date_range: "today" },
    },
    schedule: { frequency: "daily", time: "07:00" },
  },
  {
    key: "weekly_sales",
    trigger_type: "schedule",
    trigger_config: {},
    action_type: "send_report",
    action_config: {
      subject: "Resumen de ventas de la semana",
      recipients: { roles: ["manager"] },
      report: { source: "sales", columns: ["staff", "total", "tip", "discount"], date_range: "last_week", group_by: "staff" },
    },
    schedule: { frequency: "weekly", weekday: 1, time: "08:00" },
  },
  {
    key: "payroll_report",
    trigger_type: "schedule",
    trigger_config: {},
    action_type: "send_report",
    action_config: {
      subject: "Horas del período de pago",
      recipients: { roles: ["manager"] },
      report: { source: "time_entries", columns: ["staff", "hours"], date_range: "last_pay_period", group_by: "staff" },
    },
    schedule: { frequency: "pay_period", time: "08:00" },
  },
  {
    key: "low_stock_list",
    trigger_type: "schedule",
    trigger_config: {},
    action_type: "send_report",
    action_config: {
      subject: "Productos por reordenar",
      recipients: { roles: ["manager", "admin"] },
      report: { source: "inventory", columns: ["product", "sku", "quantity", "reorder_level", "supplier"], filters: { below_reorder_only: true } },
    },
    schedule: { frequency: "weekly", weekday: 5, time: "09:00" },
  },
  {
    key: "unbilled_appointments",
    trigger_type: "schedule",
    trigger_config: {},
    action_type: "send_report",
    action_config: {
      subject: "Citas completadas sin cobrar",
      recipients: { roles: ["manager"] },
      report: { source: "appointments", columns: ["date", "client", "pet", "services", "groomer", "price"], date_range: "last_7_days", filters: { statuses: ["completed_unbilled"] } },
    },
    schedule: { frequency: "daily", time: "18:00" },
  },
];

export function templateByKey(key: string | null | undefined): AutomationTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

/* ------------------------------------------------------------------- coupons */

export type CouponKind = "percent" | "amount" | "free_service" | "free_product";

export type CouponOfferLike = {
  kind: CouponKind;
  value: number | null;
  service_name?: string | null;
  product_name?: string | null;
};

/** Human label for an offer ("10% de descuento", "$5 de descuento", "Baño gratis"). */
export function couponOfferLabel(offer: CouponOfferLike, lang: "es" | "en" = "es"): string {
  const v = Number(offer.value ?? 0);
  switch (offer.kind) {
    case "percent":
      return lang === "es" ? `${v}% de descuento` : `${v}% off`;
    case "amount":
      return lang === "es" ? `$${v.toFixed(2).replace(/\.00$/, "")} de descuento` : `$${v.toFixed(2).replace(/\.00$/, "")} off`;
    case "free_service":
      return lang === "es" ? `${offer.service_name ?? "un servicio"} gratis` : `a free ${offer.service_name ?? "service"}`;
    case "free_product":
      return lang === "es" ? `${offer.product_name ?? "un producto"} de regalo` : `a free ${offer.product_name ?? "product"}`;
  }
}

/** Discount in cents for a sale, given the offer and the sale lines. Never more than the subtotal. */
export function couponDiscountCents(
  offer: { kind: CouponKind; value: number | null; service_id?: string | null; product_id?: string | null },
  lines: { type: "service" | "product"; reference_id: string; unit_price: number; line_total: number }[],
): number {
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  let cents = 0;
  switch (offer.kind) {
    case "percent":
      cents = Math.round((subtotal * Math.min(100, Math.max(0, Number(offer.value ?? 0)))) / 100);
      break;
    case "amount":
      cents = Math.round(Number(offer.value ?? 0) * 100);
      break;
    case "free_service": {
      const line = lines.find((l) => l.type === "service" && String(l.reference_id) === String(offer.service_id));
      cents = line ? line.unit_price : 0;
      break;
    }
    case "free_product": {
      const line = lines.find((l) => l.type === "product" && String(l.reference_id) === String(offer.product_id));
      cents = line ? line.unit_price : 0;
      break;
    }
  }
  return Math.max(0, Math.min(subtotal, cents));
}

/** Unique code like LUNA-7K2P: a readable prefix plus 4 characters without look-alikes (0/O, 1/I). */
export function makeCouponCode(prefix: string | null | undefined, random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const clean = (prefix ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  let tail = "";
  for (let i = 0; i < 6; i++) tail += alphabet[Math.floor(random() * alphabet.length)];
  return clean ? `${clean}-${tail}` : tail;
}

export function normalizeCouponCode(code: string): string {
  return (code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/* --------------------------------------------------------------- time zones */

/** UTC instant (ISO) of 00:00 local time on a business-local date. */
export function zonedDayStartUtc(ymd: string, timeZone: string): string {
  const guess = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)), 0, 0, 0);
  const local = localNow(new Date(guess), timeZone);
  const localMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  return new Date(guess - (localMs - guess)).toISOString();
}

/** Business-local YYYY-MM-DD of an instant. */
export function localYmd(instant: string | Date, timeZone: string): string {
  return ymdKey(localNow(typeof instant === "string" ? new Date(instant) : instant, timeZone));
}

export function safeTimeZone(tz: string | null | undefined, fallback = "America/Puerto_Rico"): string {
  const candidate = (tz ?? "").trim() || fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return fallback;
  }
}

/** DD/MM/YYYY for messages (Puerto Rico style). */
export function displayDate(ymd: string | null | undefined): string {
  if (!ymd || ymd.length < 10) return "";
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}

/** "14:30" or "14:30:00" -> "2:30 PM". */
export function displayTime(hhmm: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

export function normalizeAppointmentStatus(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase().replace(/-/g, "_");
  if (s === "cancelled") return "canceled";
  return s;
}
