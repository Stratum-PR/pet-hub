/**
 * Waitlist post-confirm survey — single file (Supabase dashboard/remote bundle often only ships index.ts).
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
  business_name?: string | null;
  groomer_count?: string | null;
  current_tools?: string | null;
  biggest_pain?: string | null;
  wants_ath_movil?: boolean;
  wants_nomina_pr?: boolean;
  wants_spanish_ui?: boolean;
  wants_online_booking?: boolean;
};

const GROOMER = new Set(["1", "2-3", "4-6", "7+"]);
const TOOLS = new Set(["pen-paper", "spreadsheet", "gingr", "daysmart", "other"]);
const PAIN_MAX = 500;

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

  const groomer_count = body.groomer_count?.trim() ?? null;
  if (groomer_count && !GROOMER.has(groomer_count)) {
    return new Response(JSON.stringify({ error: "invalid_groomer_count" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const current_tools = body.current_tools?.trim() ?? null;
  if (current_tools && !TOOLS.has(current_tools)) {
    return new Response(JSON.stringify({ error: "invalid_current_tools" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  let biggest_pain = (body.biggest_pain ?? "").trim().slice(0, PAIN_MAX);
  if (biggest_pain === "") biggest_pain = "";

  const { error: insErr } = await admin.from("waitlist_survey").insert({
    waitlist_id: waitlistId,
    business_name: body.business_name?.trim().slice(0, 200) || null,
    groomer_count: groomer_count || null,
    current_tools: current_tools || null,
    biggest_pain: biggest_pain || null,
    wants_ath_movil: Boolean(body.wants_ath_movil),
    wants_nomina_pr: Boolean(body.wants_nomina_pr),
    wants_spanish_ui: Boolean(body.wants_spanish_ui),
    wants_online_booking: Boolean(body.wants_online_booking),
  });

  if (insErr) {
    console.error("waitlist_survey insert", insErr);
    return new Response(JSON.stringify({ error: "database_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
});
