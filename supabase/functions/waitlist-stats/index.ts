import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { corsJsonHeaders } from "../_shared/waitlist_cors.ts";

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
