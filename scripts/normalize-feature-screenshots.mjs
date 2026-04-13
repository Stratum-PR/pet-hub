/**
 * Normalize marketing feature PNGs to one 16:10 canvas (no letter/pillarboxing in the UI).
 * App screenshots: fit "cover", position north.
 * ATH Móvil: fit "contain", centre, withoutEnlargement, white pad (never upscale / zoom in).
 *
 * Run: npm run optimize:feature-screenshots
 *
 * Keep OUT_W / OUT_H in sync with FEATURE_SCREENSHOT_HINT_W / FEATURE_SCREENSHOT_HINT_H in
 * `src/components/marketing/FeaturesMarketingSection.tsx`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dir = path.join(root, 'public', 'marketing', 'features', 'custom');

/** 16:10 — matches `aspect-[16/10]` in FeaturesMarketingSection */
const OUT_W = 1600;
const OUT_H = 1000;

const files = [
  'feature-spanish.png',
  'feature-calendar.png',
  'feature-inventory.png',
  'feature-payroll.png',
  'feature-ath-movil.png',
];

/**
 * @param {string} name
 * @param {Buffer} buf
 * @returns {Promise<Buffer>}
 */
async function normalizeOne(name, buf) {
  const isAth = name.includes('ath-movil');

  if (isAth) {
    return sharp(buf)
      .resize(OUT_W, OUT_H, {
        fit: 'contain',
        position: 'centre',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        kernel: sharp.kernel.lanczos3,
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
      .toBuffer();
  }

  return sharp(buf)
    .resize(OUT_W, OUT_H, {
      fit: 'cover',
      position: 'north',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
    .toBuffer();
}

for (const name of files) {
  const inputPath = path.join(dir, name);
  if (!fs.existsSync(inputPath)) {
    console.error('Missing:', inputPath);
    process.exit(1);
  }
  const meta = await sharp(inputPath).metadata();
  const buf = fs.readFileSync(inputPath);
  const outBuf = await normalizeOne(name, buf);
  const tmp = `${inputPath}.tmp.png`;
  fs.writeFileSync(tmp, outBuf);
  fs.renameSync(tmp, inputPath);
  const after = await sharp(inputPath).metadata();
  console.log(
    `${name}: ${meta.width}×${meta.height} → ${after.width}×${after.height} (${(outBuf.length / 1024).toFixed(0)} KB)`,
  );
}
