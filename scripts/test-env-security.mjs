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
  await pinHashing({ shop: shop.id, bossBiz, worker, meStaff, workerPin: newPin, coworker, boss, hire, hirePin, hirePin2 });
  await managerPinHashing({ shop: shop.id, bossBiz, worker, coworker, boss, hirePin2 });

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

/**
 * P2-02: kiosk PINs are also stored as bcrypt hashes (pgcrypto crypt, one salt per business) in staff_pin_hashes,
 * kept in sync by a trigger on staff, and every PIN check compares hashes. Expand-only: the plain staff.pin column
 * stays (main's frontend still reads and writes it), so the known() coworker-PIN read above stays open until the
 * contract step. Here: hashes are written for every write path, nobody but the service role reads them, main's and
 * dev's lookups and clock_in_out keep working, and the remediation frontend's RPCs find staff without the plain PIN.
 */
async function pinHashing({ shop, bossBiz, worker, meStaff, workerPin, coworker, boss, hire, hirePin, hirePin2 }) {
  console.log('Staff PINs: hashed alongside the plain PIN, checked by hash (P2-02)');
  const anon = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const hashOf = async (staffId) =>
    (await admin.from('staff_pin_hashes').select('pin_hash, business_id').eq('staff_id', staffId).maybeSingle()).data;
  const isBcrypt = (h, pin) => typeof h === 'string' && /^\$2[abxy]\$\d\d\$/.test(h) && h.length === 60 && !h.includes(pin);
  const lookup = async (who, businessId, pin) => who.rpc('kiosk_staff_by_pin', { p_business_id: businessId, p_pin: pin });
  const found = (r) => (Array.isArray(r.data) ? r.data : r.data ? [r.data] : []);

  // Hashes exist for rows written by the service role, a manager (main's EmployeeManagement) and the employee's
  // own self-service PIN change; none of them holds the plain PIN.
  let h = await hashOf(coworker.id);
  check('a staff PIN written by the service role gets a bcrypt hash', isBcrypt(h?.pin_hash, coworker.pin) && h.business_id === shop, h);
  h = await hashOf(meStaff.id);
  const workerHash = h?.pin_hash;
  check("an employee's own self-service PIN change is hashed (trigger on update)", isBcrypt(workerHash, workerPin), h);
  h = await hashOf(hire.id);
  check("a manager's PIN change is hashed (trigger on update)", isBcrypt(h?.pin_hash, hirePin2) && h.business_id === bossBiz, h);

  // main and dev (useTimeKiosk.getEmployeeByPin): select('*') ... eq('pin', typed PIN). Must keep working.
  let r = await worker.db.from('staff').select('*').eq('pin', coworker.pin).eq('business_id', shop).eq('status', 'active').single();
  check("main's kiosk lookup by plain PIN still works", !r.error && r.data?.id === coworker.id, r);

  // remediation (useTimeKiosk.getEmployeeByPin): kiosk_staff_by_pin compares hashes and never returns the PIN.
  r = await lookup(worker.db, shop, coworker.pin);
  check(
    'kiosk_staff_by_pin finds the staff member by hash, without returning a PIN',
    !r.error && found(r).length === 1 && found(r)[0].id === coworker.id && !('pin' in found(r)[0]) && !('pin_hash' in found(r)[0]),
    r
  );
  r = await lookup(worker.db, shop, workerPin);
  check('kiosk_staff_by_pin finds the new PIN after a self-service change', !r.error && found(r)[0]?.id === meStaff.id, r);
  r = await lookup(worker.db, shop, meStaff.pin);
  check('the old PIN no longer finds anyone after a PIN change', !r.error && found(r).length === 0, r);
  r = await lookup(boss.db, bossBiz, hirePin2);
  check("kiosk_staff_by_pin finds a manager-changed PIN", !r.error && found(r)[0]?.id === hire.id, r);
  r = await lookup(boss.db, bossBiz, hirePin);
  check("a manager-replaced PIN no longer finds anyone", !r.error && found(r).length === 0, r);
  r = await lookup(boss.db, shop, coworker.pin);
  check("another business's manager cannot look up this business's PINs", !!r.error || found(r).length === 0, r);
  r = await lookup(anon, shop, coworker.pin);
  check('an anonymous visitor cannot call kiosk_staff_by_pin', !!r.error || found(r).length === 0, r);

  // clock_in_out (main, dev and remediation pass the typed PIN) compares hashes.
  r = await worker.db.rpc('clock_in_out', { p_employee_pin: coworker.pin, p_business_id: shop });
  check('clock in by PIN still works (hash compare)', !r.error && r.data?.success === true && r.data?.action === 'clock_in', r);
  r = await worker.db.rpc('clock_in_out', { p_employee_pin: coworker.pin, p_business_id: shop });
  check('clock out by PIN still works (hash compare)', !r.error && r.data?.success === true && r.data?.action === 'clock_out', r);
  r = await worker.db.rpc('clock_in_out', { p_employee_pin: workerPin, p_business_id: shop });
  check('clock in with a self-service-changed PIN works', !r.error && r.data?.success === true, r);
  r = await worker.db.rpc('clock_in_out', { p_employee_pin: meStaff.pin, p_business_id: shop });
  check('clock in with a replaced PIN is refused (invalid_pin)', r.data?.success === false && r.data?.error === 'invalid_pin', r);
  r = await worker.db.rpc('clock_in_out', { p_employee_pin: '', p_business_id: shop });
  check('clock in with an empty PIN is refused', r.data?.success === false && r.data?.error === 'invalid_pin', r);

  // A PIN cleared to '' (main's form allows it) drops the hash; deleting the staff row removes it too.
  const tempPin = ['7001', '7002', '7003'].find((p) => p !== coworker.pin && p !== workerPin);
  const { data: temp, error: tempErr } = await admin
    .from('staff')
    .insert({ business_id: shop, name: 'Temp', first_name: 'Temp', last_name: run, email: `temp-${run}@grumi.test`, phone: '7875550013', pin: tempPin, hourly_rate: 10, access_role: 'staff' })
    .select('id')
    .single();
  if (tempErr) throw new Error(`temp staff: ${tempErr.message}`);
  check('an inserted staff PIN is hashed (trigger on insert)', isBcrypt((await hashOf(temp.id))?.pin_hash, tempPin));
  await admin.from('staff').update({ pin: '' }).eq('id', temp.id);
  r = await lookup(worker.db, shop, tempPin);
  check('clearing a PIN removes its hash', !(await hashOf(temp.id)) && !r.error && found(r).length === 0, r);
  await admin.from('staff').update({ pin: tempPin }).eq('id', temp.id);
  await admin.from('staff').delete().eq('id', temp.id);
  check("deleting a staff member removes the PIN hash", !(await hashOf(temp.id)));

  // Backfill: existing PINs are migrated in place (the migration calls this; the owner can re-run it).
  await admin.from('staff_pin_hashes').delete().eq('staff_id', coworker.id);
  r = await admin.rpc('staff_pin_hashes_backfill');
  r = await lookup(worker.db, shop, coworker.pin);
  check('staff_pin_hashes_backfill restores missing hashes from the plain PINs', found(r)[0]?.id === coworker.id && isBcrypt((await hashOf(coworker.id))?.pin_hash, coworker.pin), r);

  // Uniqueness: still one PIN per staff member in a business.
  r = await boss.db
    .from('staff')
    .insert({ business_id: bossBiz, name: 'Dup', first_name: 'Dup', last_name: run, email: `dup-${run}@grumi.test`, phone: '7875550014', pin: hirePin2, access_role: 'staff' })
    .select();
  check('a duplicate PIN in the same business is still refused', !!r.error, r);
  r = await boss.db.rpc('staff_pin_available', { p_business_id: bossBiz, p_pin: hirePin2 });
  check('staff_pin_available: a PIN in use is not available', !r.error && r.data === false, r);
  r = await boss.db.rpc('staff_pin_available', { p_business_id: bossBiz, p_pin: hirePin2, p_exclude_staff_id: hire.id });
  check("staff_pin_available: a staff member's own PIN is available to them", !r.error && r.data === true, r);
  r = await boss.db.rpc('staff_pin_available', { p_business_id: bossBiz, p_pin: hirePin });
  check('staff_pin_available: an unused PIN is available', !r.error && r.data === true, r);
  r = await worker.db.rpc('staff_pin_available', { p_business_id: shop, p_pin: coworker.pin });
  check('an employee cannot probe which PINs are in use (staff_pin_available is manager-only)', !!r.error, r);
  r = await worker.db.rpc('generate_staff_pin', { p_business_id: shop, p_exclude_staff_id: meStaff.id, p_reserved: '0000' });
  const shopPins = ((await admin.from('staff').select('pin').eq('business_id', shop)).data ?? []).map((x) => x.pin);
  check(
    'generate_staff_pin returns a free 4-digit PIN',
    !r.error && /^\d{4}$/.test(r.data) && r.data !== '0000' && !shopPins.filter((p) => p !== workerPin).includes(r.data),
    r
  );
  r = await boss.db.rpc('generate_staff_pin', { p_business_id: shop });
  check("another business's manager cannot generate PINs for this business", !!r.error, r);

  // Nobody but the service role reads hashes or salts, or calls the internal helpers.
  for (const [who, db] of [
    ['an employee', worker.db],
    ['a manager', boss.db],
    ['an anonymous visitor', anon],
  ]) {
    r = await db.from('staff_pin_hashes').select('*');
    check(`${who} cannot read staff_pin_hashes`, !!r.error || (r.data ?? []).length === 0, r);
    r = await db.from('staff_pin_salts').select('*');
    check(`${who} cannot read staff_pin_salts`, !!r.error || (r.data ?? []).length === 0, r);
  }
  r = await worker.db.rpc('staff_pin_hash', { p_business_id: shop, p_pin: coworker.pin });
  check('an employee cannot call the internal staff_pin_hash', !!r.error, r);
  r = await worker.db.rpc('staff_pin_hashes_backfill');
  check('an employee cannot call staff_pin_hashes_backfill', !!r.error, r);
  r = await worker.db.from('staff_pin_hashes').insert({ staff_id: meStaff.id, business_id: shop, pin_hash: workerHash });
  check('an employee cannot write staff_pin_hashes', !!r.error, r);

  // kiosk_staff_by_pin shares clock_in_out's wrong-PIN limit (40 per business per 15 minutes from anywhere).
  const { data: tb, error: tbErr } = await admin
    .from('businesses')
    .insert({ name: `Throttle ${run}`, email: `throttle-${run}@grumi.test`, short_code: `T${run}`.toUpperCase().slice(0, 6), slug: `throttle-${run}`, subscription_tier: 'basic' })
    .select('id')
    .single();
  if (tbErr) throw new Error(`throttle business: ${tbErr.message}`);
  const { error: tsErr } = await admin
    .from('staff')
    .insert({ business_id: tb.id, name: 'Tess', first_name: 'Tess', last_name: run, email: `tess-${run}@grumi.test`, phone: '7875550015', pin: '2468', hourly_rate: 10, access_role: 'staff' });
  if (tsErr) throw new Error(`throttle staff: ${tsErr.message}`);
  const tm = await newUser('throttler', { role: 'manager', business_id: tb.id });
  for (let i = 0; i < 40; i++) await lookup(tm.db, tb.id, String(3000 + i));
  r = await lookup(tm.db, tb.id, '2468');
  check('kiosk_staff_by_pin stops answering after 40 wrong PINs (even a right one)', !!r.error || found(r).length === 0, r);
  r = await tm.db.rpc('clock_in_out', { p_employee_pin: '2468', p_business_id: tb.id });
  check('wrong PINs at kiosk_staff_by_pin count toward clock_in_out\'s limit', r.data?.error === 'too_many_attempts', r);
}

