// Report building for the send_report action (and the builder's "see it now" / download).
// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped service-role queries (no generated types for Deno) */
import {
  columnLabel,
  couponOfferLabel,
  groupRows,
  localYmd,
  normalizeAppointmentStatus,
  resolveRange,
  sourceDef,
  zonedDayStartUtc,
  addDays,
  type ReportRow,
  type ReportSpec,
} from "./catalog.ts";

export type BizCtx = {
  id: string;
  name: string;
  email: string | null;
  slug: string | null;
  tz: string;
  today: string;
  pay: { anchor: string | null; cadenceWeeks: number | null };
};

export type BuiltReport = { columns: string[]; headers: Record<string, string>; rows: ReportRow[]; total: number };

const MAX_ROWS = 5000;
const money = (cents: number | null | undefined) => Math.round(Number(cents ?? 0)) / 100;
const fullName = (c: { first_name?: string | null; last_name?: string | null } | null | undefined) =>
  [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim();

async function mapBy(db: any, table: string, cols: string, ids: string[], key = "id"): Promise<Map<string, any>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const out = new Map<string, any>();
  for (let i = 0; i < unique.length; i += 300) {
    const { data } = await db.from(table).select(cols).in(key, unique.slice(i, i + 300));
    for (const row of data ?? []) out.set(String(row[key]), row);
  }
  return out;
}

