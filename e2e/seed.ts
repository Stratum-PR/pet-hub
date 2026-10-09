// Seeds one fresh business on the LOCAL test stack for the smoke E2E run (P1-07).
// The manager signs up through the same RPC Register.tsx uses (complete_manager_signup), so the business,
// subscription, profile and owner staff row are built by production code, not hand-written rows.
// Everything else (service, client, pet, employee, client-portal user) is inserted with the service role.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Seed = {
  run: string;
  slug: string;
  businessId: string;
  businessName: string;
  manager: { email: string; pass: string; kioskPin: string };
  employee: { name: string; pin: string; staffId: string; email: string; pass: string };
  kioskEmployee: { name: string; pin: string; staffId: string };
  basicManager: { email: string; pass: string; slug: string };
  portalClient: { email: string; pass: string; firstName: string; petName: string };
  client: { id: string; firstName: string; lastName: string };
  pet: { id: string; name: string };
  service: { id: string; name: string; price: number };
  appointments: Record<'edit' | 'inspect' | 'checkout' | 'portal', SeededAppointment>;
  payroll: { hours: number; gross: number };
};

type SeededAppointment = { id: string; date: string; start: string };

/** Puerto Rico has no daylight saving time. */
const PR_OFFSET = '-04:00';

/** YYYY-MM-DD in the business's time zone, `daysAhead` from today. */
export function localDateKey(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico' }).format(d);
}

/**
 * Features the smoke flows walk through. Visibility comes from feature_rollout + feature_visibility_rules, whose rows
 * live in production only (the schema snapshot has no data), so the seed turns them on for managers on 'pro'.
 */
const SMOKE_FEATURES = [
  'appointments',
  'appointment_book',
  'booking_settings',
  'inventory',
  'payments',
  'transactions_list',
  'transaction_create',
  'transaction_detail',
];

const SMOKE_BREEDS = [
  { name: 'Poodle', species: 'dog' },
  { name: 'Mestizo', species: 'dog' },
  { name: 'Siamés', species: 'cat' },
];

export function assertLocalStack(apiUrl: string) {
  const host = new URL(apiUrl).hostname;
  if (!['127.0.0.1', 'localhost'].includes(host) || !apiUrl.includes(':5542')) {
    throw new Error(`Refusing to seed: ${apiUrl} is not the local test stack (ports 55420-55429).`);
  }
}

function must<T>(label: string, r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error || r.data === null || r.data === undefined) throw new Error(`${label}: ${r.error?.message ?? 'no data'}`);
  return r.data;
}

/** A confirmed auth user with a password (the local stack doesn't send email). */
async function createUser(admin: SupabaseClient, email: string, pass: string, fullName: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) throw new Error(`create user ${email}: ${error?.message ?? 'no user'}`);
  return data.user;
}

async function signedIn(apiUrl: string, anonKey: string, email: string, pass: string): Promise<SupabaseClient> {
  const db = createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return db;
}

