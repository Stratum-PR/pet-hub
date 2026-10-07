// payments
// Card/ATH Móvil payments for Grumi. Uses the shared Stratum-PR/payment_methods package
// (vendored in ./lib by scripts/sync-payment-libs.sh).
//
// Staff actions (POST JSON { action, … }, signed-in user required, checked here):
//   settings_get                    any staff        → ATH Móvil status for the business
//   settings_save_ath               managers         → { mode: 'off'|'simulator'|'live', publicToken?, privateToken? }
//   ath_create                      any staff        → { amountCents, phone, appointmentId?, customerId?, description? }
//   ath_status / ath_cancel         any staff        → { paymentId }   (status also finalizes approved payments)
//   link_transaction                any staff        → { paymentId, transactionId }
//   unlinked_for_appointment        any staff        → { appointmentId }
//
// ATH Móvil notifications: POST ?webhook=<business webhook_key> (no JWT; ATH webhooks are unsigned, so the
// body is only used to find the payment, which is then re-checked with ATH Móvil before anything changes).
//
// Security: secrets (ATH private token, auth tokens) live only in service-role tables; the browser never sees
// them. Provider errors are logged in payments.last_error and returned to the browser only as short codes.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
// @deno-types="./lib/athmovil/index.d.ts"
import { AthMovilClient, athDetailsToResult, parseAthWebhook } from "./lib/athmovil/index.js";
// @deno-types="./lib/types.d.ts"
import { PaymentProviderError } from "./lib/types.js";

type Json = Record<string, unknown>;
type PaymentRow = {
  id: string;
  business_id: string;
  provider: string;
  mode: "live" | "simulator";
  provider_payment_id: string | null;
  status: string;
  amount_cents: number;
  amount_paid_cents: number | null;
  fee_cents: number | null;
  receipt_reference: string | null;
  phone_last4: string | null;
  appointment_id: string | null;
  customer_id: string | null;
  transaction_id: string | null;
  expires_at: string | null;
  updated_at: string;
  created_at: string;
};

const TERMINAL = new Set(["succeeded", "canceled", "expired", "failed", "refunded", "partially_refunded"]);
const PUBLIC_COLUMNS =
  "id, business_id, provider, mode, provider_payment_id, status, amount_cents, amount_paid_cents, fee_cents, receipt_reference, phone_last4, appointment_id, customer_id, transaction_id, expires_at, updated_at, created_at";

