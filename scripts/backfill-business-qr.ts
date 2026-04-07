import { createClient } from '@supabase/supabase-js';
import { generateBusinessPortalQrSvg, resolvePortalBaseUrl } from '../src/lib/qrCode';

type BusinessRow = {
  id: string;
  slug: string | null;
  name: string | null;
};

type SettingsRow = {
  business_id: string;
  primary_color: string | null;
  business_logo_url: string | null;
};

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicBaseUrl = resolvePortalBaseUrl(process.env.PUBLIC_BASE_URL);

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, slug, name')
    .is('qr_code', null);

  if (error) throw error;

  const candidates = (businesses ?? []) as BusinessRow[];
  if (candidates.length === 0) {
    console.log('No businesses pending QR generation.');
    return;
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from('settings')
    .select('business_id, primary_color, business_logo_url')
    .in(
      'business_id',
      candidates.map((b) => b.id)
    );

  if (settingsError) throw settingsError;
  const settingsByBusiness = new Map<string, SettingsRow>(
    ((settingsRows ?? []) as SettingsRow[]).map((row) => [row.business_id, row])
  );

  let updated = 0;
  for (const business of candidates) {
    const slug = business.slug?.trim();
    if (!slug) {
      console.warn(`Skipping business ${business.id} because slug is empty.`);
      continue;
    }

    const primaryColor = settingsByBusiness.get(business.id)?.primary_color ?? null;
    const qrSvg = await generateBusinessPortalQrSvg(slug, primaryColor, publicBaseUrl, {
      businessName: business.name,
      logoUrl: settingsByBusiness.get(business.id)?.business_logo_url ?? null,
    });

    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        qr_code: qrSvg,
        qr_generated_at: new Date().toISOString(),
      })
      .eq('id', business.id)
      .is('qr_code', null);

    if (updateError) {
      console.warn(`Failed QR update for business ${business.id}: ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(`QR backfill completed. Updated ${updated} business rows.`);
}

main().catch((err) => {
  console.error('QR backfill failed:', err);
  process.exit(1);
});
