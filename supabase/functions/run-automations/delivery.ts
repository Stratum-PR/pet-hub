// Delivery: email (Resend), SMS (Twilio) and in-app notifications. No business logic here.
import { escapeHtml } from "./logic.ts";

export type Attachment = { filename: string; content: string /* base64 */ };

export type DeliveryEnv = {
  resendKey: string;
  fromEmail: string;
  twilio: { sid: string; token: string; from: string } | null;
};

export function deliveryEnv(env: (k: string) => string | undefined): DeliveryEnv {
  const configured = env("NOTIFY_FROM_EMAIL") ?? "";
  const match = configured.match(/<([^>]+)>/);
  const fromEmail = (match ? match[1] : configured).trim() || "no-reply@grumi.pet";
  const sid = env("TWILIO_ACCOUNT_SID") ?? "";
  const token = env("TWILIO_AUTH_TOKEN") ?? "";
  const from = env("TWILIO_FROM_NUMBER") ?? "";
  return {
    resendKey: env("NOTIFY_RESEND_API_KEY") ?? env("RESEND_API_KEY") ?? "",
    fromEmail,
    twilio: sid && token && from ? { sid, token, from } : null,
  };
}

export type SendResult = { ok: true } | { ok: false; detail: string };

export async function sendEmail(
  env: DeliveryEnv,
  args: {
    fromName: string;
    to: string[];
    replyTo?: string | null;
    subject: string;
    html: string;
    text: string;
    attachments?: Attachment[];
  },
): Promise<SendResult> {
  if (!env.resendKey) return { ok: false, detail: "email_not_configured" };
  const post = (address: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${args.fromName} <${address}>`,
        to: args.to,
        reply_to: args.replyTo || undefined,
        subject: args.subject,
        html: args.html,
        text: args.text,
        attachments: args.attachments?.length ? args.attachments : undefined,
      }),
    });
  let res = await post(env.fromEmail);
  if (!res.ok && env.fromEmail !== "no-reply@grumi.pet") res = await post("no-reply@grumi.pet");
  if (res.ok) return { ok: true };
  return { ok: false, detail: `resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
}

/** E.164 for Puerto Rico / US numbers stored as 10 digits. */
export function toE164(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSms(env: DeliveryEnv, to: string, body: string): Promise<SendResult> {
  if (!env.twilio) return { ok: false, detail: "sms_not_configured" };
  const e164 = toE164(to);
  if (!e164) return { ok: false, detail: "invalid_phone" };
  const { sid, token, from } = env.twilio;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: e164, From: from, Body: body.slice(0, 640) }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, detail: `twilio ${res.status}: ${(await res.text()).slice(0, 300)}` };
}

/** Plain text -> simple branded HTML (paragraphs, line breaks, links), everything escaped. */
export function messageHtml(body: string, businessName: string, footer: string | null, extraHtml = ""): string {
  const linkify = (s: string) =>
    s.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#2f6f4f">${url}</a>`);
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${linkify(escapeHtml(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f4f0;font-family:Arial,Helvetica,sans-serif;color:#1f2a1f">
<div style="max-width:640px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border-radius:12px;padding:28px;font-size:16px;line-height:1.5">${paragraphs}${extraHtml}</div>
${footer ? `<p style="font-size:12px;color:#6b7280;margin:16px 4px 0">${escapeHtml(footer)}</p>` : ""}
<p style="font-size:12px;color:#9ca3af;margin:4px">${escapeHtml(businessName)} · Grumi</p>
</div></body></html>`;
}

export function tableHtml(columns: string[], headers: Record<string, string>, rows: Record<string, unknown>[], limit = 100): string {
  if (rows.length === 0) return "";
  const th = columns
    .map((c) => `<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb;font-size:13px">${escapeHtml(headers[c] ?? c)}</th>`)
    .join("");
  const body = rows
    .slice(0, limit)
    .map((r) => {
      const isTotal = Object.values(r).some((v) => v === "TOTAL");
      return `<tr>${columns
        .map(
          (c) =>
            `<td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:13px${isTotal ? ";font-weight:bold" : ""}">${escapeHtml(
              r[c] == null ? "" : String(r[c]),
            )}</td>`,
        )
        .join("")}</tr>`;
    })
    .join("");
  const more = rows.length > limit ? `<p style="font-size:12px;color:#6b7280">+${rows.length - limit} …</p>` : "";
  return `<div style="overflow-x:auto;margin-top:8px"><table style="border-collapse:collapse;width:100%">${`<thead><tr>${th}</tr></thead>`}<tbody>${body}</tbody></table>${more}</div>`;
}

export function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