/** Rows for one report. `onlyStaffId` narrows appointment rows to one groomer (personal daily agenda). */
export async function buildReport(db: any, biz: BizCtx, spec: ReportSpec, opts: { onlyStaffId?: string; lang?: "es" | "en" } = {}): Promise<BuiltReport> {
  const def = sourceDef(spec.source);
  if (!def) throw new Error("unknown_source");
  const lang = opts.lang ?? "es";
  const columns = (spec.columns?.length ? spec.columns : def.defaultColumns).filter((c) => def.columns.some((d) => d.key === c));
  const range = def.dated ? resolveRange(spec.date_range ?? def.defaultRange, biz.today, biz.pay) : { from: null, to: null };
  const f = spec.filters ?? {};
  const rows: ReportRow[] = [];

  const fromUtc = range.from ? zonedDayStartUtc(range.from, biz.tz) : null;
  const toUtc = range.to ? zonedDayStartUtc(addDays(range.to, 1), biz.tz) : null;

  switch (spec.source) {
    case "appointments": {
      let q = db
        .from("appointments")
        .select("id, appointment_date, start_time, status, service_type, service_ids, total_price, price, booking_source, billed, transaction_id, notes, staff_id, client_id, pet_id")
        .eq("business_id", biz.id)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(MAX_ROWS);
      if (range.from) q = q.gte("appointment_date", range.from);
      if (range.to) q = q.lte("appointment_date", range.to);
      const { data } = await q;
      let list = (data ?? []) as any[];
      const statuses = f.statuses ?? [];
      if (statuses.includes("completed_unbilled")) {
        list = list.filter((a) => normalizeAppointmentStatus(a.status) === "completed" && !a.billed && !a.transaction_id);
      } else if (statuses.length) {
        list = list.filter((a) => statuses.includes(normalizeAppointmentStatus(a.status)));
      } else {
        list = list.filter((a) => !["canceled", "no_show"].includes(normalizeAppointmentStatus(a.status)));
      }
      if (f.staff_ids?.length) list = list.filter((a) => f.staff_ids!.includes(String(a.staff_id)));
      if (opts.onlyStaffId) list = list.filter((a) => String(a.staff_id) === opts.onlyStaffId);
      if (f.service_ids?.length)
        list = list.filter((a) => (a.service_ids ?? []).some((id: string) => f.service_ids!.includes(String(id))));
      const [clients, pets, staff] = await Promise.all([
        mapBy(db, "clients", "id, first_name, last_name, phone", list.map((a) => a.client_id)),
        mapBy(db, "pets", "id, name, breed, species", list.map((a) => a.pet_id)),
        mapBy(db, "staff", "id, name", list.map((a) => a.staff_id)),
      ]);
      if (f.species?.length) list = list.filter((a) => f.species!.includes(pets.get(String(a.pet_id))?.species));
      for (const a of list) {
        const c = clients.get(String(a.client_id));
        const p = pets.get(String(a.pet_id));
        rows.push({
          date: a.appointment_date,
          time: String(a.start_time ?? "").slice(0, 5),
          client: fullName(c),
          phone: c?.phone ?? "",
          pet: p?.name ?? "",
          breed: p?.breed ?? "",
          services: a.service_type ?? "",
          groomer: staff.get(String(a.staff_id))?.name ?? "",
          status: normalizeAppointmentStatus(a.status),
          price: Number(a.total_price ?? a.price ?? 0),
          booking_source: a.booking_source ?? "",
          billed: a.billed || a.transaction_id ? "✓" : "",
          notes: a.notes ?? "",
        });
      }
      break;
    }
    case "sales":
    case "sale_items": {
      let q = db
        .from("transactions")
        .select("id, created_at, transaction_number, customer_id, staff_id, payment_method, subtotal, discount_amount, tax_snapshot, tip_amount, total, status, is_test")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: true })
        .limit(MAX_ROWS);
      if (fromUtc) q = q.gte("created_at", fromUtc);
      if (toUtc) q = q.lt("created_at", toUtc);
      const { data } = await q;
      let list = ((data ?? []) as any[]).filter((t) => !t.is_test);
      if (f.staff_ids?.length) list = list.filter((t) => f.staff_ids!.includes(String(t.staff_id)));
      if (f.payment_methods?.length) list = list.filter((t) => f.payment_methods!.includes(String(t.payment_method)));
      if (spec.source === "sales") {
        const [clients, profiles] = await Promise.all([
          mapBy(db, "clients", "id, first_name, last_name", list.map((t) => t.customer_id)),
          mapBy(db, "profiles", "id, full_name, email", list.map((t) => t.staff_id)),
        ]);
        for (const t of list) {
          const tax = Array.isArray(t.tax_snapshot) ? t.tax_snapshot.reduce((s: number, x: any) => s + Number(x?.amount ?? 0), 0) : 0;
          rows.push({
            date: localYmd(t.created_at, biz.tz),
            number: t.transaction_number ?? "",
            client: fullName(clients.get(String(t.customer_id))) || (lang === "es" ? "Sin cliente" : "Walk-in"),
            staff: profiles.get(String(t.staff_id))?.full_name ?? profiles.get(String(t.staff_id))?.email ?? "",
            payment_method: t.payment_method ?? "",
            subtotal: money(t.subtotal),
            discount: money(t.discount_amount),
            tax: money(tax),
            tip: money(t.tip_amount),
            total: money(t.total),
            status: t.status ?? "",
          });
        }
      } else {
        const byId = new Map(list.map((t) => [t.id, t]));
        const ids = list.map((t) => t.id);
        for (let i = 0; i < ids.length; i += 300) {
          const { data: items } = await db
            .from("transaction_line_items")
            .select("transaction_id, type, name, quantity, unit_price, line_total")
            .in("transaction_id", ids.slice(i, i + 300));
          for (const li of items ?? []) {
            const t = byId.get(li.transaction_id);
            rows.push({
              date: t ? localYmd(t.created_at, biz.tz) : "",
              number: t?.transaction_number ?? "",
              item: li.name,
              type: li.type,
              quantity: Number(li.quantity ?? 0),
              unit_price: money(li.unit_price),
              line_total: money(li.line_total),
            });
          }
        }
      }
      break;
    }
    case "clients": {
      let q = db
        .from("clients")
        .select("id, first_name, last_name, email, phone, city, created_at, marketing_email_opt_in, marketing_sms_opt_in")
        .eq("business_id", biz.id)
        .is("merged_into_client_id", null)
        .order("first_name", { ascending: true })
        .limit(MAX_ROWS);
      if (f.marketing_opt_in_only) q = q.or("marketing_email_opt_in.eq.true,marketing_sms_opt_in.eq.true");
      const { data } = await q;
      const list = (data ?? []) as any[];
      const [{ data: pets }, { data: appts }, { data: txns }] = await Promise.all([
        db.from("pets").select("client_id, name").eq("business_id", biz.id).limit(20000),
        db.from("appointments").select("client_id, appointment_date, status").eq("business_id", biz.id).eq("status", "completed").limit(50000),
        db.from("transactions").select("customer_id, total, is_test").eq("business_id", biz.id).limit(50000),
      ]);
      const petsBy = new Map<string, string[]>();
      for (const p of pets ?? []) petsBy.set(String(p.client_id), [...(petsBy.get(String(p.client_id)) ?? []), p.name]);
      const visits = new Map<string, { n: number; last: string }>();
      for (const a of appts ?? []) {
        const k = String(a.client_id);
        const v = visits.get(k) ?? { n: 0, last: "" };
        v.n += 1;
        if (String(a.appointment_date) > v.last) v.last = String(a.appointment_date);
        visits.set(k, v);
      }
      const spent = new Map<string, number>();
      for (const t of txns ?? []) if (!t.is_test) spent.set(String(t.customer_id), (spent.get(String(t.customer_id)) ?? 0) + Number(t.total ?? 0));
      for (const c of list) {
        rows.push({
          name: fullName(c),
          email: c.email ?? "",
          phone: c.phone ?? "",
          city: c.city ?? "",
          pets: (petsBy.get(c.id) ?? []).join(", "),
          last_visit: visits.get(c.id)?.last ?? "",
          visits: visits.get(c.id)?.n ?? 0,
          total_spent: money(spent.get(c.id) ?? 0),
          created: localYmd(c.created_at, biz.tz),
          email_opt_in: c.marketing_email_opt_in ? "✓" : "",
          sms_opt_in: c.marketing_sms_opt_in ? "✓" : "",
        });
      }
      break;
    }
    case "pets": {
      const { data } = await db
        .from("pets")
        .select("id, name, species, breed, client_id, birth_month, birth_day, birth_year")
        .eq("business_id", biz.id)
        .order("name", { ascending: true })
        .limit(MAX_ROWS);
      let list = (data ?? []) as any[];
      if (f.species?.length) list = list.filter((p) => f.species!.includes(p.species));
      const clients = await mapBy(db, "clients", "id, first_name, last_name, phone", list.map((p) => p.client_id));
      const { data: appts } = await db
        .from("appointments")
        .select("pet_id, appointment_date")
        .eq("business_id", biz.id)
        .eq("status", "completed")
        .limit(50000);
      const last = new Map<string, string>();
      for (const a of appts ?? []) if (String(a.appointment_date) > (last.get(String(a.pet_id)) ?? "")) last.set(String(a.pet_id), String(a.appointment_date));
      for (const p of list) {
        const c = clients.get(String(p.client_id));
        rows.push({
          name: p.name,
          species: p.species ?? "",
          breed: p.breed ?? "",
          owner: fullName(c),
          phone: c?.phone ?? "",
          birthday: p.birth_month ? `${p.birth_day ? `${p.birth_day}/` : ""}${p.birth_month}${p.birth_year ? `/${p.birth_year}` : ""}` : "",
          last_visit: last.get(String(p.id)) ?? "",
        });
      }
      break;
    }
    case "inventory": {
      const { data } = await db
        .from("inventory")
        .select("product_name, sku, category, quantity_on_hand, reorder_level, cost_price, retail_price, supplier, is_active")
        .eq("business_id", biz.id)
        .order("product_name", { ascending: true })
        .limit(MAX_ROWS);
      let list = ((data ?? []) as any[]).filter((i) => i.is_active !== false);
      if (f.below_reorder_only) list = list.filter((i) => Number(i.quantity_on_hand ?? 0) <= Number(i.reorder_level ?? 0));
      for (const i of list) {
        rows.push({
          product: i.product_name,
          sku: i.sku ?? "",
          category: i.category ?? "",
          quantity: Number(i.quantity_on_hand ?? 0),
          reorder_level: Number(i.reorder_level ?? 0),
          cost: Number(i.cost_price ?? 0),
          retail: Number(i.retail_price ?? 0),
          supplier: i.supplier ?? "",
        });
      }
      break;
    }
    case "time_entries": {
      let q = db
        .from("time_entries")
        .select("staff_id, clock_in, clock_out, is_off_schedule, lunch_deduction_hours")
        .eq("business_id", biz.id)
        .order("clock_in", { ascending: true })
        .limit(MAX_ROWS);
      if (fromUtc) q = q.gte("clock_in", fromUtc);
      if (toUtc) q = q.lt("clock_in", toUtc);
      const { data } = await q;
      let list = (data ?? []) as any[];
      if (f.staff_ids?.length) list = list.filter((e) => f.staff_ids!.includes(String(e.staff_id)));
      const staff = await mapBy(db, "staff", "id, name", list.map((e) => e.staff_id));
      const hm = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { timeZone: biz.tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
      for (const e of list) {
        const hours = e.clock_out
          ? Math.max(0, (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3_600_000 - Number(e.lunch_deduction_hours ?? 0))
          : 0;
        rows.push({
          staff: staff.get(String(e.staff_id))?.name ?? "",
          date: localYmd(e.clock_in, biz.tz),
          clock_in: hm(e.clock_in),
          clock_out: hm(e.clock_out),
          hours: Math.round(hours * 100) / 100,
          off_schedule: e.is_off_schedule ? "✓" : "",
        });
      }
      break;
    }
    case "follow_ups": {
      const { data } = await db.rpc("follow_up_candidates", { p_business_id: biz.id });
      let list = (data ?? []) as any[];
      if (f.species?.length) list = list.filter((r) => f.species!.includes(r.species));
      if (f.staff_ids?.length) {
        const staff = await mapBy(db, "staff", "id, name", f.staff_ids);
        const names = new Set([...staff.values()].map((s) => s.name));
        list = list.filter((r) => names.has(r.usual_groomer));
      }
      for (const r of list) {
        rows.push({
          client: r.client_name ?? "",
          phone: r.phone ?? "",
          contact_preference: r.contact_preference ?? "",
          pet: r.pet_name ?? "",
          breed: r.breed ?? "",
          last_visit: r.last_visit ?? "",
          weeks_since: Number(r.weeks_since ?? 0),
          usual_service: r.usual_service ?? "",
          usual_groomer: r.usual_groomer ?? "",
          last_contact: r.last_outcome ? `${r.last_outcome} ${r.last_contact_at ? localYmd(r.last_contact_at, biz.tz) : ""}`.trim() : "",
        });
      }
      break;
    }
    case "coupons": {
      let q = db
        .from("coupons")
        .select("id, code, offer_id, client_id, issued_at, expires_at, status, redeemed_at")
        .eq("business_id", biz.id)
        .order("issued_at", { ascending: false })
        .limit(MAX_ROWS);
      if (fromUtc) q = q.gte("issued_at", fromUtc);
      if (toUtc) q = q.lt("issued_at", toUtc);
      const { data } = await q;
      const list = (data ?? []) as any[];
      const [offers, clients, redemptions] = await Promise.all([
        mapBy(db, "coupon_offers", "id, name, kind, value", list.map((c) => c.offer_id)),
        mapBy(db, "clients", "id, first_name, last_name", list.map((c) => c.client_id)),
        mapBy(db, "coupon_redemptions", "coupon_id, discount_cents", list.map((c) => c.id), "coupon_id"),
      ]);
      for (const c of list) {
        const o = offers.get(String(c.offer_id));
        rows.push({
          code: c.code,
          offer: o ? `${o.name} (${couponOfferLabel(o, lang)})` : "",
          client: fullName(clients.get(String(c.client_id))),
          issued: localYmd(c.issued_at, biz.tz),
          expires: c.expires_at ? localYmd(c.expires_at, biz.tz) : "",
          status: c.status,
          redeemed: c.redeemed_at ? localYmd(c.redeemed_at, biz.tz) : "",
          discount: money(redemptions.get(String(c.id))?.discount_cents ?? 0),
        });
      }
      break;
    }
  }

  const numeric = new Set(def.columns.filter((c) => c.numeric).map((c) => c.key));
  const grouped = spec.group_by && columns.includes(spec.group_by);
  const outColumns = grouped ? [spec.group_by!, "count", ...columns.filter((c) => c !== spec.group_by && numeric.has(c))] : columns;
  const finalRows = groupRows(rows, columns, spec.group_by, numeric);
  const headers: Record<string, string> = {};
  for (const c of outColumns) headers[c] = columnLabel(c, lang);
  return { columns: outColumns, headers, rows: finalRows, total: rows.length };
}
