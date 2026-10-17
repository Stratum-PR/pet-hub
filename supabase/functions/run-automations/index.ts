// run-automations: runs automations (trigger -> conditions -> action) for businesses and for Grumi.
//
// Called by:
//  - pg_cron every 15 minutes (header x-cron-secret, checked against Vault) -> mode "run" for every enabled automation;
//    each automation decides if it's due (its schedule / daily time / new events since the last check).
//  - a signed-in user from the app:
//      super admins: any automation (Grumi's own and businesses');
//      managers / admin staff: their business's automations (can_manage_automations).
//    Modes: "preview" (who/what it would hit now, nothing sent), "test" (one sample to the caller; reports: the real
//    report to the caller), "run" (run now, same rules as the cron, safe to repeat).
//    "draft" lets the builder preview/test an automation before saving it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { runAutomation, type AutomationRow, type EngineCtx, type Mode, type Outcome } from "./engine.ts";
import { deliveryEnv } from "./delivery.ts";

type Body = { mode?: Mode | "capabilities"; automation_id?: string; draft?: Partial<AutomationRow>; lang?: "es" | "en" };

const DRAFT_ID = "00000000-0000-0000-0000-000000000000";
const COLUMNS =
  "id, name, business_id, template_key, trigger_type, trigger_config, action_type, action_config, conditions, schedule, enabled, last_run_at, event_cursor";

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const isLocal = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return {
    "Access-Control-Allow-Origin": isLocal || allowed.length === 0 || allowed.includes(origin) ? origin || "*" : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function json(req: Request, status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

/** Back-compat for the first admin page: preview items it can show. */
function withLegacyPreview(o: Outcome) {
  return { ...o, preview: o.preview.map((p) => ({ ...p, business: "", pet: p.label, owner: "", email: p.recipient })) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json(req, 500, { error: "server_misconfigured" });
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mode: Mode = body.mode === "preview" || body.mode === "test" ? body.mode : "run";
  const ctx: EngineCtx = {
    db,
    env: deliveryEnv((k) => Deno.env.get(k)),
    now: new Date(),
    siteUrl: Deno.env.get("SITE_URL") ?? "https://grumi.pet",
    lang: body.lang === "en" ? "en" : "es",
  };

  // ---- the scheduled job
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  if (cronSecret) {
    const { data: ok } = await db.rpc("automation_cron_secret_matches", { p_secret: cronSecret });
    if (ok !== true || mode !== "run") return json(req, 401, { error: "unauthorized" });
    if (!ctx.env.resendKey) return json(req, 500, { error: "email_not_configured" });
    const { data: automations, error } = await db.from("automations").select(COLUMNS).eq("enabled", true);
    if (error) return json(req, 500, { error: "load_failed" });
    const results: Record<string, unknown> = {};
    for (const a of (automations ?? []) as AutomationRow[]) {
      try {
        const o = await runAutomation(ctx, a, "run");
        if (o.ran) results[a.id] = { sent: o.sent, failed: o.failed, skipped: o.skipped, already_sent: o.already_sent };
      } catch (e) {
        console.error("[run-automations]", a.id, e);
        results[a.id] = { error: "failed" };
      }
    }
    return json(req, 200, { ok: true, mode, results });
  }

  // ---- a signed-in user
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: caller } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!caller?.user) return json(req, 401, { error: "unauthorized" });
  const { data: profile } = await db
    .from("profiles")
    .select("is_super_admin, email, business_id")
    .eq("id", caller.user.id)
    .maybeSingle();
  const isSuperAdmin = profile?.is_super_admin === true;
  const callerEmail = (profile?.email as string | null) ?? caller.user.email ?? null;

  // What the server can send (the builder hides/explains SMS until Twilio is set up).
  if (body.mode === "capabilities") {
    return json(req, 200, { ok: true, sms: !!ctx.env.twilio, email: !!ctx.env.resendKey });
  }

  const canManage = async (businessId: string | null): Promise<boolean> => {
    if (isSuperAdmin) return true;
    if (!businessId) return false;
    const userDb = createClient(supabaseUrl, anonKey || serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await userDb.rpc("can_manage_automations", { p_business_id: businessId });
    return data === true;
  };

  let automation: AutomationRow | null = null;
  if (body.automation_id) {
    const { data } = await db.from("automations").select(COLUMNS).eq("id", body.automation_id).maybeSingle();
    automation = (data as AutomationRow | null) ?? null;
    if (!automation) return json(req, 404, { error: "not_found" });
  } else if (body.draft && mode !== "run") {
    const d = body.draft;
    automation = {
      id: DRAFT_ID,
      name: String(d.name ?? "Borrador").slice(0, 120),
      business_id: d.business_id ?? null,
      template_key: d.template_key ?? null,
      trigger_type: d.trigger_type as AutomationRow["trigger_type"],
      trigger_config: d.trigger_config ?? {},
      action_type: String(d.action_type ?? ""),
      action_config: d.action_config ?? {},
      conditions: d.conditions ?? [],
      schedule: d.schedule ?? {},
      enabled: false,
      last_run_at: null,
      event_cursor: null,
    };
  } else {
    return json(req, 400, { error: "automation_missing" });
  }

  if (!(await canManage(automation.business_id))) return json(req, 403, { error: "forbidden" });
  if (mode !== "preview" && !ctx.env.resendKey) return json(req, 500, { error: "email_not_configured" });
  if (mode === "test" && !callerEmail) return json(req, 400, { error: "automation_or_email_missing" });

  try {
    const outcome = await runAutomation(ctx, automation, mode, { force: mode === "run", testTo: callerEmail ?? undefined });
    if (mode === "test") {
      return outcome.failed ? json(req, 502, { error: "send_failed", detail: outcome.detail }) : json(req, 200, { ok: true, sent_to: callerEmail, results: { [automation.id]: outcome } });
    }
    return json(req, 200, { ok: true, mode, results: { [automation.id]: withLegacyPreview(outcome) } });
  } catch (e) {
    console.error("[run-automations] user call", automation.id, e);
    return json(req, 500, { error: "failed" });
  }
});
