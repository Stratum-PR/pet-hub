// Sends staff portal invitation email via Resend. verify_jwt = false; validates JWT in-handler.
// Secrets: RESEND_API_KEY, APP_URL (public site origin for invite links), SUPABASE_* (auto), optional ALLOWED_ORIGINS
// Dev: vite.config uses port 8080 — default base URL must match. Production: set APP_URL (e.g. https://app.example.com).

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
  staff_id?: string;
  email?: string;
  staff_member_name?: string;
  business_name?: string;
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
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
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
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const callingUser = userData.user;

  const { data: callerProfile, error: profErr } = await adminClient
    .from("profiles")
    .select("role, business_id, is_super_admin")
    .eq("id", callingUser.id)
    .maybeSingle();

  if (profErr || !callerProfile) {
    return new Response(JSON.stringify({ error: "Perfil no encontrado" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const isSuper = callerProfile.is_super_admin === true || callerProfile.role === "super_admin";
  const isManager = callerProfile.role === "manager";

  if (!isSuper && !isManager) {
    return new Response(JSON.stringify({ error: "Solo administradores pueden invitar" }), {
      status: 403,
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

  const staffId = typeof body.staff_id === "string" ? body.staff_id.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!staffId || !email) {
    return new Response(JSON.stringify({ error: "staff_id y email son requeridos" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  let targetBusinessId: string;
  if (isSuper) {
    const bid = typeof body.business_id === "string" ? body.business_id.trim() : "";
    if (!bid) {
      return new Response(
        JSON.stringify({ error: "business_id es requerido para invitaciones de super admin" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
      );
    }
    targetBusinessId = bid;
  } else {
    const bid = callerProfile.business_id;
    if (!bid) {
      return new Response(JSON.stringify({ error: "Tu perfil no tiene negocio asignado" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) },
      });
    }
    targetBusinessId = bid;
  }

  const { data: staffRow, error: staffErr } = await adminClient
    .from("staff")
    .select("id, business_id, name")
    .eq("id", staffId)
    .eq("business_id", targetBusinessId)
    .maybeSingle();

  if (staffErr || !staffRow) {
    return new Response(JSON.stringify({ error: "Personal no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const { data: existingInvite } = await adminClient
    .from("staff_invites")
    .select("id")
    .eq("staff_id", staffId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite?.id) {
    const { error: revokeErr } = await adminClient
      .from("staff_invites")
      .update({ status: "revoked" })
      .eq("id", existingInvite.id);
    if (revokeErr) {
      console.error("staff_invites revoke:", revokeErr);
      return new Response(
        JSON.stringify({
          error: "No se pudo actualizar la invitación anterior",
          detail: revokeErr.code === "23505"
            ? "Conflicto de datos (invitaciones). Aplica la migración staff_invites (índice único solo para pending) o revisa restricciones en staff_invites."
            : undefined,
          code: revokeErr.code ?? undefined,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders(req) },
        },
      );
    }
  }

  const { data: invitation, error: inviteErr } = await adminClient
    .from("staff_invites")
    .insert({
      business_id: targetBusinessId,
      staff_id: staffId,
      email,
      invited_by: callingUser.id,
    })
    .select("id, token")
    .single();

  if (inviteErr || !invitation) {
    console.error("staff_invites insert:", inviteErr);
    return new Response(
      JSON.stringify({
        error: "Error creando la invitación",
        detail: inviteErr?.code === "23505"
          ? "Violación de unicidad. Si reinvitas varias veces, aplica migración 20260331230000_staff_invites_pending_only_unique.sql (un solo pending por staff; varios revoked permitidos)."
          : inviteErr?.message
            ? String(inviteErr.message).slice(0, 220)
            : undefined,
        code: inviteErr?.code ?? undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) },
      },
    );
  }

  const baseUrl = appUrl || "http://localhost:8080";
  const invitationUrl = `${baseUrl}/employee/accept-invitation?token=${encodeURIComponent(invitation.token)}`;

  const displayName = body.staff_member_name?.trim() || staffRow.name || "";
  const bizName = body.business_name?.trim() || "Tu negocio";

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Pet Hub <noreply@stratumpr.com>",
      to: [email],
      subject: `${bizName} te invita a unirte a Pet Hub`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Pet Hub</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Portal de Empleados</p>
          </div>
          <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #1f2937; margin: 0 0 16px 0;">¡Hola${displayName ? ` ${displayName}` : ""}!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Has sido invitado/a a unirte a <strong>${bizName}</strong> en Pet Hub.
              Crea tu cuenta para acceder a tu horario, citas, hojas de tiempo y más.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}"
                 style="display: inline-block; padding: 14px 32px; background: #6366f1; color: white;
                        text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Crear Mi Cuenta
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 13px;">Este enlace expira en 7 días.</p>
            <p style="color: #9ca3af; font-size: 12px;">Si el botón no funciona: <a href="${invitationUrl}">${invitationUrl}</a></p>
          </div>
        </div>
      `,
    }),
  });

  if (!resendResponse.ok) {
    const txt = await resendResponse.text();
    console.error("Resend:", txt);
    let detail: string | undefined;
    try {
      const j = JSON.parse(txt) as { message?: string | string[] };
      if (Array.isArray(j.message)) {
        detail = j.message.map(String).join("; ").slice(0, 300);
      } else if (typeof j.message === "string") {
        detail = j.message.slice(0, 300);
      }
    } catch {
      detail = txt.slice(0, 300);
    }
    return new Response(
      JSON.stringify({
        error: "Error enviando el correo electrónico",
        detail: detail || undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) },
      },
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Invitación enviada", invitation_id: invitation.id }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
  );
});