/**
 * P2-04: the kiosk manager PIN (businesses.kiosk_manager_pin) is also stored as a bcrypt hash (plus the hash of its
 * first 4 digits) in kiosk_manager_pin_hashes, kept in sync by a trigger on businesses, and the remediation frontend
 * checks and sets it through RPCs that compare hashes. Expand-only: the plain column stays (main reads and writes it),
 * so the known() manager-PIN reads below stay open until the contract step.
 */
async function managerPinHashing({ shop, bossBiz, worker, coworker, boss, hirePin2 }) {
  console.log('Kiosk manager PIN: hashed alongside the plain PIN, checked and set by hash (P2-04)');
  const anon = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const hashRow = async (businessId) =>
    (await admin.from('kiosk_manager_pin_hashes').select('pin_hash, prefix_hash, pin_length').eq('business_id', businessId).maybeSingle()).data;
  const plainPin = async (businessId) =>
    (await admin.from('businesses').select('kiosk_manager_pin').eq('id', businessId).single()).data?.kiosk_manager_pin;
  const isBcrypt = (h, pin) => typeof h === 'string' && /^\$2[abxy]\$\d\d\$/.test(h) && h.length === 60 && !h.includes(pin);
  const entry = async (who, businessId, pin) => who.rpc('kiosk_pin_entry', { p_business_id: businessId, p_pin: pin });
  const setPin = async (who, businessId, newPin, currentPin) =>
    who.rpc('set_kiosk_manager_pin', { p_business_id: businessId, p_new_pin: newPin, p_current_pin: currentPin ?? null });
  const status = async (who, businessId) =>
    who.from('businesses').select('kiosk_manager_pin_set').eq('id', businessId).maybeSingle();

  // Staff PINs are 1000-9999 or 4321-4323 here, so a 0-prefixed manager PIN never collides.
  const shopPin = '013579';
  let r = await admin.from('businesses').update({ kiosk_manager_pin: shopPin }).eq('id', shop);
  if (r.error) throw new Error(`shop manager PIN: ${r.error.message}`);
  let h = await hashRow(shop);
  check(
    'a manager PIN written by the service role gets a bcrypt hash (and a prefix hash)',
    isBcrypt(h?.pin_hash, shopPin) && isBcrypt(h?.prefix_hash, shopPin.slice(0, 4)) && h.pin_length === 6,
    h
  );

  // main: KioskManagerPinSettings / KioskManagerAccess / the reset dialog write the plain column directly.
  const bossPin1 = '024680';
  r = await boss.db.from('businesses').update({ kiosk_manager_pin: bossPin1 }).eq('id', bossBiz).select('id');
  check("main's direct manager-PIN write still works", !r.error && (await plainPin(bossBiz)) === bossPin1, r);
  check("main's direct write is hashed (trigger on businesses)", isBcrypt((await hashRow(bossBiz))?.pin_hash, bossPin1));
  // main: the kiosk lock gate and PIN entry read the plain column and compare in the browser.
  r = await boss.db.from('businesses').select('kiosk_manager_pin').eq('id', bossBiz).single();
  check("main's kiosk can still read the manager PIN it compares", !r.error && r.data?.kiosk_manager_pin === bossPin1, r);

  // remediation: kiosk_manager_pin_set (computed field) says whether a PIN is set, never the PIN.
  r = await status(worker.db, shop);
  check('kiosk_manager_pin_set tells a member a 6-digit manager PIN is set', !r.error && r.data?.kiosk_manager_pin_set === true, r);
  r = await status(worker.db, bossBiz);
  check("kiosk_manager_pin_set tells nothing about another business", !!r.error || r.data === null || r.data.kiosk_manager_pin_set === null, r);
  r = await anon.from('businesses').select('kiosk_manager_pin_set').eq('id', shop).maybeSingle();
  check('an anonymous visitor cannot read kiosk_manager_pin_set', !!r.error || r.data === null || r.data.kiosk_manager_pin_set == null, r);

  // remediation: kiosk_pin_entry decides at the keypad (hash compare).
  r = await entry(worker.db, shop, coworker.pin);
  check(
    'kiosk_pin_entry finds a staff member by PIN, without returning a PIN',
    !r.error && r.data?.result === 'staff' && r.data.staff?.id === coworker.id && !('pin' in r.data.staff) && !JSON.stringify(r.data).includes(shopPin),
    r
  );
  r = await entry(worker.db, shop, shopPin.slice(0, 4));
  check('kiosk_pin_entry: the first 4 digits of the manager PIN say "keep typing"', !r.error && r.data?.result === 'manager_prefix', r);
  r = await entry(worker.db, shop, shopPin.slice(0, 5));
  check('kiosk_pin_entry: 5 digits starting the manager PIN say "keep typing"', !r.error && r.data?.result === 'manager_prefix', r);
  r = await entry(worker.db, shop, shopPin);
  check('kiosk_pin_entry recognises the manager PIN by hash', !r.error && r.data?.result === 'manager' && !JSON.stringify(r.data).includes(shopPin), r);
  r = await entry(worker.db, shop, '013570');
  check('kiosk_pin_entry refuses a wrong manager PIN', !r.error && r.data?.result === 'invalid', r);
  r = await entry(boss.db, shop, shopPin);
  check("another business's manager cannot check this business's manager PIN", !!r.error || r.data?.result !== 'manager', r);
  r = await entry(anon, shop, shopPin);
  check('an anonymous visitor cannot call kiosk_pin_entry', !!r.error || r.data?.result !== 'manager', r);

  // remediation: set_kiosk_manager_pin (KioskManagerPinSettings with the current PIN, the reset dialog after the password).
  r = await setPin(worker.db, shop, '097531', shopPin);
  check('an employee cannot change the manager PIN through set_kiosk_manager_pin', !!r.error && (await plainPin(shop)) === shopPin, r);
  r = await setPin(boss.db, shop, '097531', shopPin);
  check("another business's manager cannot change this business's manager PIN", !!r.error && (await plainPin(shop)) === shopPin, r);
  r = await setPin(boss.db, bossBiz, '086420');
  check('changing the manager PIN needs the current PIN (or a fresh password sign-in)', !r.error && r.data?.error === 'current_pin_required' && (await plainPin(bossBiz)) === bossPin1, r);
  r = await setPin(boss.db, bossBiz, '086420', '111111');
  check('a wrong current manager PIN is refused', !r.error && r.data?.error === 'current_pin_incorrect' && (await plainPin(bossBiz)) === bossPin1, r);
  r = await setPin(boss.db, bossBiz, `${hirePin2}00`, bossPin1);
  check("a manager PIN starting with an employee's PIN is refused", !r.error && r.data?.error === 'pin_prefix_in_use' && (await plainPin(bossBiz)) === bossPin1, r);
  r = await setPin(boss.db, bossBiz, '08642', bossPin1);
  check('a manager PIN that is not 6 digits is refused', !r.error && r.data?.error === 'invalid_pin', r);
  r = await setPin(boss.db, bossBiz, '086420', bossPin1);
  check(
    'set_kiosk_manager_pin with the current PIN saves the plain column too (main sees it; a rollback loses nothing)',
    !r.error && r.data?.ok === true && (await plainPin(bossBiz)) === '086420',
    r
  );
  r = await entry(boss.db, bossBiz, '086420');
  const oldPin = await entry(boss.db, bossBiz, bossPin1);
  check('the new manager PIN works by hash and the old one no longer does', r.data?.result === 'manager' && oldPin.data?.result === 'invalid', { r, oldPin });

  // The reset dialog: the account password, then the new PIN without the current one (password sign-in < 10 min).
  const resetEmail = `pinreset-${run}@grumi.test`;
  const pass = `Pw-${run}-r7!`; // throwaway, per run, local stack only
  const { data: ru, error: ruErr } = await admin.auth.admin.createUser({ email: resetEmail, password: pass, email_confirm: true });
  if (ruErr) throw new Error(`reset manager: ${ruErr.message}`);
  const { error: rpErr } = await admin.from('profiles').upsert({ id: ru.user.id, email: resetEmail, role: 'manager', business_id: bossBiz }, { onConflict: 'id' });
  if (rpErr) throw new Error(`reset manager profile: ${rpErr.message}`);
  const resetter = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: siErr } = await resetter.auth.signInWithPassword({ email: resetEmail, password: pass });
  if (siErr) throw new Error(`reset manager sign-in: ${siErr.message}`);
  r = await setPin(resetter, bossBiz, '075319');
  check('a manager who just signed in with their password can reset the manager PIN', !r.error && r.data?.ok === true && (await plainPin(bossBiz)) === '075319', r);

  // Clearing the PIN (main's KioskManagerAccess allows it) removes the hash; the backfill restores drifted hashes.
  await admin.from('businesses').update({ kiosk_manager_pin: null }).eq('id', bossBiz);
  r = await status(boss.db, bossBiz);
  check('clearing the manager PIN removes its hash', !(await hashRow(bossBiz)) && r.data?.kiosk_manager_pin_set === false, r);
  r = await setPin(boss.db, bossBiz, '086421');
  check('with no manager PIN set, a manager sets the first one without a current PIN', !r.error && r.data?.ok === true, r);
  await admin.from('kiosk_manager_pin_hashes').delete().eq('business_id', bossBiz);
  await admin.rpc('kiosk_manager_pin_hashes_backfill');
  r = await entry(boss.db, bossBiz, '086421');
  check('kiosk_manager_pin_hashes_backfill restores a missing hash from the plain PIN', r.data?.result === 'manager', r);

  // Nobody but the service role reads the hashes or calls the internal helpers.
  for (const [who, db] of [
    ['an employee', worker.db],
    ['a manager', boss.db],
    ['an anonymous visitor', anon],
  ]) {
    r = await db.from('kiosk_manager_pin_hashes').select('*');
    check(`${who} cannot read kiosk_manager_pin_hashes`, !!r.error || (r.data ?? []).length === 0, r);
  }
  r = await boss.db.from('kiosk_manager_pin_hashes').update({ pin_hash: 'x' }).eq('business_id', bossBiz).select();
  check('a manager cannot write kiosk_manager_pin_hashes', !!r.error || (r.data ?? []).length === 0, r);
  for (const [fn, args] of [
    ['kiosk_manager_pin_hashes_backfill', {}],
    ['kiosk_pin_throttle', { p_business_id: shop }],
    ['caller_recent_password_sign_in', { p_max_age_seconds: 600 }],
  ]) {
    r = await worker.db.rpc(fn, args);
    check(`an employee cannot call the internal ${fn}`, !!r.error, r);
  }

  // Wrong PINs at kiosk_pin_entry and wrong current PINs share clock_in_out's limit (40 per business per 15 minutes).
  const { data: tb, error: tbErr } = await admin
    .from('businesses')
    .insert({ name: `MgrThrottle ${run}`, email: `mthrottle-${run}@grumi.test`, short_code: `M${run}`.toUpperCase().slice(0, 6), slug: `mthrottle-${run}`, subscription_tier: 'basic', kiosk_manager_pin: '013579' })
    .select('id')
    .single();
  if (tbErr) throw new Error(`manager throttle business: ${tbErr.message}`);
  const tm = await newUser('mthrottler', { role: 'manager', business_id: tb.id });
  r = await setPin(tm.db, tb.id, '097531', '000000');
  check('a wrong current manager PIN is refused and counted', !r.error && r.data?.error === 'current_pin_incorrect', r);
  r = await admin.from('clock_pin_attempts').select('business_id').eq('business_id', tb.id);
  check('the wrong current manager PIN was recorded in clock_pin_attempts', (r.data ?? []).length === 1, r);
  for (let i = 0; i < 39; i++) await entry(tm.db, tb.id, String(500000 + i));
  r = await entry(tm.db, tb.id, '013579');
  check('kiosk_pin_entry stops answering after 40 wrong PINs (even the right manager PIN)', !!r.error && r.data?.result !== 'manager', r);
  r = await setPin(tm.db, tb.id, '097531', '013579');
  check('set_kiosk_manager_pin stops checking current PINs after 40 wrong PINs', !!r.error && (await plainPin(tb.id)) === '013579', r);
  r = await tm.db.rpc('clock_in_out', { p_employee_pin: '1111', p_business_id: tb.id });
  check("wrong manager PINs count toward clock_in_out's limit", r.data?.error === 'too_many_attempts', r);

  // Expand step: the plain column stays readable while main compares it in the browser (contract step closes these).
  r = await worker.db.from('businesses').select('kiosk_manager_pin').eq('id', shop).maybeSingle();
  known('employee cannot read the kiosk manager PIN (P2-04, contract step)', r.data?.kiosk_manager_pin !== shopPin, r);
  r = await anon.from('businesses').select('kiosk_manager_pin').eq('id', shop).maybeSingle();
  known(
    "an anonymous visitor cannot read a business's kiosk manager PIN (directory policy; P2-04 contract step)",
    r.data?.kiosk_manager_pin !== shopPin,
    r
  );
}

main().catch((e) => {
  console.error('\n✗ Test run stopped:', e.message);
  process.exit(1);
});
