/**
 * Waitlist mascot images:
 * 0) If public/waitlist-mascots/*.png exist: decode → normalize → WebP, delete PNG.
 * 1) If public/waitlist-mascots/*.svg exist (embedded 2048× PNG): decode → normalize → WebP, delete SVG.
 * 2) Always re-normalize *.webp: trim transparent edges, scale subject uniformly, center on a square canvas
 *    so each asset reads at a similar size and alignment in the UI.
 *
 * Run: npm run optimize:waitlist-mascots
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dir = path.join(root, 'public', 'waitlist-mascots');
/** Square output; modal displays ~80–120px tall — keep payloads small for fast preload. */
const CANVAS = 640;
/** Max width or height of the (trimmed) subject inside the square canvas */
const SUBJECT_MAX = 560;
const WEBP_QUALITY = 78;

const dataRe = /href="data:image\/(?:png|jpeg|jpg);base64,([^"]+)"/i;

/**
 * @param {Buffer} rasterBuf  PNG/JPEG/WebP buffer
 * @returns {Promise<Buffer>}
 */
async function rasterToNormalizedWebp(rasterBuf) {
  // Default trim only removes fully transparent edges. Many pet exports use a flat light gray
  // matte around the subject — `threshold` trims those border regions too (0–100 similarity).
  const trimmed = await sharp(rasterBuf).ensureAlpha().trim({ threshold: 42 }).toBuffer();
  const scaled = await sharp(trimmed)
    .resize(SUBJECT_MAX, SUBJECT_MAX, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();

  return sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, gravity: 'center' }])
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();
}

async function writeWebpAtomically(outPath, webpBuf) {
  const tmp = `${outPath}.tmp`;
  fs.writeFileSync(tmp, webpBuf);
  fs.renameSync(tmp, outPath);
}

const pngFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));

for (const name of pngFiles) {
  const pngPath = path.join(dir, name);
  const base = name.replace(/\.png$/i, '');
  const outPath = path.join(dir, `${base}.webp`);
  const webpBuf = await rasterToNormalizedWebp(fs.readFileSync(pngPath));
  await writeWebpAtomically(outPath, webpBuf);
  const inSize = fs.statSync(pngPath).size;
  fs.unlinkSync(pngPath);
  console.log(`${base}.png: ${(inSize / 1e6).toFixed(2)} MB → ${(webpBuf.length / 1e3).toFixed(1)} KB WebP (normalized)`);
}

const svgFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'));

for (const name of svgFiles) {
  const svgPath = path.join(dir, name);
  const text = fs.readFileSync(svgPath, 'utf8');
  const m = text.match(dataRe);
  if (!m) {
    console.error('Could not find embedded image in', name);
    process.exit(1);
  }
  const buf = Buffer.from(m[1], 'base64');
  const base = name.replace(/\.svg$/i, '');
  const outPath = path.join(dir, `${base}.webp`);
  const webpBuf = await rasterToNormalizedWebp(buf);
  await writeWebpAtomically(outPath, webpBuf);

  const inSize = fs.statSync(svgPath).size;
  const outSize = webpBuf.length;
  console.log(`${base}: ${(inSize / 1e6).toFixed(2)} MB SVG → ${(outSize / 1e3).toFixed(1)} KB WebP (normalized)`);

  fs.unlinkSync(svgPath);
}

const webpFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.webp'));

if (!webpFiles.length && !svgFiles.length && !pngFiles.length) {
  console.log('No .png, .svg or .webp files in', dir);
  process.exit(1);
}

if (svgFiles.length === 0) {
  for (const name of webpFiles) {
    const webpPath = path.join(dir, name);
    const before = fs.statSync(webpPath).size;
    const webpBuf = await rasterToNormalizedWebp(fs.readFileSync(webpPath));
    await writeWebpAtomically(webpPath, webpBuf);
    const after = webpBuf.length;
    console.log(`${name}: ${(before / 1e3).toFixed(1)} KB → ${(after / 1e3).toFixed(1)} KB (trim + center)`);
  }
  console.log('Done (normalized existing WebP).');
} else {
  console.log('Done (from SVG + normalize).');
}
