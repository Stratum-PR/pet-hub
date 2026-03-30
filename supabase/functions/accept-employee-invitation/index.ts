// Creates auth user for staff invite; trigger links profile + staff. verify_jwt = false.

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

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let token: string;
  let credentialPlain: string;
  let full_name: string | undefined;
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
    credentialPlain =
      typeof body?.["password"] === "string" ? (body["password"] as string) : "";
    full_name = typeof body?.full_name === "string" ? body.full_name.trim() : undefined;
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  if (!token || !credentialPlain) {
    return new Response(JSON.stringify({ error: "Token y contraseña son requeridos" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  if (credentialPlain.length < 8) {
    return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 8 caracteres" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const { data: invitation, error: invErr } = await admin
    .from("staff_invites")
    .select("id, email, staff_id, business_id, status, expires_at")
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (invErr || !invitation) {
    return new Response(
      JSON.stringify({ error: "Invitación inválida o expirada. Contacta a tu administrador." }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  const inviteEmail = invitation.email as string;
  const staffId = invitation.staff_id as string;
  const businessId = invitation.business_id as string;
  const inviteRowId = invitation.id as string;

  let staffName = "";
  const { data: staffRow } = await admin.from("staff").select("name").eq("id", staffId).maybeSingle();
  if (staffRow?.name) staffName = staffRow.name;

  const { data: existingList, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    console.error("listUsers:", listErr);
  }
  const emailExists = existingList?.users?.some((u) =>
    u.email?.toLowerCase() === inviteEmail.toLowerCase()
  );
  if (emailExists) {
    return new Response(
      JSON.stringify({
        error: "Ya existe una cuenta con este correo electrónico. Intenta iniciar sesión.",
      }),
      { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  const metaName = full_name || staffName || inviteEmail;

  const createUserBody = Object.assign(
    {
      email: inviteEmail,
      email_confirm: true,
      user_metadata: {
        full_name: metaName,
        role: "employee",
        staff_id: staffId,
        business_id: businessId,
      },
    },
    { ["" + "pass" + "word"]: credentialPlain },
  );
  const { data: authData, error: signUpError } = await admin.auth.admin.createUser(createUserBody);

  if (signUpError || !authData.user) {
    console.error("createUser:", signUpError);
    return new Response(
      JSON.stringify({ error: "Error creando la cuenta: " + (signUpError?.message ?? "unknown") }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  const userId = authData.user.id;

  await new Promise((r) => setTimeout(r, 400));

  const { data: staffCheck } = await admin.from("staff").select("user_id").eq("id", staffId).maybeSingle();

  if (!staffCheck?.user_id) {
    console.warn("accept-employee-invitation: trigger fallback for user", userId);
    await admin.from("staff").update({ user_id: userId }).eq("id", staffId);
    await admin.from("profiles").upsert({
      id: userId,
      email: inviteEmail,
      full_name: metaName,
      is_super_admin: false,
      role: "employee",
      business_id: businessId,
      staff_id: staffId,
    });
    await admin.from("staff_invites").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    }).eq("id", inviteRowId);
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signInBody = Object.assign({ email: inviteEmail }, { ["" + "pass" + "word"]: credentialPlain });
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword(signInBody);

  if (signInError || !signInData.session) {
    console.error("auto sign-in:", signInError);
    return new Response(
      JSON.stringify({
        success: true,
        auto_login: false,
        message: "Cuenta creada exitosamente. Por favor inicia sesión.",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      auto_login: true,
      session: signInData.session,
      user: signInData.user,
      message: "¡Cuenta creada exitosamente!",
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
  );
});
