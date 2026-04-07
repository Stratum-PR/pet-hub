import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

type Body = {
  email?: string;
  business_slug?: string;
  business_name?: string;
};

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

function resolveAppBase(req: Request): string {
  const env = (Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  if (env) return env;
  const origin = (req.headers.get("Origin") ?? "").trim().replace(/\/$/, "");
  if (origin) return origin;
  return "http://localhost:8080";
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
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !resendKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const businessSlug = body.business_slug?.trim() ?? "";
  const businessName = body.business_name?.trim() || "Grumi";
  if (!email || !businessSlug) {
    return new Response(JSON.stringify({ error: "email y business_slug son requeridos" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const appBase = resolveAppBase(req);
  const redirectTo = `${appBase}/portal?business=${encodeURIComponent(businessSlug)}`;
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "signup",
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return new Response(JSON.stringify({ error: "No se pudo generar enlace de confirmación" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const actionLink = linkData.properties.action_link;
  const resendPayload = JSON.stringify({
    from: "Grumi <noreply@stratumpr.com>",
    to: [email],
    subject: `Confirma tu cuenta en ${businessName}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Grumi</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Portal de Clientes</p>
        </div>
        <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1f2937; margin: 0 0 16px 0;">Confirma tu correo</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Tu cuenta para <strong>${businessName}</strong> está casi lista.
            Confirma tu email para entrar al portal de clientes.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionLink}"
               style="display: inline-block; padding: 14px 32px; background: #6366f1; color: white;
                      text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Confirmar mi cuenta
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">Si el botón no funciona: <a href="${actionLink}">${actionLink}</a></p>
        </div>
      </div>
    `,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: resendPayload,
  });

  if (!response.ok) {
    const detail = await response.text();
    return new Response(JSON.stringify({ error: "Error enviando correo", detail }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
});
