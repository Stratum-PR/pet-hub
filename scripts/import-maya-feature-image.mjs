/**
 * One-shot: extract embedded raster from Maya.svg → optimized WebP for marketing feature image.
 * Usage: node scripts/import-maya-feature-image.mjs [path-to-Maya.svg]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const defaultSvg = path.join(process.env.USERPROFILE || '', 'Downloads', 'Maya.svg');
const svgPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSvg;

const dataRe = /href="data:image\/(?:png|jpeg|jpg);base64,([^"]+)"/i;

const text = fs.readFileSync(svgPath, 'utf8');
const m = text.match(dataRe);
if (!m) {
  console.error('No embedded PNG/JPEG in SVG (expected data URL in href).');
  process.exit(1);
}

const buf = Buffer.from(m[1], 'base64');
const meta = await sharp(buf).metadata();
const outBuf = await sharp(buf)
  .resize(960, 960, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 76, effort: 4 })
  .toBuffer();

const outPath = path.join(root, 'public', 'marketing', 'features', 'custom', 'feature-spanish.webp');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, outBuf);
console.log(
  `Wrote ${path.relative(root, outPath)} (${(outBuf.length / 1e3).toFixed(1)} KB) from ${path.basename(svgPath)} (${meta.width}×${meta.height})`,
);
