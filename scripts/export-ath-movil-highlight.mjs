/**
 * One-off / manual: build `public/marketing/features/custom/feature-ath-movil.png`
 * at 16:10 (1600×1000) without upscaling: scale down if larger than the box; otherwise pad with white (contain).
 *
 * Source: Cursor workspace asset (same basename pattern as other marketing drops).
 * Run from repo root: node scripts/export-ath-movil-highlight.mjs [optional-path-to-png]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const OUT_W = 1600;
const OUT_H = 1000;
const outPath = path.join(root, 'public', 'marketing', 'features', 'custom', 'feature-ath-movil.png');

const defaultCursorSrc = path.join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'c-Users-Jovaniel-OneDrive-University-of-Puerto-Rico-Documents-Stratum-PR-Stratum-Hub',
  'assets',
  'c__Users_Jovaniel_AppData_Roaming_Cursor_User_workspaceStorage_14783467c0c8e586076345f06e1c050b_images_image-0ea37449-e550-44a7-a5f9-260bee94ed3a.png',
);

const inputPath = process.argv[2] || defaultCursorSrc;

if (!fs.existsSync(inputPath)) {
  console.error('Source not found:', inputPath);
  console.error('Pass path: node scripts/export-ath-movil-highlight.mjs <path-to.png>');
  process.exit(1);
}

const buf = fs.readFileSync(inputPath);
const meta = await sharp(buf).metadata();

/** Never upscale the logo; pad to 16:10 with white. If source is larger than 1600×1000, scale down then pad. */
const outBuf = await sharp(buf)
  .resize(OUT_W, OUT_H, {
    fit: 'contain',
    position: 'centre',
    withoutEnlargement: true,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
    kernel: sharp.kernel.lanczos3,
  })
  .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
  .toBuffer();

const after = await sharp(outBuf).metadata();
const tmp = `${outPath}.tmp.png`;
fs.writeFileSync(tmp, outBuf);
fs.renameSync(tmp, outPath);

console.log(
  `ATH: ${path.basename(inputPath)} ${meta.width}×${meta.height} → ${after.width}×${after.height} (${(outBuf.length / 1024).toFixed(0)} KB)`,
);
