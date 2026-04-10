/**
 * Waitlist confirmed count — single file (Supabase dashboard/remote bundle often only ships index.ts).
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

function corsJsonHeaders(req: Request, methods = "GET, OPTIONS"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const cors = corsJsonHeaders(req, "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ confirmedCount: 0, error: "misconfigured" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count, error } = await admin
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("confirmed", true);

  if (error) {
    console.error("waitlist-stats", error);
    return new Response(JSON.stringify({ confirmedCount: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  return new Response(JSON.stringify({ confirmedCount: count ?? 0 }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
});
