const FROM = "Grumi <noreply@stratumpr.com>";

export function resendFrom(): string {
  return Deno.env.get("RESEND_FROM_EMAIL")
    ? `${Deno.env.get("RESEND_FROM_NAME") ?? "Grumi"} <${Deno.env.get("RESEND_FROM_EMAIL")}>`
    : FROM;
}

export function confirmationEmail(params: { confirmUrl: string; locale: string }): { subject: string; html: string } {
  const es = params.locale === "es";
  const subject = es
    ? "Confirma tu lugar en la lista de espera de Grumi"
    : "Confirm your spot on the Grumi waitlist";
  const html = es
    ? confirmationHtmlEs(params.confirmUrl)
    : confirmationHtmlEn(params.confirmUrl);
  return { subject, html };
}

export function welcomeEmail(params: { surveyUrl: string; locale: string }): { subject: string; html: string } {
  const es = params.locale === "es";
  const subject = es
    ? "¡Bienvenido/a a Grumi! Tu Precio Fundador está asegurado"
    : "Welcome to Grumi! Your Founder's Price is locked in";
  const html = es ? welcomeHtmlEs(params.surveyUrl) : welcomeHtmlEn(params.surveyUrl);
  return { subject, html };
}

function footer(es: boolean): string {
  const line = es
    ? "Stratum PR LLC · Trujillo Alto, PR"
    : "Stratum PR LLC · Trujillo Alto, PR";
  const unsub = es
    ? "Si no solicitaste esto, ignora este correo."
    : "If you did not request this, you can ignore this email.";
  return `<p style="color:#9ca3af;font-size:11px;margin-top:24px;">${line}<br/>${unsub}</p>`;
}

function confirmationHtmlEs(confirmUrl: string): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
  <p style="font-size:18px;font-weight:700;color:#0f1923;margin:0 0 12px;">Grumi</p>
  <p style="color:#1f2937;line-height:1.6;">¡Gracias por tu interés en Grumi!</p>
  <p style="color:#4b5563;line-height:1.6;">Grumi es software para gestionar citas, clientes y tu negocio de grooming en Puerto Rico. Confirma tu correo para quedar en la lista de espera.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;background:#D4FF00;color:#0f1923;text-decoration:none;border-radius:9999px;font-weight:700;">Confirmar mi email</a>
  </div>
  <p style="color:#374151;font-size:14px;">Al confirmar, aseguras tu <strong>Precio Fundador</strong>: 25% de descuento en tu primer año al lanzar.</p>
  ${footer(true)}
</div>`;
}

function confirmationHtmlEn(confirmUrl: string): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
  <p style="font-size:18px;font-weight:700;color:#0f1923;margin:0 0 12px;">Grumi</p>
  <p style="color:#1f2937;line-height:1.6;">Thanks for your interest in Grumi!</p>
  <p style="color:#4b5563;line-height:1.6;">Grumi helps pet grooming businesses run appointments and clients in one place. Confirm your email to join the waitlist.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;background:#D4FF00;color:#0f1923;text-decoration:none;border-radius:9999px;font-weight:700;">Confirm my email</a>
  </div>
  <p style="color:#374151;font-size:14px;">When you confirm, you lock in the <strong>Founder's Price</strong>: 25% off your first year at launch.</p>
  ${footer(false)}
</div>`;
}

function welcomeHtmlEs(surveyUrl: string): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
  <p style="font-size:18px;font-weight:700;color:#0f1923;margin:0 0 12px;">Grumi</p>
  <p style="color:#1f2937;line-height:1.6;font-size:18px;font-weight:600;">¡Estás dentro! Tu Precio Fundador está asegurado.</p>
  <p style="color:#4b5563;line-height:1.6;">Tendrás acceso anticipado a la beta y <strong>25% de descuento en tu primer año</strong> en cualquier plan.</p>
  <p style="color:#4b5563;line-height:1.6;">Te notificaremos cuando Grumi esté listo para ti.</p>
  <p style="color:#374151;line-height:1.6;">Mientras tanto, ¿nos ayudas con unas preguntas rápidas?</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${surveyUrl}" style="display:inline-block;padding:12px 24px;background:#0f1923;color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:600;">Abrir encuesta</a>
  </div>
  ${footer(true)}
</div>`;
}

function welcomeHtmlEn(surveyUrl: string): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
  <p style="font-size:18px;font-weight:700;color:#0f1923;margin:0 0 12px;">Grumi</p>
  <p style="color:#1f2937;line-height:1.6;font-size:18px;font-weight:600;">You're in! Your Founder's Price is locked in.</p>
  <p style="color:#4b5563;line-height:1.6;">You'll get early beta access and <strong>25% off your first year</strong> on any plan.</p>
  <p style="color:#4b5563;line-height:1.6;">We'll notify you when Grumi is ready.</p>
  <p style="color:#374151;line-height:1.6;">In the meantime, would you answer a few quick questions?</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${surveyUrl}" style="display:inline-block;padding:12px 24px;background:#0f1923;color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:600;">Open survey</a>
  </div>
  ${footer(false)}
</div>`;
}

export async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom(),
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}
