/**
 * Waitlist email confirm — single file. Confirms opt-in, then 302 to Grumi with survey on-site.
 * No second "welcome" email: the confirmation email already explains the flow; survey opens after redirect.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

function resolveAppBase(req: Request): string {
  const env = (Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  if (env) return env;
  const origin = (req.headers.get("Origin") ?? "").trim().replace(/\/$/, "");
  if (origin) return origin;
  return "http://localhost:8080";
}

/** Parse origin only (no path) for redirect allowlist checks. */
function normalizeRedirectOrigin(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isAllowedRedirectOrigin(origin: string): boolean {
  const site = (Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "").trim();
  if (site) {
    try {
      if (new URL(site).origin === origin) return true;
    } catch {
      /* ignore */
    }
  }
  const extra = Deno.env.get("WAITLIST_ALLOWED_REDIRECT_ORIGINS")?.trim() ?? "";
  for (const chunk of extra.split(",").map((x) => x.trim()).filter(Boolean)) {
    try {
      if (new URL(chunk).origin === origin) return true;
    } catch {
      /* ignore */
    }
  }
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Prefer ?redirect_to= when allowlisted (e.g. local dev); else SITE_URL / APP_URL. */
function resolveRedirectBase(req: Request, pageUrl: URL): string {
  const explicit = pageUrl.searchParams.get("redirect_to")?.trim();
  if (explicit) {
    const o = normalizeRedirectOrigin(explicit);
    if (o && isAllowedRedirectOrigin(o)) return o.replace(/\/$/, "");
  }
  return resolveAppBase(req);
}

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const url = new URL(req.url);
  const appBase = resolveRedirectBase(req, url);
  const token = (url.searchParams.get("token") ?? "").trim();

  const redirectInvalid = () =>
    new Response(null, {
      status: 302,
      headers: { Location: `${appBase}/?waitlist=invalid` },
    });

  if (!token || !supabaseUrl || !serviceKey) {
    return redirectInvalid();
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error } = await admin
    .from("waitlist")
    .select("id,email,confirmed,locale,survey_token,confirm_token")
    .eq("confirm_token", token)
    .maybeSingle();

  if (error || !row) {
    return redirectInvalid();
  }

  if (row.confirmed) {
    const st = row.survey_token as string | null;
    if (st) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${appBase}/waitlist/confirmed?survey_token=${encodeURIComponent(st)}` },
      });
    }
    return new Response(null, {
      status: 302,
      headers: { Location: `${appBase}/waitlist/confirmed` },
    });
  }

  const surveyToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("waitlist")
    .update({
      confirmed: true,
      confirmed_at: now,
      survey_token: surveyToken,
    })
    .eq("id", row.id)
    .eq("confirmed", false);

  if (upErr) {
    console.error("waitlist confirm update", upErr);
    return redirectInvalid();
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `${appBase}/waitlist/confirmed?survey_token=${encodeURIComponent(surveyToken)}` },
  });
});