function cors(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers.get("Access-Control-Request-Headers") ??
        "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function reply(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req) } });
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Short, non-technical codes for the browser (it shows its own friendly text). */
function errorCode(e: unknown): string {
  if (e instanceof PaymentProviderError) {
    switch (e.code) {
      case "BTRA_0004":
      case "BTRA_0044":
      case "BTRA_0045":
        return "over_limit";
      case "BTRA_0001":
        return "under_minimum";
      case "BTRA_0002":
        return "customer_blocked";
      case "BTRA_0006":
        return "invalid_phone";
      case "BTRA_0009":
      case "BTRA_0010":
        return "business_inactive";
      case "BTRA_0401":
      case "BTRA_0403":
        return "invalid_credentials";
      case "BTRA_0039":
        return "expired";
    }
    return "provider_error";
  }
  if (e instanceof RangeError) return "invalid_input";
  return "provider_error";
}

function describe(e: unknown): string {
  if (e instanceof PaymentProviderError) return `${e.code ?? ""} ${e.status ?? ""} ${e.message}`.trim().slice(0, 500);
  return String(e).slice(0, 500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return reply(req, 405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) return reply(req, 500, { error: "server_misconfigured" });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const simBase = `${supabaseUrl}/functions/v1/athm-simulator`;
  const webhookUrl = (key: string) => `${supabaseUrl}/functions/v1/payments?webhook=${key}`;

  /** ATH Móvil client for a business in its current mode, or null when off/not configured. */
  async function athFor(businessId: string): Promise<{ client: AthMovilClient; mode: "live" | "simulator" } | null> {
    const [{ data: settings }, { data: secrets }] = await Promise.all([
      admin.from("business_payment_settings").select("athmovil_mode").eq("business_id", businessId).maybeSingle(),
      admin.from("business_payment_secrets").select("*").eq("business_id", businessId).maybeSingle(),
    ]);
    if (!settings || !secrets) return null;
    if (settings.athmovil_mode === "simulator" && secrets.athmovil_sim_public_token) {
      return {
        mode: "simulator",
        client: new AthMovilClient(
          { publicToken: secrets.athmovil_sim_public_token, privateToken: secrets.athmovil_sim_private_token ?? undefined },
          { baseUrl: `${simBase}/api/business-transaction/ecommerce`, webhookSubscribeUrl: `${simBase}/transactions/webhook/post` },
        ),
      };
    }
    if (settings.athmovil_mode === "live" && secrets.athmovil_public_token) {
      return {
        mode: "live",
        client: new AthMovilClient({ publicToken: secrets.athmovil_public_token, privateToken: secrets.athmovil_private_token ?? undefined }),
      };
    }
    return null;
  }

  /**
   * Bring a payment up to date with ATH Móvil. Finalizes (authorizes) once the customer approved.
   * A conditional status update acts as a lock so two pollers/webhooks never authorize twice.
   */
  async function refresh(row: PaymentRow): Promise<PaymentRow> {
    if (TERMINAL.has(row.status) || !row.provider_payment_id) return row;
    const stuck = row.status === "authorizing" && Date.now() - Date.parse(row.updated_at) < 60_000;
    if (stuck) return row;
    const ath = await athFor(row.business_id);
    if (!ath || ath.mode !== row.mode) return row;
    const { data: secret } = await admin.from("payment_secrets").select("auth_token").eq("payment_id", row.id).maybeSingle();
    const authToken: string | undefined = secret?.auth_token ?? undefined;

    let details;
    try {
      details = await ath.client.findPayment(row.provider_payment_id, authToken);
    } catch (e) {
      await admin.from("payments").update({ last_error: describe(e), updated_at: new Date().toISOString() }).eq("id", row.id);
      return row;
    }

    if (details.ecommerceStatus === "CONFIRM" && authToken) {
      const { data: locked } = await admin
        .from("payments")
        .update({ status: "authorizing", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .in("status", ["pending", "awaiting_capture", "authorizing"])
        .select("id")
        .maybeSingle();
      if (!locked) return (await loadRow(row.id)) ?? row;
      try {
        details = await ath.client.authorize(authToken);
      } catch (e) {
        await admin.from("payments").update({ status: "awaiting_capture", last_error: describe(e), updated_at: new Date().toISOString() }).eq("id", row.id);
        return (await loadRow(row.id)) ?? row;
      }
    }

    const result = athDetailsToResult(details);
    let status: string = result.status;
    if (status === "canceled" && row.expires_at && Date.now() >= Date.parse(row.expires_at) - 5_000) status = "expired";
    const patch: Json = { status, updated_at: new Date().toISOString() };
    if (result.amountPaid != null) patch.amount_paid_cents = result.amountPaid;
    if (result.fee != null && status === "succeeded") patch.fee_cents = result.fee;
    if (result.receiptReference) patch.receipt_reference = result.receiptReference;
    const { data: updated } = await admin.from("payments").update(patch).eq("id", row.id).select(PUBLIC_COLUMNS).maybeSingle();
    return (updated as PaymentRow) ?? row;
  }

  async function loadRow(id: string): Promise<PaymentRow | null> {
    const { data } = await admin.from("payments").select(PUBLIC_COLUMNS).eq("id", id).maybeSingle();
    return (data as PaymentRow) ?? null;
  }

  const publicRow = (r: PaymentRow) => ({
    id: r.id,
    status: r.status,
    mode: r.mode,
    amountCents: r.amount_cents,
    amountPaidCents: r.amount_paid_cents,
    receiptReference: r.receipt_reference,
    phoneLast4: r.phone_last4,
    expiresAt: r.expires_at,
    transactionId: r.transaction_id,
    appointmentId: r.appointment_id,
    createdAt: r.created_at,
  });

  // ---------- ATH Móvil notifications ----------
  const url = new URL(req.url);
  const webhookKey = url.searchParams.get("webhook");
  if (webhookKey) {
    try {
      const { data: owner } = await admin.from("business_payment_secrets").select("business_id").eq("webhook_key", webhookKey).maybeSingle();
      if (owner) {
        const evt = parseAthWebhook(await req.json().catch(() => ({})));
        if (evt.ecommerceId) {
          const { data: row } = await admin
            .from("payments")
            .select(PUBLIC_COLUMNS)
            .eq("business_id", owner.business_id)
            .eq("provider", "athmovil")
            .eq("provider_payment_id", evt.ecommerceId)
            .maybeSingle();
          if (row) await refresh(row as PaymentRow);
        }
      }
    } catch (e) {
      console.error("payments webhook", describe(e));
    }
    return reply(req, 200, { received: true });
  }

  // ---------- staff ----------
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(req, 401, { error: "unauthorized" });
  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: userData } = await userClient.auth.getUser(token);
  const user = userData?.user;
  if (!user) return reply(req, 401, { error: "unauthorized" });
  const { data: profile } = await admin.from("profiles").select("business_id, role, is_super_admin").eq("id", user.id).maybeSingle();
  if (!profile?.business_id || profile.role === "client") return reply(req, 403, { error: "forbidden" });
  const businessId: string = profile.business_id;
  const isManager = profile.role === "manager" || profile.role === "super_admin" || !!profile.is_super_admin;

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return reply(req, 400, { error: "invalid_json" });
  }
  const action = String(body.action ?? "");

  async function ownRow(id: unknown): Promise<PaymentRow | null> {
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const row = await loadRow(id);
    return row && row.business_id === businessId ? row : null;
  }

  switch (action) {
    case "settings_get": {
      const { data: s } = await admin.from("business_payment_settings").select("*").eq("business_id", businessId).maybeSingle();
      return reply(req, 200, {
        canEdit: isManager,
        athmovil: {
          mode: s?.athmovil_mode ?? "off",
          last4: s?.athmovil_public_token_last4 ?? null,
          webhookSubscribed: !!s?.athmovil_webhook_subscribed,
        },
        stripe: { connected: !!s?.stripe_account_id, chargesEnabled: !!s?.stripe_charges_enabled },
      });
    }

    case "settings_save_ath": {
      if (!isManager) return reply(req, 403, { error: "forbidden" });
      const mode = String(body.mode ?? "");
      if (!["off", "simulator", "live"].includes(mode)) return reply(req, 400, { error: "invalid_input" });
      const now = new Date().toISOString();
      // Secrets row (holds the webhook key) always exists once a business touches payments.
      await admin.from("business_payment_secrets").upsert({ business_id: businessId }, { onConflict: "business_id", ignoreDuplicates: true });
      const { data: secrets } = await admin.from("business_payment_secrets").select("*").eq("business_id", businessId).single();

      if (mode === "off") {
        await admin.from("business_payment_settings").upsert({ business_id: businessId, athmovil_mode: "off", updated_at: now });
        return reply(req, 200, { ok: true });
      }

      if (mode === "simulator") {
        let pub = secrets.athmovil_sim_public_token as string | null;
        let priv = secrets.athmovil_sim_private_token as string | null;
        if (!pub || !priv) {
          pub = `sim_pub_${randomHex(16)}`;
          priv = `sim_priv_${randomHex(16)}`;
          const { data: biz } = await admin.from("businesses").select("name").eq("id", businessId).maybeSingle();
          await admin.from("athm_sim_businesses").insert({
            public_token: pub,
            private_token: priv,
            name: `${biz?.name ?? "Negocio"} (simulador)`,
            owner_business_id: businessId,
          });
          await admin.from("business_payment_secrets").update({ athmovil_sim_public_token: pub, athmovil_sim_private_token: priv, updated_at: now }).eq("business_id", businessId);
        }
        const client = new AthMovilClient(
          { publicToken: pub, privateToken: priv },
          { baseUrl: `${simBase}/api/business-transaction/ecommerce`, webhookSubscribeUrl: `${simBase}/transactions/webhook/post` },
        );
        let subscribed = true;
        try {
          await client.subscribeWebhooks(webhookUrl(secrets.webhook_key));
        } catch (e) {
          subscribed = false;
          console.error("simulator webhook subscribe", describe(e));
        }
        await admin.from("business_payment_settings").upsert({
          business_id: businessId,
          athmovil_mode: "simulator",
          athmovil_public_token_last4: "SIM",
          athmovil_webhook_subscribed: subscribed,
          updated_at: now,
        });
        return reply(req, 200, { ok: true });
      }

      // live
      const pub = String(body.publicToken ?? "").trim() || (secrets.athmovil_public_token as string | null) || "";
      const priv = String(body.privateToken ?? "").trim() || (secrets.athmovil_private_token as string | null) || "";
      if (!/^\S{8,200}$/.test(pub) || !/^\S{8,200}$/.test(priv)) return reply(req, 400, { error: "invalid_input" });
      // Subscribing the webhook needs both keys, so it doubles as a credentials check.
      try {
        await new AthMovilClient({ publicToken: pub, privateToken: priv }).subscribeWebhooks(webhookUrl(secrets.webhook_key));
      } catch (e) {
        console.error("live webhook subscribe", describe(e));
        return reply(req, 200, { ok: false, error: "invalid_credentials" });
      }
      await admin.from("business_payment_secrets").update({ athmovil_public_token: pub, athmovil_private_token: priv, updated_at: now }).eq("business_id", businessId);
      await admin.from("business_payment_settings").upsert({
        business_id: businessId,
        athmovil_mode: "live",
        athmovil_public_token_last4: pub.slice(-4),
        athmovil_webhook_subscribed: true,
        updated_at: now,
      });
      return reply(req, 200, { ok: true });
    }

    case "ath_create": {
      const amountCents = Number(body.amountCents);
      const phone = String(body.phone ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 150_000) return reply(req, 200, { error: "amount_out_of_range" });
      if (phone.length !== 10) return reply(req, 200, { error: "invalid_phone" });
      const ath = await athFor(businessId);
      if (!ath) return reply(req, 200, { error: "not_configured" });

      const appointmentId = typeof body.appointmentId === "string" && body.appointmentId ? body.appointmentId : null;
      const customerId = typeof body.customerId === "string" && /^[0-9a-f-]{36}$/i.test(body.customerId) ? body.customerId : null;
      const description = String(body.description ?? "").trim().slice(0, 60) || "Servicio";
      const { data: biz } = await admin.from("businesses").select("name").eq("id", businessId).maybeSingle();

      const { data: row, error: insErr } = await admin
        .from("payments")
        .insert({
          business_id: businessId,
          provider: "athmovil",
          mode: ath.mode,
          status: "pending",
          amount_cents: amountCents,
          phone_last4: phone.slice(-4),
          appointment_id: appointmentId,
          customer_id: customerId,
          created_by: user.id,
        })
        .select(PUBLIC_COLUMNS)
        .single();
      if (insErr || !row) {
        console.error("payments insert", insErr?.message);
        return reply(req, 200, { error: "provider_error" });
      }
      try {
        const created = await ath.client.createPayment({
          phoneNumber: phone,
          total: amountCents,
          subtotal: amountCents,
          items: [{ name: description, unitAmount: amountCents, quantity: 1 }],
          metadata1: (biz?.name ?? "Grumi").slice(0, 40),
          metadata2: row.id,
          timeoutSeconds: 600,
        });
        await admin.from("payment_secrets").insert({ payment_id: row.id, auth_token: created.authToken });
        const { data: updated } = await admin
          .from("payments")
          .update({
            provider_payment_id: created.ecommerceId,
            expires_at: new Date(Date.now() + 600_000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .select(PUBLIC_COLUMNS)
          .single();
        return reply(req, 200, { payment: publicRow(updated as PaymentRow) });
      } catch (e) {
        await admin.from("payments").update({ status: "failed", last_error: describe(e), updated_at: new Date().toISOString() }).eq("id", row.id);
        return reply(req, 200, { error: errorCode(e) });
      }
    }

    case "ath_status": {
      const row = await ownRow(body.paymentId);
      if (!row) return reply(req, 404, { error: "not_found" });
      return reply(req, 200, { payment: publicRow(await refresh(row)) });
    }

    case "ath_cancel": {
      const row = await ownRow(body.paymentId);
      if (!row) return reply(req, 404, { error: "not_found" });
      const current = await refresh(row);
      if (TERMINAL.has(current.status) || current.status === "authorizing") return reply(req, 200, { payment: publicRow(current) });
      const ath = await athFor(businessId);
      if (ath && current.provider_payment_id) {
        try {
          await ath.client.cancel(current.provider_payment_id);
        } catch (e) {
          console.error("ath cancel", describe(e));
        }
      }
      const { data: updated } = await admin
        .from("payments")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .in("status", ["pending", "awaiting_capture"])
        .select(PUBLIC_COLUMNS)
        .maybeSingle();
      return reply(req, 200, { payment: publicRow((updated as PaymentRow) ?? (await refresh(row))) });
    }

    case "link_transaction": {
      const row = await ownRow(body.paymentId);
      const txnId = String(body.transactionId ?? "");
      if (!row || !/^[0-9a-f-]{36}$/i.test(txnId)) return reply(req, 404, { error: "not_found" });
      if (row.status !== "succeeded") return reply(req, 409, { error: "not_paid" });
      const { data: txn } = await admin.from("transactions").select("id, business_id").eq("id", txnId).maybeSingle();
      if (!txn || txn.business_id !== businessId) return reply(req, 404, { error: "not_found" });
      await admin.from("payments").update({ transaction_id: txnId, updated_at: new Date().toISOString() }).eq("id", row.id);
      return reply(req, 200, { ok: true });
    }

    case "unlinked_for_appointment": {
      const appointmentId = String(body.appointmentId ?? "");
      if (!appointmentId) return reply(req, 200, { payments: [] });
      const { data } = await admin
        .from("payments")
        .select(PUBLIC_COLUMNS)
        .eq("business_id", businessId)
        .eq("appointment_id", appointmentId)
        .eq("status", "succeeded")
        .is("transaction_id", null)
        .order("created_at", { ascending: false });
      return reply(req, 200, { payments: (data ?? []).map((r) => publicRow(r as PaymentRow)) });
    }
  }
  return reply(req, 400, { error: "unknown_action" });
});

export type { SupabaseClient };
