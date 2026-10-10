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
let knownOpen = 0;

function check(label, cond, detail) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}`);
    if (detail !== undefined) console.log('     ', JSON.stringify(detail).slice(0, 600));
  }
}

/**
 * A confirmed security issue that isn't fixed yet (REMEDIATION_PLAN P1-08). `blocked` is true once the attack fails.
 * While open it is reported, not failed; once a fix blocks it, the run fails until it is moved to check(), so the suite
 * never silently keeps an "expected" hole.
 */
function known(label, blocked, detail) {
  if (blocked) {
    failures++;
    console.log(`  ✗ ${label} — now BLOCKED: move it from known() to check()`);
  } else {
    knownOpen++;
    console.log(`  ○ known issue: ${label}`);
    if (detail !== undefined && process.env.VERBOSE) console.log('     ', JSON.stringify(detail).slice(0, 300));
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
  const pass = `Pw-${run}-x9!`; // throwaway, per run, local stack only
  const { data, error } = await db.auth.signUp({ email, password: pass, options: { data: metadata } });
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
  const registeredClientId = r.data?.id;
  // Client portal (ClientPortalPublicPage, main and dev): reads its own row by profile_id, saves it by id.
  r = await registered.db.from('clients').select('id, first_name, profile_id').eq('profile_id', registered.id).maybeSingle();
  check('client portal can still read its own client row', !r.error && r.data?.id === registeredClientId, r);
  r = await registered.db.from('clients').update({ phone: '7875550099', notes: 'portal edit' }).eq('id', registeredClientId).select('id, phone');
  check('client portal can still update its own client row', !r.error && (r.data ?? [])[0]?.phone === '7875550099', r);
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

  await knownIssues();

  console.log(`\n${knownOpen} known issue(s) open (REMEDIATION_PLAN Phase 2 fixes them; each fix moves one to check())`);
  console.log(failures ? `${failures} check(s) FAILED` : 'All access-control checks passed');
  process.exit(failures ? 1 : 0);
}

/** Attacks that still work today (P1-08). Each uses its own fresh rows. */
async function knownIssues() {
  console.log('\nKnown issues (P1-08): employees inside their own business');
  const { data: shop, error: shopErr } = await admin
    .from('businesses')
    .insert({ name: `Shop ${run}`, email: `shop-${run}@grumi.test`, short_code: `S${run}`.toUpperCase().slice(0, 6), slug: `shop-${run}`, subscription_tier: 'basic' })
    .select('id')
    .single();
  if (shopErr) throw new Error(`shop: ${shopErr.message}`);
  const staffRow = async (label) => {
    const { data, error } = await admin
      .from('staff')
      .insert({
        business_id: shop.id,
        name: label,
        first_name: label,
        last_name: run,
        email: `${label}-${run}@grumi.test`,
        phone: '7875550000',
        pin: String(1000 + Math.floor(Math.random() * 8999)),
        hourly_rate: 12,
        role: 'groomer',
        access_role: 'staff',
      })
      .select('id, pin')
      .single();
    if (error) throw new Error(`staff ${label}: ${error.message}`);
    return data;
  };
  const meStaff = await staffRow('worker');
  const coworker = await staffRow('coworker');
  const worker = await newUser('worker', { role: 'employee', business_id: shop.id, staff_id: meStaff.id });
  await admin.from('staff').update({ user_id: worker.id }).eq('id', meStaff.id);
  const staffOf = async (id) =>
    (
      await admin
        .from('staff')
        .select('hourly_rate, access_role, role, commission_rate, compensation_type, job_title_id, pin, first_name, birth_month')
        .eq('id', id)
        .single()
    ).data;
  const exists = async (table, id) => ((await admin.from(table).select('id').eq('id', id)).data ?? []).length === 1;
  const { data: title, error: titleErr } = await admin
    .from('staff_job_titles')
    .insert({ id: crypto.randomUUID(), business_id: shop.id, title: `Lead ${run}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select('id, title')
    .single();
  if (titleErr) throw new Error(`job title: ${titleErr.message}`);

  let r = await worker.db.from('staff').select('pin').eq('id', coworker.id);
  known("employee cannot read a coworker's kiosk PIN (P2-02)", !(r.data ?? []).some((x) => x.pin === coworker.pin), r);

  // P2-03: pay, job title and access columns on staff are manager-only (trigger staff_lock_pay_and_role_columns).
  r = await worker.db.from('staff').update({ hourly_rate: 99 }).eq('id', meStaff.id).select();
  check('employee cannot raise their own hourly rate (P2-03)', !!r.error && Number((await staffOf(meStaff.id)).hourly_rate) === 12, r);

  r = await worker.db.from('staff').update({ access_role: 'admin' }).eq('id', meStaff.id).select();
  // Already blocked in production's schema by the staff_enforce_access_role_mutations trigger; keep it that way.
  check('employee cannot give themselves admin access', (await staffOf(meStaff.id)).access_role === 'staff', r);

  r = await worker.db.from('staff').update({ role: 'Manager' }).eq('id', meStaff.id).select();
  check('employee cannot change their own role / job title text (P2-03)', !!r.error && (await staffOf(meStaff.id)).role === 'groomer', r);

  r = await worker.db.from('staff').update({ job_title_id: title.id }).eq('id', meStaff.id).select();
  let s = await staffOf(meStaff.id);
  check('employee cannot change their own job title (sets role) (P2-03)', !!r.error && s.job_title_id === null && s.role === 'groomer', { r, s });

  r = await worker.db.from('staff').update({ commission_rate: 90 }).eq('id', meStaff.id).select();
  check('employee cannot set their own commission rate (P2-03)', !!r.error && (await staffOf(meStaff.id)).commission_rate === null, r);

  r = await worker.db.from('staff').update({ compensation_type: 'commission', commission_rate: 90 }).eq('id', meStaff.id).select();
  s = await staffOf(meStaff.id);
  check('employee cannot switch their own pay type to commission (P2-03)', !!r.error && s.compensation_type === 'hourly' && s.commission_rate === null, { r, s });

  r = await worker.db.from('staff').update({ hourly_rate: 1 }).eq('id', coworker.id).select();
  // Blocked by the P2-03 column lock and, since P2-01 staff, earlier by RLS: a coworker's row is not updatable
  // by an employee at all, so the update matches 0 rows instead of raising. Either way nothing may change.
  check(
    "employee cannot change a coworker's pay rate (P2-03)",
    (!!r.error || (r.data ?? []).length === 0) && Number((await staffOf(coworker.id)).hourly_rate) === 12,
    r
  );

  console.log('Staff: employee self-service and manager edits still work (P2-03)');
  // EmployeeManagement self-service save (main and dev): own profile fields plus their own kiosk PIN.
  let newPin;
  do newPin = String(1000 + Math.floor(Math.random() * 8999));
  while (newPin === meStaff.pin || newPin === coworker.pin);
  r = await worker.db
    .from('staff')
    .update({
      first_name: 'Worker',
      last_name: run,
      email: `worker-${run}@grumi.test`,
      phone: '7875550001',
      pin: newPin,
      pin_set_at: new Date().toISOString(),
      pin_required: false,
      birth_month: 5,
      birth_day: 4,
      birth_year: 1990,
      photo_url: null,
      offered_service_ids: [],
    })
    .eq('id', meStaff.id)
    .select()
    .single();
  s = await staffOf(meStaff.id);
  check('employee self-service save (name, phone, birthday, own PIN) still works', !r.error && s.pin === newPin && s.first_name === 'Worker' && s.birth_month === 5, { r, s });
  // AccountSettings birthday save.
  r = await worker.db.from('staff').update({ birth_month: 6, birth_day: 1, birth_year: 1990 }).eq('id', meStaff.id).select();
  check('employee can still save their birthday (AccountSettings)', !r.error && (await staffOf(meStaff.id)).birth_month === 6, r);
  // Unchanged values for locked columns are not a change.
  r = await worker.db.from('staff').update({ hourly_rate: 12, role: 'groomer', access_role: 'staff', phone: '7875550002' }).eq('id', meStaff.id).select();
  check('employee update that repeats unchanged pay/role values still works', !r.error, r);

  const boss = await newUser('boss', null, { role: 'manager', full_name: 'Boss Owner' });
  r = await boss.db.rpc('complete_manager_signup', { p_business_name: `Boss Grooming ${run}`, p_subscription_tier: 'basic' });
  const bossBiz = (await profileOf(boss.id))?.business_id;
  if (r.error || !bossBiz) throw new Error(`boss signup: ${r.error?.message ?? 'no business'}`);
  // Kiosk PINs are unique per business; avoid the PIN complete_manager_signup gave the owner.
  const bossPin = (await admin.from('staff').select('pin').eq('business_id', bossBiz).single()).data?.pin;
  const [hirePin, hirePin2] = ['4321', '4322', '4323'].filter((x) => x !== bossPin);
  const { data: hire, error: hireErr } = await admin
    .from('staff')
    .insert({ business_id: bossBiz, name: 'Hire', first_name: 'Hire', last_name: run, email: `hire-${run}@grumi.test`, phone: '7875550003', pin: hirePin, hourly_rate: 12, role: 'groomer', access_role: 'staff' })
    .select('id')
    .single();
  if (hireErr) throw new Error(`hire: ${hireErr.message}`);
  const { data: bossTitle, error: btErr } = await admin
    .from('staff_job_titles')
    .insert({ id: crypto.randomUUID(), business_id: bossBiz, title: `Bather ${run}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select('id, title')
    .single();
  if (btErr) throw new Error(`boss job title: ${btErr.message}`);
  // EmployeeManagement manager save sends every field, changed or not.
  r = await boss.db
    .from('staff')
    .update({
      first_name: 'Hire',
      last_name: run,
      job_title_id: bossTitle.id,
      pin: hirePin2,
      hourly_rate: 20,
      role: bossTitle.title,
      access_role: 'manager',
      compensation_type: 'commission',
      commission_rate: 35,
    })
    .eq('id', hire.id)
    .select()
    .single();
  s = await staffOf(hire.id);
  check(
    "manager can still change an employee's pay, commission, job title, access and PIN",
    !r.error &&
      Number(s.hourly_rate) === 20 &&
      Number(s.commission_rate) === 35 &&
      s.compensation_type === 'commission' &&
      s.job_title_id === bossTitle.id &&
      s.role === bossTitle.title &&
      s.access_role === 'manager' &&
      s.pin === hirePin2,
    { r, s }
  );
  const { error: svcRateErr } = await admin.from('staff').update({ hourly_rate: 13 }).eq('id', coworker.id);
  check('service role can still change a pay rate', !svcRateErr && Number((await staffOf(coworker.id)).hourly_rate) === 13, svcRateErr);

  await staffPolicies({ shop: shop.id, bossBiz, worker, meStaff, coworker, boss, hire });

  r = await worker.db.from('businesses').update({ subscription_tier: 'pro' }).eq('id', shop.id).select();
  const tier = (await admin.from('businesses').select('subscription_tier').eq('id', shop.id).single()).data?.subscription_tier;
  known('employee cannot change the business plan or billing (P2-01 businesses, SECURITY_RISKS S-7)', tier === 'basic', r);

  const { data: cli, error: cliErr } = await admin.from('clients').insert({ business_id: shop.id, first_name: 'Del', last_name: run }).select('id').single();
  if (cliErr) throw new Error(`client: ${cliErr.message}`);
  const { data: pet, error: petErr } = await admin.from('pets').insert({ business_id: shop.id, client_id: cli.id, name: `Del${run}` }).select('id').single();
  if (petErr) throw new Error(`pet: ${petErr.message}`);
  const { data: apt, error: aptErr } = await admin
    .from('appointments')
    .insert({
      business_id: shop.id,
      client_id: cli.id,
      pet_id: pet.id,
      staff_id: coworker.id,
      appointment_date: '2030-01-07',
      start_time: '10:00:00',
      end_time: '11:00:00',
      scheduled_date: '2030-01-07T14:00:00Z',
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (aptErr) throw new Error(`appointment: ${aptErr.message}`);
  r = await worker.db.from('appointments').delete().eq('id', apt.id).select();
  check("employee cannot delete the business's appointments (P2-01 appointments)", await exists('appointments', apt.id), r);
  r = await worker.db.from('pets').delete().eq('id', pet.id).select();
  check("employee cannot delete the business's pets (P2-01 pets)", await exists('pets', pet.id), r);
  r = await worker.db.from('clients').delete().eq('id', cli.id).select();
  check("employee cannot delete the business's clients (P2-01 clients)", await exists('clients', cli.id), r);
  r = await worker.db.from('staff').delete().eq('id', coworker.id).select();
  check('employee cannot delete a coworker (P2-01 staff)', await exists('staff', coworker.id), r);

  await clientPolicies({ shop: shop.id, bossBiz, worker, boss, hire });
  await petPolicies({ shop: shop.id, bossBiz, worker, boss, hire });
  await appointmentPolicies({ shop: shop.id, bossBiz, worker, meStaff, boss, hire });
}

/**
 * P2-01 appointments (decision 9): only managers delete appointments. Managers are is_business_manager(business_id):
 * super admin, profile role manager/super_admin of that business, or staff access_role admin/manager in it.
 * Employees keep reading, booking, rescheduling and changing the status of their business's appointments.
 * Cancelling is a status change in every frontend (AppointmentBook / AppointmentDetailsSheet / request decline on
 * remediation and dev, the EditAppointmentDialog status select on main), so the record stays.
 * Portal clients keep reading their own appointments.
 */
async function appointmentPolicies({ shop, bossBiz, worker, meStaff, boss, hire }) {
  console.log('Appointments: only managers delete appointments; employees still book, edit and cancel them (P2-01 appointments)');
  const aptRow = async (id) =>
    (await admin.from('appointments').select('id, status, appointment_date, start_time, decision_note').eq('id', id).maybeSingle()).data;
  const seedClient = async (business_id, first_name, extra = {}) => {
    const { data, error } = await admin.from('clients').insert({ business_id, first_name, last_name: run, ...extra }).select('id').single();
    if (error) throw new Error(`client ${first_name}: ${error.message}`);
    return data.id;
  };
  const seedPet = async (business_id, client_id, name) => {
    const { data, error } = await admin.from('pets').insert({ id: crypto.randomUUID(), business_id, client_id, name }).select('id').single();
    if (error) throw new Error(`pet ${name}: ${error.message}`);
    return data.id;
  };
  const slot = (business_id, client_id, pet_id, day, extra = {}) => ({
    id: crypto.randomUUID(),
    business_id,
    client_id,
    pet_id,
    appointment_date: `2030-02-${day}`,
    start_time: '09:00',
    end_time: '10:00',
    scheduled_date: `2030-02-${day}T13:00:00Z`,
    status: 'scheduled',
    ...extra,
  });
  const seedApt = async (business_id, client_id, pet_id, day, extra = {}) => {
    const { data, error } = await admin.from('appointments').insert(slot(business_id, client_id, pet_id, day, extra)).select('id').single();
    if (error) throw new Error(`appointment ${day}: ${error.message}`);
    return data.id;
  };

  // Own rows, so these checks don't depend on whether the delete attempt above was blocked.
  const owner = await seedClient(shop, 'AptOwner');
  const ownerPet = await seedPet(shop, owner, `AptPet${run}`);
  const kept = await seedApt(shop, owner, ownerPet, '04', { staff_id: meStaff.id });

  // Employee paths in the appointment book (useAppointments add/update, BookingFormDialog, main and dev).
  let r = await worker.db.from('appointments').select('id').eq('business_id', shop);
  check("employee can still read the business's appointments", !r.error && (r.data ?? []).some((x) => x.id === kept), r);
  r = await worker.db.from('appointments').insert(slot(shop, owner, ownerPet, '05', { staff_id: meStaff.id })).select().single();
  const booked = r.data?.id;
  check('employee can still book an appointment', !r.error && !!booked && !!(await aptRow(booked)), r);
  r = await worker.db
    .from('appointments')
    .update({ appointment_date: '2030-02-06', start_time: '11:00', end_time: '12:00', scheduled_date: '2030-02-06T15:00:00Z' })
    .eq('id', kept)
    .eq('business_id', shop)
    .select()
    .single();
  let a = await aptRow(kept);
  check('employee can still reschedule an appointment', !r.error && a?.appointment_date === '2030-02-06' && String(a?.start_time).startsWith('11:00'), { r, a });
  // AppointmentBook.setStatus (remediation and dev) and the EditAppointmentDialog status select (main).
  for (const status of ['confirmed', 'in_progress', 'completed', 'no_show', 'scheduled']) {
    r = await worker.db.from('appointments').update({ status }).eq('id', kept).eq('business_id', shop).select().single();
    check(`employee can still set an appointment to ${status}`, !r.error && (await aptRow(kept))?.status === status, r);
  }
  r = await worker.db.from('appointments').update({ status: 'canceled' }).eq('id', kept).eq('business_id', shop).select().single();
  a = await aptRow(kept);
  check("employee can still cancel an appointment (status 'canceled'; the row stays)", !r.error && a?.status === 'canceled', { r, a });
  r = await worker.db.from('appointments').update({ status: 'cancelled' }).eq('id', kept).eq('business_id', shop).select().single();
  a = await aptRow(kept);
  check("employee can still cancel from the edit dialog (status 'cancelled'; the row stays)", !r.error && a?.status === 'cancelled', { r, a });
  if (booked) {
    // AppointmentBook request decline: status canceled plus the decision audit fields.
    r = await worker.db
      .from('appointments')
      .update({ status: 'canceled', decision_note: 'No slot', decided_at: new Date().toISOString(), decided_by_staff_id: meStaff.id })
      .eq('id', booked)
      .eq('business_id', shop)
      .select()
      .single();
    a = await aptRow(booked);
    check('employee can still decline a booking request (status canceled; the row stays)', !r.error && a?.status === 'canceled' && a?.decision_note === 'No slot', { r, a });
    r = await worker.db.from('appointments').delete().eq('id', booked).eq('business_id', shop).select();
    check('employee cannot delete an appointment they just booked (P2-01 appointments)', !!(await aptRow(booked)), r);
  }

  // Manager delete, the way useAppointments.deleteAppointment does it (main).
  const bossOwner = await seedClient(bossBiz, 'BossAptOwner');
  const bossPet = await seedPet(bossBiz, bossOwner, `BossAptPet${run}`);
  const gone = await seedApt(bossBiz, bossOwner, bossPet, '10');
  r = await boss.db.from('appointments').delete().eq('id', gone).eq('business_id', bossBiz);
  check('manager can still delete an appointment', !r.error && !(await aptRow(gone)), r);
  r = await boss.db.from('appointments').update({ status: 'canceled' }).eq('id', kept).select();
  check("another business's manager cannot cancel this business's appointments", (await aptRow(kept))?.status === 'cancelled', r);
  r = await boss.db.from('appointments').delete().eq('id', kept).select();
  check("another business's manager cannot delete this business's appointments", !!(await aptRow(kept)), r);

  // Staff with access_role manager (profile role employee) count as managers (is_business_manager).
  const lead = await newUser('apt-lead', { role: 'employee', business_id: bossBiz, staff_id: hire.id }); // hire: access_role manager
  const leadGone = await seedApt(bossBiz, bossOwner, bossPet, '11');
  r = await lead.db.from('appointments').delete().eq('id', leadGone).select();
  check('staff with access_role manager can still delete an appointment', !r.error && !(await aptRow(leadGone)), r);

  // Super admin (AdminDashboard / support tools).
  const sa = await newUser(`qa-sa-apts-${run}@stratumpr.com`, null);
  const saGone = await seedApt(shop, owner, ownerPet, '12');
  r = await sa.db.from('appointments').delete().eq('id', saGone).select();
  check('super admin can still delete an appointment', !r.error && !(await aptRow(saGone)), r);
  // appointments.business_id is nullable; the old "Appointments delete" policy let super admin delete such rows.
  const saOrphan = await seedApt(null, null, null, '13');
  r = await sa.db.from('appointments').delete().eq('id', saOrphan).select();
  check('super admin can still delete an appointment with no business', !r.error && !(await aptRow(saOrphan)), r);

  // Client portal (ClientPortalPublicPage, main and dev): reads its own appointments by client_id.
  // Public booking (submit_booking_request) is SECURITY DEFINER and only inserts; e2e/09 covers it.
  const portal = await newUser('apt-portal', { role: 'client' });
  const portalClient = await seedClient(null, 'AptPortal', { profile_id: portal.id, email: `apt-portal-${run}@grumi.test` });
  const portalApt = await seedApt(shop, portalClient, null, '14');
  r = await portal.db.from('appointments').select('id, appointment_date, start_time, status').eq('client_id', portalClient);
  check('client portal can still read its own appointments', !r.error && (r.data ?? []).some((x) => x.id === portalApt), r);
  r = await portal.db.from('appointments').delete().eq('id', portalApt).select();
  check('a portal client cannot delete its own appointment', !!(await aptRow(portalApt)), r);
  r = await portal.db.from('appointments').delete().eq('id', kept).select();
  check("a portal client cannot delete a business's appointments", !!(await aptRow(kept)), r);
}

/**
 * P2-01 pets (decision 9): only managers delete a business's pets. Managers are is_business_manager(business_id):
 * super admin, profile role manager/super_admin of that business, or staff access_role admin/manager in it.
 * Employees keep reading, adding and editing their business's pets. Portal clients keep managing their own
 * global pets (business_id NULL) through the "Clients can ... own pets" policies.
 */
async function petPolicies({ shop, bossBiz, worker, boss, hire }) {
  console.log('Pets: only managers delete pets; employees still add and edit them (P2-01 pets)');
  const petRow = async (id) => (await admin.from('pets').select('id, name').eq('id', id).maybeSingle()).data;
  const seedClient = async (business_id, first_name, extra = {}) => {
    const { data, error } = await admin.from('clients').insert({ business_id, first_name, last_name: run, ...extra }).select('id').single();
    if (error) throw new Error(`client ${first_name}: ${error.message}`);
    return data.id;
  };
  const seedPet = async (business_id, client_id, name) => {
    const { data, error } = await admin.from('pets').insert({ id: crypto.randomUUID(), business_id, client_id, name }).select('id').single();
    if (error) throw new Error(`pet ${name}: ${error.message}`);
    return data.id;
  };

  // Own rows, so these checks don't depend on whether the delete attempt above was blocked.
  const owner = await seedClient(shop, 'PetOwner');
  const kept = await seedPet(shop, owner, `Kept${run}`);

  // Employee paths on the Pets page and in the booking dialogs (usePets add/update, main and dev).
  let r = await worker.db.from('pets').select('id').eq('business_id', shop);
  check("employee can still read the business's pets", !r.error && (r.data ?? []).some((x) => x.id === kept), r);
  r = await worker.db
    .from('pets')
    .insert({ id: crypto.randomUUID(), business_id: shop, client_id: owner, name: `Walk${run}`, species: 'dog', breed: 'Mixed', weight: 10 })
    .select('id')
    .single();
  const walkIn = r.data?.id;
  check('employee can still add a pet', !r.error && !!walkIn && !!(await petRow(walkIn)), r);
  r = await worker.db.from('pets').update({ name: 'Edited' }).eq('id', kept).select('id');
  check('employee can still edit a pet', !r.error && (await petRow(kept))?.name === 'Edited', r);
  if (walkIn) {
    r = await worker.db.from('pets').delete().eq('id', walkIn);
    check('employee cannot delete a pet they just added (P2-01 pets)', !!(await petRow(walkIn)), r);
  }

  // Manager delete, the way usePets.deletePet does it (main and dev).
  const bossOwner = await seedClient(bossBiz, 'BossPetOwner');
  const gone = await seedPet(bossBiz, bossOwner, `Gone${run}`);
  r = await boss.db.from('pets').delete().eq('id', gone);
  check('manager can still delete a pet', !r.error && !(await petRow(gone)), r);
  r = await boss.db.from('pets').delete().eq('id', kept).select();
  check("another business's manager cannot delete this business's pets", !!(await petRow(kept)), r);

  // Staff with access_role manager (profile role employee) count as managers (is_business_manager).
  const lead = await newUser('pet-lead', { role: 'employee', business_id: bossBiz, staff_id: hire.id }); // hire: access_role manager
  const leadGone = await seedPet(bossBiz, bossOwner, `LeadGone${run}`);
  r = await lead.db.from('pets').delete().eq('id', leadGone).select();
  check('staff with access_role manager can still delete a pet', !r.error && !(await petRow(leadGone)), r);

  // Super admin (AdminDashboard / support tools).
  const sa = await newUser(`qa-sa-pets-${run}@stratumpr.com`, null);
  const saGone = await seedPet(shop, owner, `SaGone${run}`);
  r = await sa.db.from('pets').delete().eq('id', saGone).select();
  check('super admin can still delete a pet', !r.error && !(await petRow(saGone)), r);
  // Global portal pets have no business (business_id NULL); the old "Pets delete" policy let super admin delete them.
  const globalOwner = await seedClient(null, 'GlobalPetOwner');
  const saGlobal = await seedPet(null, globalOwner, `SaGlobal${run}`);
  r = await sa.db.from('pets').delete().eq('id', saGlobal).select();
  check('super admin can still delete a pet with no business', !r.error && !(await petRow(saGlobal)), r);

  // Client portal (ClientPortalPublicPage, main and dev): reads, adds, edits and removes its own global pets.
  const portal = await newUser('pet-portal', { role: 'client' });
  const portalClient = await seedClient(null, 'Portal', { profile_id: portal.id, email: `pet-portal-${run}@grumi.test` });
  const portalPetId = crypto.randomUUID();
  r = await portal.db
    .from('pets')
    .insert({ id: portalPetId, client_id: portalClient, business_id: null, name: `Portal${run}`, species: 'cat', weight: 0, created_at: new Date().toISOString() });
  check('client portal can still add its own pet', !r.error && !!(await petRow(portalPetId)), r);
  r = await portal.db.from('pets').select('id').eq('client_id', portalClient);
  check('client portal can still read its own pets', !r.error && (r.data ?? []).some((x) => x.id === portalPetId), r);
  r = await portal.db
    .from('pets')
    .update({ client_id: portalClient, business_id: null, name: 'PortalEdited', updated_at: new Date().toISOString() })
    .eq('id', portalPetId);
  check('client portal can still edit its own pet', !r.error && (await petRow(portalPetId))?.name === 'PortalEdited', r);
  r = await portal.db.from('pets').delete().eq('id', portalPetId);
  check('client portal can still remove its own pet', !r.error && !(await petRow(portalPetId)), r);
  r = await portal.db.from('pets').delete().eq('id', kept).select();
  check("a portal client cannot delete a business's pets", !!(await petRow(kept)), r);
}

/**
 * P2-01 clients (decision 9): only managers delete clients. Managers are is_business_manager(business_id): super
 * admin, profile role manager/super_admin of that business, or staff access_role admin/manager in it. Employees
 * keep reading, adding and editing their business's clients.
 */
async function clientPolicies({ shop, bossBiz, worker, boss, hire }) {
  console.log('Clients: only managers delete clients; employees still add and edit them (P2-01 clients)');
  const clientRow = async (id) => (await admin.from('clients').select('id, first_name').eq('id', id).maybeSingle()).data;
  const seedClient = async (business_id, first_name) => {
    const { data, error } = await admin.from('clients').insert({ business_id, first_name, last_name: run }).select('id').single();
    if (error) throw new Error(`client ${first_name}: ${error.message}`);
    return data.id;
  };

  // Own row, so these checks don't depend on whether the delete attempt above was blocked.
  const kept = await seedClient(shop, 'Kept');

  // Employee paths on the Clients page and in the booking dialogs (useClients add/update, main and dev).
  let r = await worker.db.from('clients').select('id').eq('business_id', shop);
  check("employee can still read the business's clients", !r.error && (r.data ?? []).some((x) => x.id === kept), r);
  r = await worker.db
    .from('clients')
    .insert({ id: crypto.randomUUID(), business_id: shop, first_name: 'Walk', last_name: run, email: `walkin-${run}@grumi.test`, phone: '7875550020' })
    .select('id')
    .single();
  const walkIn = r.data?.id;
  check('employee can still add a client', !r.error && !!walkIn && !!(await clientRow(walkIn)), r);
  r = await worker.db.from('clients').update({ first_name: 'Edited' }).eq('id', kept).eq('business_id', shop).select('id');
  check('employee can still edit a client', !r.error && (await clientRow(kept))?.first_name === 'Edited', r);
  if (walkIn) {
    r = await worker.db.from('clients').delete().eq('id', walkIn).eq('business_id', shop).select();
    check('employee cannot delete a client they just added (P2-01 clients)', !!(await clientRow(walkIn)), r);
  }

  // Manager delete, the way useClients.deleteClient does it (main and dev).
  const gone = await seedClient(bossBiz, 'Gone');
  r = await boss.db.from('clients').delete().eq('id', gone).eq('business_id', bossBiz);
  check('manager can still delete a client', !r.error && !(await clientRow(gone)), r);
  r = await boss.db.from('clients').delete().eq('id', kept).select();
  check("another business's manager cannot delete this business's clients", !!(await clientRow(kept)), r);

  // Staff with access_role manager (profile role employee) count as managers (is_business_manager).
  const leadStaffId = hire.id; // access_role 'manager' since the P2-03 manager save above
  const lead = await newUser('client-lead', { role: 'employee', business_id: bossBiz, staff_id: leadStaffId });
  const leadGone = await seedClient(bossBiz, 'LeadGone');
  r = await lead.db.from('clients').delete().eq('id', leadGone).select();
  check('staff with access_role manager can still delete a client', !r.error && !(await clientRow(leadGone)), r);

  // Super admin (AdminDashboard / support tools).
  const sa = await newUser(`qa-sa-clients-${run}@stratumpr.com`, null);
  const saGone = await seedClient(shop, 'SaGone');
  r = await sa.db.from('clients').delete().eq('id', saGone).select();
  check('super admin can still delete a client', !r.error && !(await clientRow(saGone)), r);
  // Global portal clients have no business (business_id NULL); the old "Clients delete" policy let super admin delete them.
  const saGlobal = await seedClient(null, 'SaGlobal');
  r = await sa.db.from('clients').delete().eq('id', saGlobal).select();
  check('super admin can still delete a client with no business', !r.error && !(await clientRow(saGlobal)), r);
}

/**
 * P2-01 staff: one policy set on `staff`. Managers (super admin, profile manager, or staff access_role
 * admin/manager of that business) read, add, edit and remove staff; employees read their business's staff and
 * edit only their own row; everyone else sees nothing. Public booking reads staff through a SECURITY DEFINER RPC.
 */
async function staffPolicies({ shop, bossBiz, worker, meStaff, coworker, boss, hire }) {
  console.log('Staff: who may read, add, edit and remove staff rows (P2-01 staff)');
  const rowOf = async (id) => (await admin.from('staff').select('id, business_id, first_name, name').eq('id', id).maybeSingle()).data;
  const countEmail = async (email) => ((await admin.from('staff').select('id').eq('email', email)).data ?? []).length;
  const anon = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids = (r) => (r.data ?? []).map((x) => x.id);

  // Employees see their coworkers: staff page, schedules, appointment book, kiosk, birthdays (main and dev).
  let r = await worker.db
    .from('staff')
    .select('id, name, first_name, last_name, photo_url, status, role, offered_service_ids')
    .eq('business_id', shop);
  check('employee can still read their coworkers (schedules, kiosk, staff list)', !r.error && ids(r).includes(meStaff.id) && ids(r).includes(coworker.id), r);
  // useStaff (main and dev) and the time_entries / staff_shifts policies find the employee's own row by login.
  r = await worker.db.from('staff').select('id').eq('user_id', worker.id);
  check('employee can still read their own staff row by login (useStaff)', !r.error && ids(r).length === 1 && ids(r)[0] === meStaff.id, r);

  r = await worker.db.from('staff').update({ first_name: 'Hacked' }).eq('id', coworker.id).select();
  check("employee cannot edit a coworker's staff row (P2-01 staff)", (await rowOf(coworker.id))?.first_name === 'coworker', r);
  r = await worker.db.from('staff').update({ business_id: bossBiz }).eq('id', meStaff.id).select();
  check('employee cannot move their own staff row to another business (P2-01 staff)', (await rowOf(meStaff.id))?.business_id === shop, r);

  const sneakEmail = `sneak-${run}@grumi.test`;
  r = await worker.db
    .from('staff')
    .insert({ business_id: shop, name: 'Sneak', first_name: 'Sneak', last_name: run, email: sneakEmail, phone: '7875550009', pin: '', hourly_rate: 99, access_role: 'staff' })
    .select();
  check('employee cannot add a staff row (P2-01 staff)', !!r.error && (await countEmail(sneakEmail)) === 0, r);

  // Clients, strangers, other businesses' managers and anonymous visitors see and change nothing.
  const outsider = await newUser('outsider', { role: 'client' });
  r = await outsider.db.from('staff').select('id').eq('business_id', shop);
  check("a client cannot read a business's staff", !r.error && ids(r).length === 0, r);
  r = await anon.from('staff').select('id').eq('business_id', shop);
  check("an anonymous visitor cannot read a business's staff", ids(r).length === 0, r);
  r = await boss.db.from('staff').select('id').eq('business_id', shop);
  check("another business's manager cannot read this business's staff", !r.error && ids(r).length === 0, r);
  const coworkerName = (await rowOf(coworker.id))?.first_name;
  r = await boss.db.from('staff').update({ first_name: 'Poached' }).eq('id', coworker.id).select();
  check("another business's manager cannot edit this business's staff", (await rowOf(coworker.id))?.first_name === coworkerName, r);
  const poachEmail = `poach-${run}@grumi.test`;
  r = await boss.db
    .from('staff')
    .insert({ business_id: shop, name: 'Poach', first_name: 'Poach', last_name: run, email: poachEmail, phone: '7875550010', pin: '', access_role: 'staff' })
    .select();
  check("another business's manager cannot add staff to this business", !!r.error && (await countEmail(poachEmail)) === 0, r);
  r = await boss.db.from('staff').delete().eq('id', coworker.id).select();
  check("another business's manager cannot remove this business's staff", !!(await rowOf(coworker.id)), r);

  // Public booking page (dev): groomers come from the SECURITY DEFINER RPC, not from the table.
  r = await anon.rpc('get_public_booking_options', { p_slug: `shop-${run}` });
  const groomers = r.data?.groomers ?? [];
  check(
    'public booking still lists the groomers (get_public_booking_options)',
    !r.error && groomers.some((g) => g.id === coworker.id && typeof g.display_name === 'string' && g.display_name.trim().length > 0),
    r
  );

  // Super admin support tools (SupportImpersonationDialog) read any business's staff.
  const sa = await newUser(`qa-sa-staff-${run}@stratumpr.com`, null);
  r = await sa.db.from('staff').select('id, name, email, user_id, access_role, status').eq('business_id', shop).eq('status', 'active');
  check("super admin can still read any business's staff", !r.error && ids(r).includes(coworker.id), r);

  // Manager CRUD, the way EmployeeManagement's add / save / delete do it (main and dev).
  const newEmail = `newhire-${run}@grumi.test`;
  r = await boss.db
    .from('staff')
    .insert({ business_id: bossBiz, name: 'New Hire', first_name: 'New', last_name: run, email: newEmail, phone: '7875550011', pin: '', hourly_rate: 15, role: 'groomer', access_role: 'staff' })
    .select()
    .single();
  const newId = r.data?.id;
  check('manager can still add a staff member', !r.error && !!newId, r);
  r = await boss.db.from('staff').select('id').eq('business_id', bossBiz);
  check("manager can still read their business's staff", !r.error && ids(r).includes(newId) && ids(r).includes(hire.id), r);
  r = await boss.db.from('staff').update({ first_name: 'Renamed' }).eq('id', newId).select().single();
  check('manager can still edit a staff member', !r.error && (await rowOf(newId))?.first_name === 'Renamed', r);
  r = await boss.db.from('staff').delete().eq('id', newId).select();
  check('manager can still remove a staff member', !r.error && !(await rowOf(newId)), r);

  // A staff member with access_role manager (profile role employee) keeps managing staff (can_manage_staff_private).
  const lead = await newUser('lead', { role: 'employee', business_id: bossBiz, staff_id: hire.id });
  await admin.from('staff').update({ user_id: lead.id }).eq('id', hire.id);
  const leadEmail = `leadhire-${run}@grumi.test`;
  r = await lead.db
    .from('staff')
    .insert({ business_id: bossBiz, name: 'Lead Hire', first_name: 'Lead', last_name: run, email: leadEmail, phone: '7875550012', pin: '', access_role: 'staff' })
    .select()
    .single();
  const leadHireId = r.data?.id;
  check('staff with access_role manager can still add a staff member', !r.error && !!leadHireId, r);
  r = await lead.db.from('staff').update({ first_name: 'Edited' }).eq('id', leadHireId).select().single();
  check('staff with access_role manager can still edit a staff member', !r.error && (await rowOf(leadHireId))?.first_name === 'Edited', r);
  r = await lead.db.from('staff').delete().eq('id', leadHireId).select();
  check('staff with access_role manager can still remove a staff member', !r.error && !(await rowOf(leadHireId)), r);
}

main().catch((e) => {
  console.error('\n✗ Test run stopped:', e.message);
  process.exit(1);
});
