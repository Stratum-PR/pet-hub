/**
 * Schedules internal waitlist admin email: admin_notify_at = now + 2 minutes (if not already sent).
 * Call when user continues to the optional survey or skips it.
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

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  let body: { survey_token?: string; skip_survey?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const surveyToken = (body.survey_token ?? "").trim();
  if (!surveyToken || !TOKEN_RE.test(surveyToken)) {
    return new Response(JSON.stringify({ error: "invalid_survey_token" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const skipSurvey = body.skip_survey === true;
  const runAt = skipSurvey
    ? new Date().toISOString()
    : new Date(Date.now() + 2 * 60 * 1000).toISOString();

  const { data: row, error: selErr } = await admin
    .from("waitlist")
    .select("id,confirmed,admin_notify_sent_at")
    .eq("survey_token", surveyToken)
    .maybeSingle();

  if (selErr || !row || !row.confirmed) {
    return new Response(JSON.stringify({ error: "invalid_or_unconfirmed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  if (row.admin_notify_sent_at != null) {
    return new Response(JSON.stringify({ success: true, alreadySent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const patch: Record<string, string> = { admin_notify_at: runAt };
  if (skipSurvey) {
    patch.survey_skipped_at = new Date().toISOString();
  }

  const { error: upErr } = await admin
    .from("waitlist")
    .update(patch)
    .eq("id", row.id)
    .is("admin_notify_sent_at", null);

  if (upErr) {
    return new Response(JSON.stringify({ error: "database_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  return new Response(JSON.stringify({ success: true, admin_notify_at: runAt }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
});
