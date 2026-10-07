// athm-simulator
// ATH Móvil Payment Button API simulator for TEST MODE (Evertec has no sandbox).
// Same core as Stratum-PR/payment_methods simulator/athmovil (synced by scripts/sync-payment-libs.sh),
// with state in Postgres (athm_sim_businesses / athm_sim_payments) so it works across function instances.
//
// - ATH API routes (/api/business-transaction/ecommerce/…, /transactions/webhook/post) are public like the
//   real API and authenticated by the business's *simulator* tokens (never real ATH tokens, never real money).
// - Customer-side controls (/simulator/state, /simulator/payments/:id/approve|decline|expire) require a signed-in
//   manager of the business that owns the simulated account (security review G-1). Used by the "teléfono simulado" page in Grumi.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { createSimulator } from "./lib/core.mjs";

type Json = Record<string, unknown>;

function cors(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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

// deno-lint-ignore no-explicit-any
function dbStore(admin: any) {
  // deno-lint-ignore no-explicit-any
  const toBiz = (r: any) =>
    r ? { publicToken: r.public_token, privateToken: r.private_token, name: r.name, webhook: r.webhook, dailyCount: r.daily_count } : null;
  return {
    async getBusiness(t: string) {
      if (!t) return null;
      const { data } = await admin.from("athm_sim_businesses").select("*").eq("public_token", t).maybeSingle();
      return toBiz(data);
    },
    // deno-lint-ignore no-explicit-any
    async saveBusiness(b: any) {
      await admin.from("athm_sim_businesses").update({ webhook: b.webhook ?? null, daily_count: b.dailyCount ?? 0 }).eq("public_token", b.publicToken);
    },
    async getPayment(id: string) {
      if (!id) return null;
      const { data } = await admin.from("athm_sim_payments").select("data").eq("ecommerce_id", id).maybeSingle();
      return data?.data ?? null;
    },
    async findPaymentByToken(t: string) {
      const { data } = await admin.from("athm_sim_payments").select("data").eq("auth_token", t).maybeSingle();
      return data?.data ?? null;
    },
    async findPaymentByReference(r: string) {
      if (!r) return null;
      const { data } = await admin.from("athm_sim_payments").select("data").eq("reference_number", r).maybeSingle();
      return data?.data ?? null;
    },
    // deno-lint-ignore no-explicit-any
    async savePayment(p: any) {
      await admin.from("athm_sim_payments").upsert({
        ecommerce_id: p.ecommerceId,
        auth_token: p.authToken,
        public_token: p.publicToken,
        reference_number: p.referenceNumber ?? null,
        status: p.status,
        data: p,
        created_at: p.createdAt,
      });
    },
    async listPayments({ publicToken }: { publicToken?: string } = {}) {
      let q = admin.from("athm_sim_payments").select("data").order("created_at", { ascending: false }).limit(30);
      if (publicToken) q = q.eq("public_token", publicToken);
      const { data } = await q;
      // deno-lint-ignore no-explicit-any
      return (data ?? []).map((r: any) => r.data);
    },
    async listOpenPayments() {
      const { data } = await admin.from("athm_sim_payments").select("data").in("status", ["OPEN", "CONFIRM"]).limit(200);
      // deno-lint-ignore no-explicit-any
      return (data ?? []).map((r: any) => r.data);
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return reply(req, 500, { status: "error", message: "server_misconfigured" });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const sim = createSimulator({ store: dbStore(admin), timeScale: 1, autoMs: 3000 });

  // G-1: PAYMENTS_SIMULATOR_ENABLED=false turns test mode off for the whole project.
  if ((Deno.env.get("PAYMENTS_SIMULATOR_ENABLED") ?? "true").toLowerCase() === "false") {
    return reply(req, 403, { status: "error", message: "simulator_disabled" });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/(functions\/v1\/)?athm-simulator/, "") || "/";

  // ---------- customer-side controls (signed-in staff of the owning business) ----------
  if (path.startsWith("/simulator/")) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: u } = token ? await userClient.auth.getUser(token) : { data: { user: null } };
    if (!u?.user) return reply(req, 401, { ok: false, error: "unauthorized" });
    const { data: profile } = await admin
      .from("profiles")
      .select("business_id, role, is_super_admin")
      .eq("id", u.user.id)
      .maybeSingle();
    if (!profile?.business_id) return reply(req, 403, { ok: false, error: "forbidden" });
    // Security review G-1: only managers can play the customer, so staff can't approve their own test charges.
    const isManager = profile.role === "manager" || profile.role === "super_admin" || !!profile.is_super_admin;
    if (!isManager) return reply(req, 403, { ok: false, error: "forbidden" });
    const { data: simBiz } = await admin
      .from("athm_sim_businesses")
      .select("public_token")
      .eq("owner_business_id", profile.business_id)
      .maybeSingle();
    if (!simBiz) {
      return path === "/simulator/state"
        ? reply(req, 200, { payments: [], configured: false })
        : reply(req, 404, { ok: false, error: "not_found" });
    }

    if (path === "/simulator/state") {
      const state = await sim.state({ publicToken: simBiz.public_token });
      return reply(req, 200, { payments: state.payments, configured: true });
    }
    const m = path.match(/^\/simulator\/payments\/([^/]+)\/(approve|decline|expire)$/);
    if (m && req.method === "POST") {
      const p = await dbStore(admin).getPayment(m[1]);
      if (!p || p.publicToken !== simBiz.public_token) return reply(req, 404, { ok: false, error: "not_found" });
      const r = await sim.customerAction(m[1], m[2]);
      return reply(req, r.ok ? 200 : 409, r);
    }
    return reply(req, 404, { ok: false, error: "not_found" });
  }

  // ---------- ATH Móvil API ----------
  let body: Json | undefined;
  if (req.method !== "GET") {
    const raw = await req.text();
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = {};
    }
  }
  const r = await sim.handle(req.method, path, { authorization: req.headers.get("Authorization") ?? "" }, body);
  return reply(req, r.status, r.body);
});
