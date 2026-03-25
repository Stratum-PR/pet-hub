// Issues magic-link OTP material so a super admin can call supabase.auth.verifyOtp on the client.
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

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
    if (origins.length > 0) return origins[0];
  }
  return origin || "*";
}

function corsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

interface Body {
  target_staff_id?: string;
  business_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const anonForJwt = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await anonForJwt.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const adminId = userData.user.id;

  const { data: profile, error: profErr } = await adminClient
    .from("profiles")
    .select("is_super_admin")
    .eq("id", adminId)
    .maybeSingle();

  if (profErr || !profile?.is_super_admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const staffId = typeof body.target_staff_id === "string" ? body.target_staff_id.trim() : "";
  const businessId = typeof body.business_id === "string" ? body.business_id.trim() : "";
  if (!staffId || !businessId) {
    return new Response(JSON.stringify({ error: "target_staff_id and business_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const { data: staffRow, error: staffErr } = await adminClient
    .from("staff")
    .select("id, user_id, business_id, status")
    .eq("id", staffId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (staffErr || !staffRow?.user_id) {
    return new Response(JSON.stringify({ error: "Staff not found or has no linked login" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  if (staffRow.status !== "active") {
    return new Response(JSON.stringify({ error: "Staff must be active" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const targetUserId = staffRow.user_id as string;

  const { data: authUser, error: authUserErr } = await adminClient.auth.admin.getUserById(targetUserId);
  if (authUserErr || !authUser.user?.email) {
    return new Response(JSON.stringify({ error: "Target auth user has no email" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    return new Response(
      JSON.stringify({ error: linkErr?.message ?? "Could not generate login link" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) },
      },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  const { error: auditErr } = await adminClient.from("support_impersonation_audit").insert({
    admin_id: adminId,
    target_user_id: targetUserId,
    business_id: businessId,
    ip_address: ip,
    user_agent: ua,
  });

  if (auditErr) {
    return new Response(JSON.stringify({ error: "audit_log_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  return new Response(
    JSON.stringify({
      token_hash: linkData.properties.hashed_token,
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
  );
});
