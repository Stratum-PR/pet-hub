import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { resolveAppBase } from "../_shared/waitlist_cors.ts";
import { sendResendEmail, welcomeEmail } from "../_shared/waitlist_email_html.ts";

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const appBase = resolveAppBase(req);

  const url = new URL(req.url);
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

  const locale = row.locale === "en" ? "en" : "es";

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

  const email = row.email as string;
  const surveyUrl = `${appBase}/waitlist/confirmed?survey_token=${encodeURIComponent(surveyToken)}`;

  if (resendKey) {
    const { subject, html } = welcomeEmail({ surveyUrl, locale });
    const sent = await sendResendEmail({ to: email, subject, html });
    if (!sent.ok) {
      console.error("Resend welcome", sent.status, sent.body);
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `${appBase}/waitlist/confirmed?survey_token=${encodeURIComponent(surveyToken)}` },
  });
});
