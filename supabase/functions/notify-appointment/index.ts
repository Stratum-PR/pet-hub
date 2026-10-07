// notify-appointment
// Tells a client about a decision on their appointment, by email (Resend) or SMS (Twilio),
// following the client's contact_preference. Called by staff from the appointment book.
//
// Security
// - Requires a signed-in user (JWT verified by the platform AND checked here).
// - The caller must belong to the appointment's business (or be a super admin).
// - The message never says which staff member made the decision.
// - Provider errors are logged to appointment_notifications, never returned to the browser.
//
// Secrets (supabase secrets set …)
//   RESEND_API_KEY            required for email
//   NOTIFY_FROM_EMAIL         optional, default "Grumi <noreply@grumi.pet>"
//   TWILIO_ACCOUNT_SID        optional, enables SMS
//   TWILIO_AUTH_TOKEN         optional, enables SMS
//   TWILIO_FROM_NUMBER        optional, enables SMS (E.164, e.g. +17875550100)
//   ALLOWED_ORIGINS           comma-separated app origins for CORS
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

type Kind = "confirmed" | "declined" | "proposed_time" | "rescheduled" | "canceled";
const KINDS: Kind[] = ["confirmed", "declined", "proposed_time", "rescheduled", "canceled"];

const NO_REPLY_FROM = () => Deno.env.get("NOTIFY_FROM_EMAIL") ?? "Grumi <noreply@grumi.pet>";

/** Sends via Resend from noreply@grumi.pet. */
async function sendResend(resendKey: string, payload: Record<string, unknown>): Promise<Response> {
  const post = (sender: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, from: sender }),
    });
  const from = NO_REPLY_FROM();
  return post(from);
}

