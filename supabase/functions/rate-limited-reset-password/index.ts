// Rate-limited password reset: max 3 requests per email per hour.
// Requires secrets: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, SUPABASE_ANON_KEY
// (SUPABASE_URL is optional; we derive it from the request host.)

const RESET_LIMIT = 3;
const WINDOW_SECONDS = 3600; // 1 hour

// Set ALLOWED_ORIGINS in Supabase Edge Function secrets (e.g. https://yourapp.com,https://www.yourapp.com).
// Comma-separated; if unset, falls back to * for backward compatibility.
function getCorsOrigin(req: Request): string {
  const allowed = Deno.env.get("ALLOWED_ORIGINS")?.trim();
  if (allowed) {
    const origins = allowed.split(",").map((o) => o.trim()).filter(Boolean);
    const origin = req.headers.get("Origin") ?? "";
    if (origins.includes(origin)) return origin;
    if (origins.length > 0) return origins[0];
  }
  return "*";
}

function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function upstashRedisCommand(
  redisUrl: string,
  redisToken: string,
  command: string[],
): Promise<{ result?: number; error?: string }> {
  const res = await fetch(redisUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!redisUrl || !redisToken || !anonKey) {
    console.error("Missing env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, or SUPABASE_ANON_KEY");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  let email: string;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body. Send { \"email\": \"you@example.com\" }" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: "Valid email is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  const key = `reset:${email}`;

  // INCR key
  const incrRes = await upstashRedisCommand(redisUrl, redisToken, ["INCR", key]);
  const count = incrRes.result ?? 0;
  if (incrRes.error) {
    console.error("Upstash INCR error:", incrRes.error);
    return new Response(
      JSON.stringify({ error: "Rate limit check failed. Try again later." }),
      { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  // First request in window: set expiry
  if (count === 1) {
    await upstashRedisCommand(redisUrl, redisToken, ["EXPIRE", key, String(WINDOW_SECONDS)]);
  }

  if (count > RESET_LIMIT) {
    return new Response(
      JSON.stringify({
        error: "too_many_requests",
        message: "Too many password reset requests for this email. Please try again in 1 hour.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(WINDOW_SECONDS),
          ...corsHeaders(req),
        },
      },
    );
  }

  // Call Supabase Auth recover (same project as this function)
  const baseUrl = supabaseUrl || new URL(req.url).origin;
  const authUrl = `${baseUrl}/auth/v1/recover`;

  const authRes = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ email }),
  });

  const authBody = await authRes.text();
  let authJson: Record<string, unknown> = {};
  try {
    authJson = JSON.parse(authBody);
  } catch {
    // non-JSON response
  }

  if (!authRes.ok) {
    const msg = (authJson as { msg?: string }).msg || authBody || "Failed to send reset email";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: authRes.status, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  return new Response(
    JSON.stringify({
      message: "If an account exists for this email, you will receive a password reset link.",
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
  );
});
