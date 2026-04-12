/**
 * Records cookie category choices (GDPR accountability). Inserts with service role; no public table access.
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  anonymous_id?: string;
  policy_version?: string;
  preferences?: boolean;
  analytics?: boolean;
  marketing?: boolean;
  locale?: string;
};

Deno.serve(async (req) => {
  const cors = corsJsonHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const anonymousId = typeof body.anonymous_id === "string" ? body.anonymous_id.trim() : "";
  if (!anonymousId || !UUID_RE.test(anonymousId)) {
    return new Response(JSON.stringify({ error: "anonymous_id must be a UUID" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const policyVersion = typeof body.policy_version === "string" ? body.policy_version.trim() : "";
  if (!policyVersion || policyVersion.length > 64) {
    return new Response(JSON.stringify({ error: "policy_version required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const preferences = Boolean(body.preferences);
  const analytics = Boolean(body.analytics);
  const marketing = Boolean(body.marketing);
  const locale = typeof body.locale === "string" && (body.locale === "en" || body.locale === "es")
    ? body.locale
    : null;

  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ") && anonKey) {
    const token = authHeader.slice(7).trim();
    if (token.length > 20 && token !== anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error } = await userClient.auth.getUser(token);
      if (!error && user?.id) userId = user.id;
    }
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: insertError } = await admin.from("cookie_consents").insert({
    anonymous_id: anonymousId,
    user_id: userId,
    policy_version: policyVersion,
    preferences,
    analytics,
    marketing,
    locale,
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: "Storage failed" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
