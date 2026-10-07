#!/usr/bin/env node
// Payments end-to-end tests against Grumi's LOCAL test stack (security review G-12).
// Real Postgres (RLS, triggers), real Edge Functions (payments, athm-simulator) and the package's ATH Móvil
// simulator in Docker. Run it with `npm run test:payments` after `npm run test:env:up`; it refuses to run
// against anything that isn't localhost.
import { createClient } from '@supabase/supabase-js';

const API = process.env.TEST_API_URL;
const ANON = process.env.TEST_ANON_KEY;
const SERVICE = process.env.TEST_SERVICE_KEY;
const SIM = process.env.TEST_ATH_SIM_URL ?? 'http://localhost:55430';

if (!API || !ANON || !SERVICE) {
  console.error('Missing TEST_API_URL / TEST_ANON_KEY / TEST_SERVICE_KEY. Use: npm run test:payments');
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fn(path, token, body, method = 'POST') {
  const headers = { apikey: ANON, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}/functions/v1/${path}`, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* empty */
  }
  return { status: r.status, json: json ?? {} };
}
const pay = (token, body) => fn('payments', token, body);

async function newUser(label, businessId, role) {
  const email = `${label}-${run}@grumi.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const id = data.user.id;
  // handle_new_user creates the profile; set the business and role like the app does.
  const { error: upErr } = await admin.from('profiles').upsert({ id, email, business_id: businessId, role }, { onConflict: 'id' });
  if (upErr) throw new Error(`profile ${label}: ${upErr.message}`);
  // No passwords: a one-time sign-in token from the admin API, exchanged for a session.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr) throw new Error(`sign-in link ${label}: ${linkErr.message}`);
  const client = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: sErr } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' });
  if (sErr || !s.session) throw new Error(`sign in ${label}: ${sErr?.message ?? 'no session'}`);
  const token = s.session.access_token;
  const db = createClient(API, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  return { id, token, db };
}

async function ecommerceIdOf(paymentId) {
  const { data } = await admin.from('payments').select('provider_payment_id').eq('id', paymentId).single();
  return data?.provider_payment_id;
}

async function waitFor(token, paymentId, wanted, ms = 15000) {
  const until = Date.now() + ms;
  let last;
  while (Date.now() < until) {
    last = await pay(token, { action: 'ath_status', paymentId });
    if (last.json.payment?.status === wanted) return last;
    await sleep(1000);
  }
  return last;
}

async function newSale(user, businessId, totalCents, isTest) {
  return user.db
    .from('transactions')
    .insert({ business_id: businessId, payment_method: 'ath_movil', status: 'paid', subtotal: totalCents, total: totalCents, is_test: isTest })
    .select('id, is_test')
    .single();
}

async function main() {
  console.log(`\nGrumi payments E2E on ${API} (run ${run})\n`);

  // ---------- seed ----------
  const { data: biz, error: bizErr } = await admin
    .from('businesses')
    .insert({ name: `Grumi Test ${run}`, email: `biz-${run}@grumi.test`, short_code: run.toUpperCase().padEnd(6, 'X').slice(0, 6), subscription_tier: 'basic' })
    .select('id')
    .single();
  if (bizErr) throw new Error(`business: ${bizErr.message}`);
  const B = biz.id;
  const mgr = await newUser('manager', B, 'manager');
  const emp = await newUser('employee', B, 'employee');

  console.log('Access');
  const noAuth = await pay(null, { action: 'settings_get' });
  check('no sign-in → 401', noAuth.status === 401, noAuth);
  const empSave = await pay(emp.token, { action: 'settings_save_ath', mode: 'simulator' });
  check('employees cannot change payment settings', empSave.status === 403, empSave);

  console.log('Test mode (simulator Edge Function, G-1)');
  let r = await pay(mgr.token, { action: 'settings_save_ath', mode: 'simulator' });
  check('manager turns on test mode', r.json.ok === true, r);
  r = await pay(emp.token, { action: 'settings_get' });
  check('settings show test mode', r.json.athmovil?.mode === 'simulator' && r.json.simulatorAllowed === true, r);

  r = await pay(emp.token, { action: 'ath_create', amountCents: 4500, phone: '(787) 555-1234', description: 'Baño' });
  const p1 = r.json.payment;
  check('employee sends a test ATH Móvil charge', p1?.status === 'pending' && p1?.mode === 'simulator', r);
  const e1 = await ecommerceIdOf(p1.id);
  r = await fn('athm-simulator/simulator/state', emp.token, null, 'GET');
  check('employees cannot open the simulated phone', r.status === 403, r);
  r = await fn(`athm-simulator/simulator/payments/${e1}/approve`, emp.token, {});
  check('employees cannot approve their own test charge', r.status === 403, r);
  r = await fn(`athm-simulator/simulator/payments/${e1}/approve`, mgr.token, {});
  check('manager approves on the simulated phone', r.status === 200 && r.json.status === 'CONFIRM', r);
  r = await waitFor(emp.token, p1.id, 'succeeded');
  check('charge finalizes → succeeded', r?.json.payment?.status === 'succeeded' && r.json.payment.amountPaidCents === 4500, r);

  console.log('Test sales are flagged and protected (real database trigger)');
  const { data: t1, error: t1Err } = await newSale(emp, B, 4500, true);
  check('browser can save the sale', !t1Err && !!t1?.id, t1Err);
  check('browser cannot mark a sale as test (stays false)', t1?.is_test === false, t1);
  r = await pay(emp.token, { action: 'link_transaction', paymentId: p1.id, transactionId: t1.id });
  check('linking a test payment flags the sale as test', r.json.ok === true && r.json.isTest === true, r);
  const { data: t1b } = await admin.from('transactions').select('is_test').eq('id', t1.id).single();
  check('database shows is_test = true', t1b?.is_test === true, t1b);
  await emp.db.from('transactions').update({ is_test: false }).eq('id', t1.id);
  const { data: t1c } = await admin.from('transactions').select('is_test').eq('id', t1.id).single();
  check('browser cannot turn a test sale into revenue', t1c?.is_test === true, t1c);

  console.log('Audit log');
  const { data: mgrAudit } = await mgr.db.from('payment_audit_log').select('action, actor_user_id, details').eq('business_id', B);
  check('mode change logged with the real user', (mgrAudit ?? []).some((a) => a.action === 'athmovil_mode_changed' && a.actor_user_id === mgr.id && a.details?.to === 'simulator'), mgrAudit);
  const { data: empAudit } = await emp.db.from('payment_audit_log').select('id').eq('business_id', B);
  check('employees cannot read the audit log', (empAudit ?? []).length === 0, empAudit);

  console.log('Real mode against the package simulator container (port 55430)');
  const health = await fetch(`${SIM}/health`).then((x) => x.ok).catch(() => false);
  check('ATH Móvil simulator container is up', health);
  r = await pay(mgr.token, { action: 'settings_save_ath', mode: 'live', publicToken: 'grumi_test_public_token', privateToken: 'wrong_private_token' });
  check('keys ATH rejects are refused', r.json.ok === false && r.json.error === 'invalid_credentials', r);
  r = await pay(mgr.token, { action: 'settings_save_ath', mode: 'live', publicToken: 'grumi_test_public_token', privateToken: 'grumi_test_private_token' });
  check('manager connects "real" ATH Móvil (simulated keys)', r.json.ok === true, r);
  r = await pay(emp.token, { action: 'ath_create', amountCents: 2000, phone: '7875551234', description: 'Corte' });
  const p2 = r.json.payment;
  check('real-mode charge is created', p2?.status === 'pending' && p2?.mode === 'live', r);
  const e2 = await ecommerceIdOf(p2?.id);
  const approve = await fetch(`${SIM}/simulator/payments/${e2}/approve`, { method: 'POST' }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
  check('customer approves in the simulator', approve.status === 'CONFIRM', approve);
  r = await waitFor(emp.token, p2.id, 'succeeded');
  check('real-mode charge finalizes → succeeded', r?.json.payment?.status === 'succeeded', r);
  const simState = await fetch(`${SIM}/simulator/state`).then((x) => x.json()).catch(() => ({}));
  const hook = (simState.webhooks ?? []).find((w) => w.event === 'ecommercePaymentReceivedEvent' && w.body?.ecommerceId === e2);
  check('simulator webhook reached the payments function', hook?.delivered === true, hook);
  const { data: t2 } = await newSale(emp, B, 2000, false);
  r = await pay(emp.token, { action: 'link_transaction', paymentId: p2.id, transactionId: t2.id });
  check('a real-mode sale is not flagged as test', r.json.ok === true && r.json.isTest === false, r);

  await pay(mgr.token, { action: 'settings_save_ath', mode: 'off' });
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll payments checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('\n✗ Test run stopped:', e.message);
  process.exit(1);
});