function corsHeaders(req: Request): Record<string, string> {
  // Access is controlled by the signed-in user's JWT, so the caller's origin and requested headers are echoed
  // (a fixed allow-list broke calls from dev.grumi.pet and from newer SDK headers).
  const origin = req.headers.get("Origin") ?? "*";
  const requested = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      requested ?? "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function time12(hhmm: string | null): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function dateLabel(ymd: string | null): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  // Noon UTC avoids the date shifting across time zones when formatting.
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-PR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function toE164(phone: string | null): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

function compose(kind: Kind, v: {
  client: string; pet: string; business: string; businessPhone: string; when: string; groomer: string; note: string;
}) {
  const call = v.businessPhone ? ` Si tienes preguntas, llama al ${v.businessPhone}.` : "";
  switch (kind) {
    case "confirmed":
      return {
        subject: `Cita confirmada · ${v.business}`,
        text: `Hola ${v.client}, tu cita para ${v.pet} en ${v.business} está confirmada: ${v.when}${v.groomer ? ` con ${v.groomer}` : ""}.${call}`,
      };
    case "declined":
      return {
        subject: `Sobre tu solicitud de cita · ${v.business}`,
        text: `Hola ${v.client}, no pudimos aceptar tu solicitud para ${v.pet} el ${v.when}.${v.note ? ` Motivo: ${v.note}.` : ""}${call || " Puedes solicitar otra hora."}`,
      };
    case "proposed_time":
      return {
        subject: `Te proponemos otra hora · ${v.business}`,
        text: `Hola ${v.client}, la hora que pediste para ${v.pet} no está disponible. Te proponemos ${v.when}.${v.note ? ` ${v.note}.` : ""} Responde o llámanos para confirmarla.${call}`,
      };
    case "rescheduled":
      return {
        subject: `Tu cita cambió · ${v.business}`,
        text: `Hola ${v.client}, tu cita para ${v.pet} en ${v.business} ahora es ${v.when}.${call}`,
      };
    case "canceled":
      return {
        subject: `Cita cancelada · ${v.business}`,
        text: `Hola ${v.client}, tu cita para ${v.pet} el ${v.when} en ${v.business} fue cancelada.${call}`,
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) return json(req, 500, { error: "server_misconfigured" });

  // --- who is calling ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(req, 401, { error: "unauthorized" });
  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user) return json(req, 401, { error: "unauthorized" });

  let body: { appointment_id?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "invalid_json" });
  }
  const appointmentId = String(body.appointment_id ?? "").trim();
  const kind = body.kind as Kind;
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId) || !KINDS.includes(kind)) return json(req, 400, { error: "invalid_input" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const [{ data: profile }, { data: apt }] = await Promise.all([
    admin.from("profiles").select("business_id, is_super_admin, role").eq("id", userData.user.id).maybeSingle(),
    admin
      .from("appointments")
      .select("id, business_id, client_id, pet_id, staff_id, appointment_date, start_time, decision_note")
      .eq("id", appointmentId)
      .maybeSingle(),
  ]);
  if (!apt) return json(req, 404, { error: "not_found" });
  const sameBusiness = profile?.business_id && profile.business_id === apt.business_id;
  if (!sameBusiness && !profile?.is_super_admin) return json(req, 403, { error: "forbidden" });
  if (profile?.role === "client") return json(req, 403, { error: "forbidden" });

  // --- de-duplicate: same message for the same appointment within 2 minutes ---
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: recent } = await admin
    .from("appointment_notifications")
    .select("id")
    .eq("appointment_id", apt.id)
    .eq("kind", kind)
    .eq("status", "sent")
    .gte("created_at", since)
    .limit(1);
  if (recent && recent.length) return json(req, 200, { sent: false, skipped: "duplicate" });

  const [{ data: client }, { data: pet }, { data: business }, { data: groomer }] = await Promise.all([
    admin.from("clients").select("first_name, email, phone, contact_preference").eq("id", apt.client_id).maybeSingle(),
    admin.from("pets").select("name").eq("id", apt.pet_id).maybeSingle(),
    admin.from("businesses").select("name, phone").eq("id", apt.business_id).maybeSingle(),
    apt.staff_id
      ? admin.from("staff").select("first_name, name").eq("id", apt.staff_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const log = async (channel: "email" | "sms" | "none", status: "sent" | "skipped" | "failed", detail?: string) => {
    await admin.from("appointment_notifications").insert({
      business_id: apt.business_id,
      appointment_id: apt.id,
      kind,
      channel,
      status,
      detail: detail ? detail.slice(0, 500) : null,
    });
  };

  const pref = (client?.contact_preference ?? "email") as "email" | "sms" | "none";
  if (pref === "none") {
    await log("none", "skipped", "client_opted_out");
    return json(req, 200, { sent: false, skipped: "client_opted_out" });
  }

  const email = client?.email?.trim() || null;
  const phone = toE164(client?.phone ?? null);
  // A dedicated key for appointment emails if set; otherwise the project's shared Resend key.
  const resendKey = Deno.env.get("NOTIFY_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY") || "";
  const twSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const twToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const twFrom = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";
  const smsReady = !!(twSid && twToken && twFrom);
  const emailReady = !!resendKey;

  // Preferred channel first, the other as a fallback when the preferred one isn't possible.
  let channel: "email" | "sms" | null = null;
  if (pref === "sms" && phone && smsReady) channel = "sms";
  else if (pref === "email" && email && emailReady) channel = "email";
  else if (email && emailReady) channel = "email";
  else if (phone && smsReady) channel = "sms";
  if (!channel) {
    await log("none", "skipped", `no_contact (pref=${pref}, email=${!!email}, phone=${!!phone}, smsReady=${smsReady}, emailReady=${emailReady})`);
    return json(req, 200, { sent: false, skipped: "no_contact" });
  }

  const msg = compose(kind, {
    client: client?.first_name?.trim() || "",
    pet: pet?.name ?? "tu mascota",
    business: business?.name ?? "Grumi",
    businessPhone: business?.phone ?? "",
    when: `${dateLabel(apt.appointment_date)}, ${time12(apt.start_time)}`,
    groomer: kind === "confirmed" ? (groomer?.first_name || groomer?.name?.split(" ")[0] || "") : "",
    note: (apt.decision_note ?? "").trim(),
  });

  try {
    if (channel === "email") {
      const res = await sendResend(resendKey, {
          to: [email],
          subject: msg.subject,
          text: msg.text,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
            <h2 style="margin:0 0 12px;font-size:18px">${esc(msg.subject)}</h2>
            <p style="line-height:1.6;margin:0">${esc(msg.text)}</p>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px">${esc(business?.name ?? "Grumi")}</p>
          </div>`,
      });
      if (!res.ok) {
        await log("email", "failed", `resend ${res.status}: ${await res.text()}`);
        return json(req, 200, { sent: false, skipped: "provider_error" });
      }
    } else {
      const form = new URLSearchParams({ To: phone!, From: twFrom, Body: msg.text });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${twSid}:${twToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
      if (!res.ok) {
        await log("sms", "failed", `twilio ${res.status}: ${await res.text()}`);
        return json(req, 200, { sent: false, skipped: "provider_error" });
      }
    }
  } catch (e) {
    await log(channel, "failed", String(e));
    return json(req, 200, { sent: false, skipped: "provider_error" });
  }

  await log(channel, "sent");
  return json(req, 200, { sent: true, channel });
});
