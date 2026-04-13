/**
 * Waitlist survey — single file. Requires confirmed waitlist row by survey_token.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("Origin") ?? "";
  if (origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    return origin;
  }
  const allowed = Deno.env.get("ALLOWED_ORIGINS")?.trim();
  if (allowed) {
    const origins = allowed.split(",").map((o) => o.trim()).filter(Boolean);
    if (origins.includes(origin)) return origin;
    if (origins.length > 0) return origins[0]!;
  }
  return origin || "*";
}

function corsJsonHeaders(req: Request, methods = "POST, OPTIONS"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

type Body = {
  survey_token?: string;
  groomer_count?: string | null;
  tools_selected?: unknown;
  tools_other?: string | null;
  biggest_pain?: string | null;
  wants_ath_movil?: boolean;
  wants_costo?: boolean;
  wants_nomina_pr?: boolean;
  wants_staff_management?: boolean;
  wants_spanish_ui?: boolean;
  wants_online_booking?: boolean;
  wants_charge_online?: boolean;
  wants_inventory?: boolean;
  wants_advanced_reports?: boolean;
};

const GROOMER = new Set(["1", "2-5", "6-9", "10+"]);
const TOOL_KEYS = new Set(["pen-paper", "spreadsheet", "software", "other"]);
const PAIN_MAX = 500;
const OTHER_MAX = 180;

/** Fire the drain job so the internal admin email sends without relying on external cron. */
async function invokeAdminNotifyDrain(): Promise<void> {
  const secret = Deno.env.get("WAITLIST_NOTIFY_DRAIN_SECRET")?.trim() ?? "";
  if (!secret) return;
  const base = (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/$/, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!base || !key) return;
  const url = `${base}/functions/v1/waitlist-admin-notify-drain`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
        "x-waitlist-notify-secret": secret,
      },
    });
    if (!res.ok) {
      console.error("waitlist-survey: drain invoke failed", res.status, await res.text());
    }
  } catch (e) {
    console.error("waitlist-survey: drain invoke error", e);
  }
}

function parseToolsSelected(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") return null;
    const k = x.trim();
    if (!TOOL_KEYS.has(k)) return null;
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

Deno.serve(async (req) => {
  const cors = corsJsonHeaders(req, "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const surveyToken = (body.survey_token ?? "").trim();
  if (!surveyToken) {
    return new Response(JSON.stringify({ error: "survey_token_required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: wl, error: wErr } = await admin
    .from("waitlist")
    .select("id,confirmed")
    .eq("survey_token", surveyToken)
    .maybeSingle();

  if (wErr || !wl || !wl.confirmed) {
    return new Response(JSON.stringify({ error: "invalid_or_unconfirmed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const waitlistId = wl.id as string;

  const { data: existingSurvey } = await admin
    .from("waitlist_survey")
    .select("id")
    .eq("waitlist_id", waitlistId)
    .maybeSingle();

  if (existingSurvey) {
    return new Response(JSON.stringify({ success: true, alreadySubmitted: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const groomer_count = (body.groomer_count ?? "").trim();
  if (!groomer_count || !GROOMER.has(groomer_count)) {
    return new Response(JSON.stringify({ error: "invalid_groomer_count" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const toolsArr = parseToolsSelected(body.tools_selected);
  if (!toolsArr || toolsArr.length === 0) {
    return new Response(JSON.stringify({ error: "tools_required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  let tools_other = (body.tools_other ?? "").trim().slice(0, OTHER_MAX);
  if (toolsArr.includes("other") && tools_other.length === 0) {
    tools_other = "";
  }
  if (!toolsArr.includes("other")) {
    tools_other = "";
  }

  const wants_ath_movil = Boolean(body.wants_ath_movil);
  const wants_costo = Boolean(body.wants_costo);
  const wants_nomina_pr = Boolean(body.wants_nomina_pr);
  const wants_staff_management = Boolean(body.wants_staff_management);
  const wants_spanish_ui = Boolean(body.wants_spanish_ui);
  const wants_online_booking = Boolean(body.wants_online_booking);
  const wants_charge_online = Boolean(body.wants_charge_online);
  const wants_inventory = Boolean(body.wants_inventory);
  const wants_advanced_reports = Boolean(body.wants_advanced_reports);

  const anyFeature =
    wants_ath_movil ||
    wants_costo ||
    wants_nomina_pr ||
    wants_staff_management ||
    wants_spanish_ui ||
    wants_online_booking ||
    wants_charge_online ||
    wants_inventory ||
    wants_advanced_reports;

  if (!anyFeature) {
    return new Response(JSON.stringify({ error: "features_required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  let biggest_pain = (body.biggest_pain ?? "").trim().slice(0, PAIN_MAX);
  if (biggest_pain === "") biggest_pain = "";

  const { error: insErr } = await admin.from("waitlist_survey").insert({
    waitlist_id: waitlistId,
    business_name: null,
    groomer_count,
    current_tools: null,
    tools_selected: toolsArr,
    tools_other: tools_other || null,
    biggest_pain: biggest_pain || null,
    wants_ath_movil,
    wants_costo,
    wants_nomina_pr,
    wants_staff_management,
    wants_spanish_ui,
    wants_online_booking,
    wants_charge_online,
    wants_inventory,
    wants_advanced_reports,
  });

  if (insErr) {
    return new Response(JSON.stringify({ error: "database_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const notifySoon = new Date().toISOString();
  const { error: notifyAtErr } = await admin
    .from("waitlist")
    .update({ admin_notify_at: notifySoon })
    .eq("id", waitlistId)
    .is("admin_notify_sent_at", null);

  if (notifyAtErr) {
    console.error("waitlist-survey: admin_notify_at update failed", notifyAtErr);
  }

  await invokeAdminNotifyDrain();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
});
