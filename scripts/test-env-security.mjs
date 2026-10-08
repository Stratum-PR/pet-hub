#!/usr/bin/env node
// Access-control tests against Grumi's LOCAL test stack: real Postgres (RLS, triggers) through the real API,
// signed in as real users. Run it with `npm run test:security` after `npm run test:env:up`; it refuses to run
// against anything that isn't localhost.
//
// Each check here is an attack that worked before its fix. Keep them: they stop the hole from reopening.
import { createClient } from '@supabase/supabase-js';

const API = process.env.TEST_API_URL;
const ANON = process.env.TEST_ANON_KEY;
const SERVICE = process.env.TEST_SERVICE_KEY;

if (!API || !ANON || !SERVICE) {
  console.error('Missing TEST_API_URL / TEST_ANON_KEY / TEST_SERVICE_KEY. Use: npm run test:security');
  process.exit(1);
}
const apiHost = new URL(API).hostname;
if (!['127.0.0.1', 'localhost'].includes(apiHost) || !API.includes(':5542')) {
  console.error(`Refusing to run: ${API} is not the local test stack (ports 55420-55429).`);
  process.exit(1);
}

const admin = createClient(API, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const run = Math.random().toString(36).slice(2, 8);
let failures = 0;

function check(label, cond, detail) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}`);
    if (detail !== undefined) console.log('     ', JSON.stringify(detail).slice(0, 600));
  }
}

/**
 * A signed-in user. `profile` is applied with the service role, the way the server-side signup paths do it.
 * A label containing '@' is used as the full email address.
 */
async function newUser(label, profile, metadata = {}) {
  const email = label.includes('@') ? label : `${label}-${run}@grumi.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: metadata });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const id = data.user.id;
  if (profile) {
    const { error: upErr } = await admin.from('profiles').upsert({ id, email, ...profile }, { onConflict: 'id' });
    if (upErr) throw new Error(`profile ${label}: ${upErr.message}`);
  }
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr) throw new Error(`sign-in link ${label}: ${linkErr.message}`);
  const client = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: sErr } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' });
  if (sErr || !s.session) throw new Error(`sign in ${label}: ${sErr?.message ?? 'no session'}`);
  const db = createClient(API, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${s.session.access_token}` } },
  });
  return { id, db };
}

async function profileOf(id) {
  const { data } = await admin
    .from('profiles')
    .select('role, business_id, staff_id, full_name, is_super_admin, prefer_admin_dashboard_on_login')
    .eq('id', id)
    .single();
  return data;
}

/** Self-service signup through the public API, the way Register.tsx does it (email confirmation is off locally). */
async function signUp(email, metadata = {}) {
  const db = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signUp({ email, password: `Pw-${run}-x9!`, options: { data: metadata } });
  if (error || !data.session) throw new Error(`signUp ${email}: ${error?.message ?? 'no session'}`);
  return { id: data.user.id, db };
}

async function main() {
  console.log(`\nGrumi access-control checks on ${API} (run ${run})\n`);

  // ---------- seed: a business with one private customer ----------
  const { data: biz, error: bizErr } = await admin
    .from('businesses')
    .insert({
      name: `Victim ${run}`,
      email: `victim-${run}@grumi.test`,
      short_code: `V${run}`.toUpperCase().slice(0, 6),
      slug: `victim-${run}`,
      subscription_tier: 'basic',
    })
    .select('id')
    .single();
  if (bizErr) throw new Error(`business: ${bizErr.message}`);
  const victim = biz.id;
  const { error: cErr } = await admin
    .from('clients')
    .insert({ business_id: victim, first_name: 'Private', last_name: 'Customer', email: `private-${run}@grumi.test` });
  if (cErr) throw new Error(`client: ${cErr.message}`);

  // Each attack uses its own fresh client, so one attack succeeding can't decide another check's result.
  const freshClient = (label) => newUser(label, { role: 'client' });
  /** A signed-in user whose profile row is gone, to exercise the INSERT path. */
  async function rowlessUser(label) {
    const u = await newUser(label, null);
    const { error } = await admin.from('profiles').delete().eq('id', u.id);
    if (error) throw new Error(`delete profile ${label}: ${error.message}`);
    return { ...u, email: `${label}-${run}@grumi.test` };
  }

  console.log('Profiles: users cannot rewrite their own role, business or staff link');
  const stranger = await freshClient('stranger');
  let r = await stranger.db.from('profiles').update({ role: 'manager', business_id: victim }).eq('id', stranger.id).select();
  let p = await profileOf(stranger.id);
  check('client cannot make themselves manager of another business', !!r.error && p.role === 'client' && p.business_id === null, { r, p });

  const mover = await freshClient('mover');
  r = await mover.db.from('profiles').update({ business_id: victim }).eq('id', mover.id).select();
  p = await profileOf(mover.id);
  check('client cannot move themselves into another business', !!r.error && p.business_id === null, { r, p });

  const climber = await freshClient('climber');
  r = await climber.db.from('profiles').update({ role: 'manager' }).eq('id', climber.id).select();
  p = await profileOf(climber.id);
  check('client cannot promote themselves to manager', !!r.error && p.role === 'client', { r, p });

  // set_profile_business_id is SECURITY DEFINER and trusts its arguments; only signup functions may call it.
  const caller = await freshClient('rpc');
  r = await caller.db.rpc('set_profile_business_id', { p_uid: caller.id, p_business_id: victim });
  p = await profileOf(caller.id);
  check('client cannot call set_profile_business_id to join another business', !!r.error && p.role === 'client' && p.business_id === null, { r, p });

  const { data: seen } = await stranger.db.from('clients').select('id').eq('business_id', victim);
  check("stranger still cannot read the business's customers", (seen ?? []).length === 0, seen);

  console.log('Profiles: users cannot insert a profile row with a role, business or staff link');
  const inserter = await rowlessUser('inserter');
  r = await inserter.db.from('profiles').insert({ id: inserter.id, email: inserter.email, role: 'manager', business_id: victim }).select();
  p = await profileOf(inserter.id);
  check('user cannot insert their own profile as manager of another business', !!r.error && !p, { r, p });

  const plain = await rowlessUser('plain');
  r = await plain.db.from('profiles').insert({ id: plain.id, email: plain.email, role: 'client' }).select();
  p = await profileOf(plain.id);
  check('user can still insert their own plain client profile', !r.error && p?.role === 'client' && p.business_id === null, { r, p });

  console.log('Profiles: normal self-service still works');
  r = await stranger.db.from('profiles').update({ full_name: 'Renamed Person' }).eq('id', stranger.id).select();
  check('user can edit their own name', !r.error && (await profileOf(stranger.id)).full_name === 'Renamed Person', r);

  // Register.tsx writes role: 'client' right after client signup; unchanged values must keep working.
  r = await stranger.db.from('profiles').update({ role: 'client', full_name: 'Client Signup' }).eq('id', stranger.id).select();
  check("client signup's role write (unchanged value) still works", !r.error, r);

  r = await stranger.db.from('profiles').update({ prefer_admin_dashboard_on_login: true }).eq('id', stranger.id).select();
  check('user can toggle prefer_admin_dashboard_on_login (AccountSettings)', !r.error && (await profileOf(stranger.id)).prefer_admin_dashboard_on_login === true, r);

  console.log('Signup: real self-service registration still works');
  const registered = await signUp(`registered-${run}@grumi.test`, { full_name: 'Real Client' });
  p = await profileOf(registered.id);
  check('client signUp creates a client profile', p?.role === 'client' && p.business_id === null, p);
  r = await registered.db.from('profiles').update({ role: 'client', full_name: 'Real Client' }).eq('id', registered.id).select();
  check("Register.tsx's profile write after a real signUp succeeds", !r.error, r);

  // Register.tsx (main and dev) saves the client's global record with this payload, `name` included.
  const registeredEmail = `registered-${run}@grumi.test`;
  r = await registered.db
    .from('clients')
    .insert({
      id: crypto.randomUUID(),
      profile_id: registered.id,
      business_id: null,
      name: 'Real Client',
      first_name: 'Real',
      last_name: 'Client',
      email: registeredEmail,
      phone: null,
      notes: null,
      marketing_email_opt_in: false,
      marketing_sms_opt_in: false,
    })
    .select('id')
    .single();
  check("Register.tsx's clients insert (with name) succeeds", !r.error && !!r.data?.id, r);
  // send-appointment-reminder reads the client this way (service role).
  r = await admin.from('clients').select('email, name, profile_id').eq('profile_id', registered.id).maybeSingle();
  check("send-appointment-reminder's client lookup returns the client", !r.error && r.data?.email === registeredEmail && r.data?.name === 'Real Client', r);

  console.log('Signup: an invited employee is linked to the business and staff row');
  const inviteEmail = `employee-${run}@grumi.test`;
  const inviter = await newUser('inviter', null);
  const { data: staffRow, error: staffErr } = await admin
    .from('staff')
    .insert({ business_id: victim, name: 'Eve Employee', first_name: 'Eve', last_name: 'Employee', email: inviteEmail, phone: '7870000000', pin: '0000' })
    .select('id')
    .single();
  if (staffErr) throw new Error(`staff: ${staffErr.message}`);
  const { error: invErr } = await admin.from('staff_invites').insert({ business_id: victim, staff_id: staffRow.id, email: inviteEmail, invited_by: inviter.id });
  if (invErr) throw new Error(`staff invite: ${invErr.message}`);
  const employee = await signUp(inviteEmail);
  p = await profileOf(employee.id);
  check('invited employee gets role employee with business and staff link', p?.role === 'employee' && p.business_id === victim && p.staff_id === staffRow.id, p);
  r = await employee.db.from('profiles').update({ full_name: 'Eve E.' }).eq('id', employee.id).select();
  check('employee can edit their own name', !r.error, r);
  r = await employee.db.from('profiles').update({ role: 'client' }).eq('id', employee.id).select();
  check('employee cannot change their own role', !!r.error && (await profileOf(employee.id)).role === 'employee', r);

  console.log('Super admins: AdminDashboard paths still work');
  const superAdmin = await newUser(`qa-sa-${run}@stratumpr.com`, null);
  check('a @stratumpr.com signup is a super admin (unchanged; see SECURITY_RISKS S-1)', (await profileOf(superAdmin.id))?.is_super_admin === true);
  const target = await freshClient('target');
  r = await superAdmin.db.rpc('admin_set_profile_role', { p_profile_id: target.id, p_role: 'manager' });
  check("admin_set_profile_role still changes another user's role", !r.error && (await profileOf(target.id)).role === 'manager', r);
  r = await superAdmin.db.from('profiles').update({ business_id: victim }).eq('id', target.id).select();
  check("super admin can still set another profile's business directly", !r.error && (await profileOf(target.id)).business_id === victim, r);
  r = await target.db.rpc('admin_set_profile_role', { p_profile_id: target.id, p_role: 'super_admin' });
  check('non-admin cannot call admin_set_profile_role', !!r.error && (await profileOf(target.id)).is_super_admin === false, r);

  console.log('Signup: server-side paths can still link profiles');
  const owner = await newUser('owner', null, { role: 'manager', full_name: 'New Owner' });
  r = await owner.db.rpc('complete_manager_signup', { p_business_name: `Owner Grooming ${run}`, p_subscription_tier: 'basic' });
  p = await profileOf(owner.id);
  check('new manager signup creates and links their business', !r.error && p.role === 'manager' && !!p.business_id, { r, p });

  const { error: svcErr } = await admin.from('profiles').update({ business_id: victim }).eq('id', stranger.id);
  check('service role can still change a profile link', !svcErr && (await profileOf(stranger.id)).business_id === victim, svcErr);

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll access-control checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('\n✗ Test run stopped:', e.message);
  process.exit(1);
});
