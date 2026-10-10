// run-automations: runs the admin portal's automations (trigger -> action).
//
// Called by:
//  - the daily pg_cron job (header x-cron-secret, checked against Vault) -> mode "run"
//  - a signed-in super admin from the admin portal -> modes "preview" (who would get it today, nothing sent),
//    "test" (one sample email to the admin) and "run" (same as the daily job, safe to repeat).
//
// Today's only trigger is pet_birthday and the only action is email_owner.
// Each pet gets at most one birthday email per year (automation_runs unique index).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import {
  birthdayDueToday,
  bodyToHtml,
  petAge,
  renderTemplate,
  senderName,
  todayInZone,
  type TemplateValues,
} from "./logic.ts";

type Mode = "run" | "preview" | "test";
type Body = { mode?: Mode; automation_id?: string };

type Automation = {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  action_config: { subject?: string; body?: string } | null;
  enabled: boolean;
};

type PreviewItem = { business: string; pet: string; owner: string; email: string };

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const isLocal = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return {
    "Access-Control-Allow-Origin": isLocal || allowed.length === 0 || allowed.includes(origin) ? origin || "*" : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function json(req: Request, status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

const FROM_ADDRESS = () => {
  const configured = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "";
  const match = configured.match(/<([^>]+)>/);
  return (match ? match[1] : configured).trim() || "no-reply@grumi.pet";
};

async function sendEmail(
  resendKey: string,
  args: { fromName: string; to: string; replyTo?: string | null; subject: string; html: string; text: string }
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const post = (address: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${args.fromName} <${address}>`,
        to: [args.to],
        reply_to: args.replyTo || undefined,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
  let res = await post(FROM_ADDRESS());
  if (!res.ok && FROM_ADDRESS() !== "no-reply@grumi.pet") res = await post("no-reply@grumi.pet");
  if (res.ok) return { ok: true };
  return { ok: false, detail: `resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
}

const FOOTER = (business: string) =>
  `Recibes este correo porque aceptaste recibir correos de ${business}. Si no deseas recibir más, responde a este mensaje.`;

function renderEmail(automation: Automation, values: TemplateValues) {
  const subject = renderTemplate(automation.action_config?.subject ?? "", values).trim() || automation.name;
  const text = renderTemplate(automation.action_config?.body ?? "", values);
  const footer = FOOTER(values.business_name);
  return { subject, text: `${text}\n\n${footer}`, html: bodyToHtml(text, values.business_name, footer) };
}

/** Run (or preview) one pet-birthday automation across every business that hasn't switched it off. */
async function runPetBirthday(
  db: SupabaseClient,
  automation: Automation,
  opts: { send: boolean; resendKey: string; now: Date }
) {
  const summary = { sent: 0, failed: 0, skipped_no_optin: 0, already_sent: 0, preview: [] as PreviewItem[] };

  const [{ data: businesses }, { data: settings }, { data: optOuts }] = await Promise.all([
    db.from("businesses").select("id, name, email"),
    db.from("settings").select("business_id, business_name, timezone"),
    db.from("business_automation_settings").select("business_id").eq("automation_id", automation.id).eq("enabled", false),
  ]);
  const off = new Set((optOuts ?? []).map((r: { business_id: string }) => r.business_id));
  const settingsByBiz = new Map(
    (settings ?? []).map((s: { business_id: string; business_name: string | null; timezone: string | null }) => [s.business_id, s])
  );

  for (const biz of (businesses ?? []) as { id: string; name: string; email: string | null }[]) {
    if (off.has(biz.id)) continue;
    const st = settingsByBiz.get(biz.id);
    const businessName = st?.business_name?.trim() || biz.name;
    const today = todayInZone(opts.now, st?.timezone);
    const occurrence = String(today.year);

    const { data: pets } = await db
      .from("pets")
      .select("id, name, birth_month, birth_day, birth_year, client_id")
      .eq("business_id", biz.id)
      .eq("birth_month", today.month);
    const due = ((pets ?? []) as {
      id: string;
      name: string;
      birth_month: number | null;
      birth_day: number | null;
      birth_year: number | null;
      client_id: string | null;
    }[]).filter((p) => p.client_id && birthdayDueToday(p, today));
    if (due.length === 0) continue;

    const [{ data: clients }, { data: sentRows }] = await Promise.all([
      db
        .from("clients")
        .select("id, email, first_name, last_name, marketing_email_opt_in, merged_into_client_id")
        .in("id", due.map((p) => p.client_id as string)),
      db
        .from("automation_runs")
        .select("pet_id")
        .eq("automation_id", automation.id)
        .eq("occurrence_key", occurrence)
        .eq("status", "sent")
        .in("pet_id", due.map((p) => p.id)),
    ]);
    const clientById = new Map(
      ((clients ?? []) as {
        id: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        marketing_email_opt_in: boolean | null;
        merged_into_client_id: string | null;
      }[]).map((c) => [c.id, c])
    );
    const alreadySent = new Set((sentRows ?? []).map((r: { pet_id: string }) => r.pet_id));

    for (const pet of due) {
      if (alreadySent.has(pet.id)) {
        summary.already_sent += 1;
        continue;
      }
      const owner = clientById.get(pet.client_id as string);
      const email = owner?.email?.trim();
      if (!owner || !email || owner.merged_into_client_id || owner.marketing_email_opt_in !== true) {
        summary.skipped_no_optin += 1;
        continue;
      }
      const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(" ").trim();
      const values: TemplateValues = {
        pet_name: pet.name,
        owner_first_name: owner.first_name?.trim() || ownerName || "",
        owner_name: ownerName,
        business_name: businessName,
        pet_age: petAge(pet.birth_year, today.year),
      };

      if (!opts.send) {
        summary.preview.push({ business: businessName, pet: pet.name, owner: ownerName, email });
        continue;
      }

      // Claim this occurrence first; the unique index stops a second concurrent run from sending again.
      const { data: claimed, error: claimErr } = await db
        .from("automation_runs")
        .insert({
          automation_id: automation.id,
          business_id: biz.id,
          pet_id: pet.id,
          client_id: owner.id,
          occurrence_key: occurrence,
          status: "sent",
          recipient: email,
        })
        .select("id")
        .single();
      if (claimErr || !claimed) {
        summary.already_sent += 1;
        continue;
      }

      const msg = renderEmail(automation, values);
      const result = await sendEmail(opts.resendKey, {
        fromName: senderName(businessName),
        to: email,
        replyTo: biz.email,
        ...msg,
      });
      if (result.ok) {
        summary.sent += 1;
      } else {
        summary.failed += 1;
        await db.from("automation_runs").update({ status: "failed", detail: result.detail }).eq("id", claimed.id);
      }
    }
  }
  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("NOTIFY_RESEND_API_KEY") ?? Deno.env.get("RESEND_API_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json(req, 500, { error: "server_misconfigured" });

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mode: Mode = body.mode === "preview" || body.mode === "test" ? body.mode : "run";

  // Who is calling: the daily job (secret) or a super admin (JWT).
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  let callerEmail: string | null = null;
  let callerId: string | null = null;
  if (cronSecret) {
    const { data: ok } = await db.rpc("automation_cron_secret_matches", { p_secret: cronSecret });
    if (ok !== true || mode !== "run") return json(req, 401, { error: "unauthorized" });
  } else {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: caller } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!caller?.user) return json(req, 401, { error: "unauthorized" });
    const { data: profile } = await db
      .from("profiles")
      .select("is_super_admin, email, full_name")
      .eq("id", caller.user.id)
      .maybeSingle();
    if (!profile?.is_super_admin) return json(req, 403, { error: "forbidden" });
    callerId = caller.user.id;
    callerEmail = (profile.email as string | null) ?? caller.user.email ?? null;
  }

  if ((mode === "run" || mode === "test") && !resendKey) return json(req, 500, { error: "email_not_configured" });

  let query = db.from("automations").select("id, name, trigger_type, action_type, action_config, enabled");
  if (body.automation_id) query = query.eq("id", body.automation_id);
  else query = query.eq("enabled", true);
  const { data: automations, error: autoErr } = await query;
  if (autoErr) return json(req, 500, { error: "load_failed" });

  const now = new Date();

  if (mode === "test") {
    const automation = (automations ?? [])[0] as Automation | undefined;
    if (!automation || !callerEmail) return json(req, 400, { error: "automation_or_email_missing" });
    const msg = renderEmail(automation, {
      pet_name: "Luna",
      owner_first_name: "Ana",
      owner_name: "Ana Rivera",
      business_name: "Tu negocio",
      pet_age: "3",
    });
    const result = await sendEmail(resendKey, {
      fromName: "Grumi",
      to: callerEmail,
      subject: `[Prueba] ${msg.subject}`,
      html: msg.html,
      text: msg.text,
    });
    await db.from("automation_runs").insert({
      automation_id: automation.id,
      occurrence_key: `test-${now.toISOString()}`,
      status: "test",
      recipient: callerEmail,
      detail: result.ok ? `test by ${callerId}` : result.detail,
    });
    return result.ok ? json(req, 200, { ok: true, sent_to: callerEmail }) : json(req, 502, { error: "send_failed" });
  }

  const results: Record<string, unknown> = {};
  for (const automation of (automations ?? []) as Automation[]) {
    if (mode === "run" && !automation.enabled) continue;
    if (automation.trigger_type === "pet_birthday" && automation.action_type === "email_owner") {
      results[automation.id] = await runPetBirthday(db, automation, { send: mode === "run", resendKey, now });
    }
  }
  return json(req, 200, { ok: true, mode, results });
});
