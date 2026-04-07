import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

type Body = { appointment_id?: string };

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

function toDateTime(appointmentDate: string | null, startTime: string | null): Date | null {
  if (!appointmentDate) return null;
  const value = `${appointmentDate}T${startTime || "00:00:00"}`;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
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

  const appointmentId = body.appointment_id?.trim() ?? "";
  if (!appointmentId) {
    return new Response(JSON.stringify({ error: "appointment_id requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: apt, error: aptErr } = await admin
    .from("appointments")
    .select("id, business_id, client_id, pet_id, service_type, appointment_date, start_time, reminder_sent_at")
    .eq("id", appointmentId)
    .maybeSingle();
  if (aptErr || !apt) {
    return new Response(JSON.stringify({ error: "Cita no encontrada" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  if (apt.reminder_sent_at) {
    return new Response(JSON.stringify({ success: true, skipped: "already_sent" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const appointmentAt = toDateTime(apt.appointment_date, apt.start_time);
  if (!appointmentAt || appointmentAt.getTime() <= Date.now()) {
    return new Response(JSON.stringify({ success: true, skipped: "past_or_invalid" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const [{ data: business }, { data: client }, { data: pet }] = await Promise.all([
    admin.from("businesses").select("name, address").eq("id", apt.business_id).maybeSingle(),
    admin
      .from("clients")
      .select("email, name, profile_id")
      .eq("id", apt.client_id)
      .maybeSingle(),
    admin.from("pets").select("name").eq("id", apt.pet_id).maybeSingle(),
  ]);

  const email = client?.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return new Response(JSON.stringify({ success: true, skipped: "no_client_email" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  if (client?.profile_id) {
    const { data: authUser } = await admin.auth.admin.getUserById(client.profile_id);
    if (!authUser.user?.email_confirmed_at) {
      return new Response(JSON.stringify({ success: true, skipped: "email_not_confirmed" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) },
      });
    }
  }

  const dtLabel = appointmentAt.toLocaleString("es-PR", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const businessName = business?.name ?? "Grumi";
  const petName = pet?.name ?? "Mascota";
  const serviceType = apt.service_type ?? "Servicio";
  const location = business?.address ?? "Ubicación del negocio";

  const resendPayload = JSON.stringify({
    from: "Grumi <noreply@stratumpr.com>",
    to: [email],
    subject: `Recordatorio de cita - ${businessName}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Grumi</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Recordatorio de cita</p>
        </div>
        <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1f2937; margin: 0 0 16px 0;">Hola ${client?.name ?? ""}</h2>
          <p style="color: #4b5563; line-height: 1.7;">
            <strong>Negocio:</strong> ${businessName}<br/>
            <strong>Mascota:</strong> ${petName}<br/>
            <strong>Servicio:</strong> ${serviceType}<br/>
            <strong>Fecha y hora:</strong> ${dtLabel}<br/>
            <strong>Ubicación:</strong> ${location}
          </p>
        </div>
      </div>
    `,
  });

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: resendPayload,
  });
  if (!sendRes.ok) {
    const detail = await sendRes.text();
    return new Response(JSON.stringify({ error: "Error enviando recordatorio", detail }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  await admin
    .from("appointments")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", apt.id)
    .is("reminder_sent_at", null);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
});
