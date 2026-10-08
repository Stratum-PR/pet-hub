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

/** A signed-in user. `profile` is applied with the service role, the way the server-side signup paths do it. */
async function newUser(label, profile, metadata = {}) {
  const email = `${label}-${run}@grumi.test`;
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
  const { data } = await admin.from('profiles').select('role, business_id, staff_id, full_name').eq('id', id).single();
  return data;
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

  console.log('Profiles: users cannot rewrite their own role, business or staff link');
  const stranger = await newUser('stranger', { role: 'client' });

  let r = await stranger.db.from('profiles').update({ role: 'manager', business_id: victim }).eq('id', stranger.id).select();
  let p = await profileOf(stranger.id);
  check('client cannot make themselves manager of another business', !!r.error && p.role === 'client' && p.business_id === null, { r, p });

  r = await stranger.db.from('profiles').update({ business_id: victim }).eq('id', stranger.id).select();
  p = await profileOf(stranger.id);
  check('client cannot move themselves into another business', !!r.error && p.business_id === null, { r, p });

  r = await stranger.db.from('profiles').update({ role: 'manager' }).eq('id', stranger.id).select();
  p = await profileOf(stranger.id);
  check('client cannot promote themselves to manager', !!r.error && p.role === 'client', { r, p });

  const { data: seen } = await stranger.db.from('clients').select('id').eq('business_id', victim);
  check("stranger still cannot read the business's customers", (seen ?? []).length === 0, seen);

  console.log('Profiles: normal self-service still works');
  r = await stranger.db.from('profiles').update({ full_name: 'Renamed Person' }).eq('id', stranger.id).select();
  check('user can edit their own name', !r.error && (await profileOf(stranger.id)).full_name === 'Renamed Person', r);

  // Register.tsx writes role: 'client' right after client signup; unchanged values must keep working.
  r = await stranger.db.from('profiles').update({ role: 'client', full_name: 'Client Signup' }).eq('id', stranger.id).select();
  check("client signup's role write (unchanged value) still works", !r.error, r);

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