export async function seed(apiUrl: string, anonKey: string, serviceKey: string): Promise<Seed> {
  assertLocalStack(apiUrl);
  const admin = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = Math.random().toString(36).slice(2, 8);
  const pass = `E2e-${run}-pw9!`;
  const businessName = `Smoke ${run}`;

  // ---------- feature visibility (global, local stack only) ----------
  must('feature_catalog', await admin.from('feature_catalog').upsert(SMOKE_FEATURES.map((k) => ({ feature_key: k, display_name: k }))).select('feature_key'));
  must('feature_rollout', await admin.from('feature_rollout').upsert(SMOKE_FEATURES.map((k) => ({ feature_key: k, min_tier: 'production' }))).select('feature_key'));
  must(
    'feature_visibility_rules',
    await admin
      .from('feature_visibility_rules')
      .upsert(SMOKE_FEATURES.map((k) => ({ feature_key: k, roles: ['manager', 'super_admin'], subscription_tiers: ['pro'] })))
      .select('feature_key'),
  );

  // ---------- breed catalog (reference data production has; the pet form requires a breed) ----------
  const breeds = must('breeds', await admin.from('breeds').select('name, species'));
  const missing = SMOKE_BREEDS.filter((b) => !breeds.some((x) => x.name === b.name && x.species === b.species));
  if (missing.length) must('insert breeds', await admin.from('breeds').insert(missing).select('id'));

  // ---------- manager + business, through the real signup RPC ----------
  const managerEmail = `manager-${run}@grumi.test`;
  await createUser(admin, managerEmail, pass, 'Maria Manager');
  const managerDb = await signedIn(apiUrl, anonKey, managerEmail, pass);
  const signup = await managerDb.rpc('complete_manager_signup', { p_business_name: businessName, p_subscription_tier: 'pro' });
  if (signup.error) throw new Error(`complete_manager_signup: ${signup.error.message}`);

  // A second business on 'basic': the pro-only features above are hidden for its manager (redirect checks).
  const basicEmail = `basic-${run}@grumi.test`;
  await createUser(admin, basicEmail, pass, 'Beto Basico');
  const basicDb = await signedIn(apiUrl, anonKey, basicEmail, pass);
  const basicSignup = await basicDb.rpc('complete_manager_signup', { p_business_name: `Basic ${run}`, p_subscription_tier: 'basic' });
  if (basicSignup.error) throw new Error(`complete_manager_signup (basic): ${basicSignup.error.message}`);
  const basicBiz = must('basic business', await admin.from('businesses').select('slug').eq('email', basicEmail).single());
  const profile = must(
    'manager profile',
    await admin.from('profiles').select('business_id, role').eq('email', managerEmail).single(),
  );
  if (profile.role !== 'manager' || !profile.business_id) throw new Error(`manager profile not linked: ${JSON.stringify(profile)}`);
  const businessId = profile.business_id as string;
  // The time kiosk refuses to open until the business has a 6-digit manager PIN (set in business settings).
  const kioskManagerPin = String(100000 + Math.floor(Math.random() * 899999));
  const biz = must(
    'business',
    await admin.from('businesses').update({ kiosk_manager_pin: kioskManagerPin }).eq('id', businessId).select('slug').single(),
  );
  must(
    'settings',
    await admin
      .from('settings')
      .upsert({ business_id: businessId, timezone: 'America/Puerto_Rico' }, { onConflict: 'business_id' })
      .select('business_id'),
  );

  // ---------- catalog and customers ----------
  const service = must(
    'service',
    await admin
      .from('services')
      .insert({ business_id: businessId, name: 'Baño completo', price: 45, duration_minutes: 60, is_active: true })
      .select('id, name, price')
      .single(),
  );
  const client = must(
    'client',
    await admin
      .from('clients')
      .insert({ business_id: businessId, first_name: 'Carla', last_name: `Cliente${run}`, email: `carla-${run}@grumi.test`, phone: '7875550101' })
      .select('id, first_name, last_name')
      .single(),
  );
  const pet = must(
    'pet',
    await admin
      .from('pets')
      .insert({ business_id: businessId, client_id: client.id, name: `Toby${run}`, species: 'dog', breed: 'Poodle' })
      .select('id, name')
      .single(),
  );

  // ---------- an hourly employee with a known kiosk PIN ----------
  const employeePin = String(1000 + Math.floor(Math.random() * 8999));
  const employee = must(
    'employee',
    await admin
      .from('staff')
      .insert({
        business_id: businessId,
        name: 'Eli Empleado',
        first_name: 'Eli',
        last_name: 'Empleado',
        email: `eli-${run}@grumi.test`,
        phone: '7875550102',
        pin: employeePin,
        hourly_rate: 12,
        role: 'groomer',
        access_role: 'staff',
        status: 'active',
      })
      .select('id')
      .single(),
  );

  // A second employee only the kiosk flow punches, so its shifts never touch the payroll flow's totals.
  const kioskPin = String((Number(employeePin) + 1111) % 9000 + 1000);
  const kioskEmployee = must(
    'kiosk employee',
    await admin
      .from('staff')
      .insert({
        business_id: businessId,
        name: 'Kim Kiosko',
        first_name: 'Kim',
        last_name: 'Kiosko',
        email: `kim-${run}@grumi.test`,
        phone: '7875550104',
        pin: kioskPin,
        hourly_rate: 11,
        role: 'groomer',
        access_role: 'staff',
        status: 'active',
      })
      .select('id')
      .single(),
  );

  // ---------- an employee login for Eli, linked the way an accepted staff invite links it ----------
  const employeeEmail = `eli-${run}@grumi.test`;
  const employeeUser = await createUser(admin, employeeEmail, pass, 'Eli Empleado');
  must(
    'employee profile',
    await admin
      .from('profiles')
      .upsert(
        { id: employeeUser.id, email: employeeEmail, full_name: 'Eli Empleado', role: 'employee', business_id: businessId, staff_id: employee.id },
        { onConflict: 'id' },
      )
      .select('id'),
  );
  must('employee staff link', await admin.from('staff').update({ user_id: employeeUser.id }).eq('id', employee.id).select('id'));

  // ---------- a client-portal user linked to their own client + pet ----------
  const portalEmail = `portal-${run}@grumi.test`;
  const portalUser = await createUser(admin, portalEmail, pass, 'Pablo Portal');
  must(
    'portal profile',
    await admin
      .from('profiles')
      .upsert({ id: portalUser.id, email: portalEmail, full_name: 'Pablo Portal', role: 'client' }, { onConflict: 'id' })
      .select('id'),
  );
  const portalClient = must(
    'portal client',
    await admin
      .from('clients')
      .insert({ business_id: businessId, first_name: 'Pablo', last_name: 'Portal', email: portalEmail, phone: '7875550103', profile_id: portalUser.id })
      .select('id')
      .single(),
  );
  const portalPet = `Luna${run}`;
  const portalPetRow = must(
    'portal pet',
    await admin.from('pets').insert({ business_id: businessId, client_id: portalClient.id, name: portalPet, species: 'dog' }).select('id').single(),
  );

  // ---------- appointments, shaped like the rows BookingFormDialog writes ----------
  const appt = async (label: string, daysAhead: number, start: string, clientId: string, petId: string) => {
    const date = localDateKey(daysAhead);
    const [h, m] = start.split(':').map(Number);
    const end = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const row = must(
      label,
      await admin
        .from('appointments')
        .insert({
          business_id: businessId,
          client_id: clientId,
          pet_id: petId,
          staff_id: employee.id,
          service_id: service.id,
          service_ids: [service.id],
          service_type: service.name,
          scheduled_date: `${date}T${start}:00${PR_OFFSET}`,
          appointment_date: date,
          start_time: `${start}:00`,
          end_time: `${end}:00`,
          price: service.price,
          total_price: service.price,
          status: 'scheduled',
          booking_source: 'staff',
        })
        .select('id')
        .single(),
    );
    return { id: row.id as string, date, start };
  };
  const editAppt = await appt('appointment to edit', 3, '14:00', client.id, pet.id);
  const inspectAppt = await appt('appointment to inspect', 4, '14:00', client.id, pet.id);
  const checkoutAppt = await appt('appointment to check out', 0, '09:00', client.id, pet.id);
  const portalAppt = await appt('portal client appointment', 5, '10:00', portalClient.id, portalPetRow.id);

  // ---------- two closed shifts for the employee today: 4h + 4h at $12/h = 8h, $96.00 ----------
  // The pay period starts on the business's creation day (today), so the shifts are on that day too.
  const today = localDateKey(0);
  must(
    'time entries',
    await admin
      .from('time_entries')
      .insert([
        { business_id: businessId, staff_id: employee.id, clock_in: `${today}T08:00:00${PR_OFFSET}`, clock_out: `${today}T12:00:00${PR_OFFSET}` },
        { business_id: businessId, staff_id: employee.id, clock_in: `${today}T13:00:00${PR_OFFSET}`, clock_out: `${today}T17:00:00${PR_OFFSET}` },
      ])
      .select('id'),
  );

  return {
    run,
    slug: biz.slug as string,
    businessId,
    businessName,
    manager: { email: managerEmail, pass, kioskPin: kioskManagerPin },
    employee: { name: 'Eli Empleado', pin: employeePin, staffId: employee.id, email: employeeEmail, pass },
    kioskEmployee: { name: 'Kim Kiosko', pin: kioskPin, staffId: kioskEmployee.id },
    basicManager: { email: basicEmail, pass, slug: basicBiz.slug as string },
    portalClient: { email: portalEmail, pass, firstName: 'Pablo', petName: portalPet },
    client: { id: client.id, firstName: client.first_name as string, lastName: client.last_name as string },
    pet: { id: pet.id, name: pet.name as string },
    service: { id: service.id, name: service.name as string, price: Number(service.price) },
    appointments: { edit: editAppt, inspect: inspectAppt, checkout: checkoutAppt, portal: portalAppt },
    payroll: { hours: 8, gross: 96 },
  };
}
