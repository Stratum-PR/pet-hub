import QRCode from 'qrcode';
import { hslToHex, rgbStringToHsl } from '@/lib/colorFormat';
import { escapeHtml } from '@/lib/escapeHtml';

const FALLBACK_QR_COLOR = '#6B8B70';
const LIVE_PORTAL_BASE = 'https://grumi.pet';

function isHexColor(value: string): boolean {
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(value.trim());
}

/** HSL triplet as stored in `settings.primary_color` (e.g. `127 18% 47%`). */
function looksLikeHslTriplet(s: string): boolean {
  return /^\d+(\.\d+)?\s+\d+%\s+\d+%$/.test(s.trim());
}

/**
 * Resolves brand color from DB to a hex QR dark color.
 * Supports `#hex`, HSL triplets (`127 18% 47%`), `hsl(...)`, and `rgb(...)` / comma-separated RGB.
 */
export function normalizeQrColor(color: string | null | undefined): string {
  if (!color) return FALLBACK_QR_COLOR;
  const candidate = color.trim();
  if (isHexColor(candidate)) return candidate;
  if (looksLikeHslTriplet(candidate) || /^hsl\s*\(/i.test(candidate)) {
    const hex = hslToHex(candidate);
    return isHexColor(hex) ? hex : FALLBACK_QR_COLOR;
  }
  const fromRgb = rgbStringToHsl(candidate);
  if (fromRgb) {
    const hex = hslToHex(fromRgb);
    return isHexColor(hex) ? hex : FALLBACK_QR_COLOR;
  }
  return FALLBACK_QR_COLOR;
}

export function buildBusinessPortalUrl(businessSlug: string, origin = LIVE_PORTAL_BASE): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/${businessSlug}/portal`;
}

export function resolvePortalBaseUrl(runtimeOrigin?: string): string {
  const fromArg = (runtimeOrigin || '').trim();
  const fromWindow =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const candidate = fromArg || fromWindow;
  if (!candidate) return LIVE_PORTAL_BASE;
  try {
    const url = new URL(candidate);
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '0.0.0.0';
    return isLocal ? url.origin : LIVE_PORTAL_BASE;
  } catch {
    return LIVE_PORTAL_BASE;
  }
}

type QrBranding = {
  businessName?: string | null;
  logoUrl?: string | null;
};

// No String.prototype.replaceAll: the build targets Safari 12 / iOS 12, which lack it.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function initialsFromName(name: string | null | undefined): string {
  const parts = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return 'G';
  return parts.map((p) => p[0]?.toUpperCase() || '').join('');
}

function parseSvgViewBox(svg: string): { cx: number; cy: number; size: number } | null {
  const m = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (!m) return null;
  const parts = m[1]
    .trim()
    .split(/[\s,]+/)
    .map((v) => Number(v));
  if (parts.length < 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [, , w, h] = parts;
  const cx = parts[0]! + w / 2;
  const cy = parts[1]! + h / 2;
  const size = Math.min(w, h);
  return { cx, cy, size };
}

function injectCenterBranding(svg: string, color: string, branding?: QrBranding): string {
  const vb = parseSvgViewBox(svg) ?? { cx: 16, cy: 16, size: 31 };
  const { cx, cy, size } = vb;
  const clipId = `qrLogoClip-${Math.random().toString(36).slice(2, 11)}`;

  const rOuter = size * 0.16;
  const rRing = size * 0.135;
  const logoSide = size * 0.22;
  const strokeW = Math.max(0.35, size * 0.012);
  const fontSize = Math.max(2, size * 0.12);

  const hasLogo = !!branding?.logoUrl?.trim();
  const initials = initialsFromName(branding?.businessName);
  const lx = cx - logoSide / 2;
  const ly = cy - logoSide / 2;

  const logo = hasLogo
    ? `<image href="${escapeXml(branding!.logoUrl!.trim())}" x="${lx}" y="${ly}" width="${logoSide}" height="${logoSide}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`
    : `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="700" fill="${escapeXml(color)}" font-family="Nunito, Arial, sans-serif">${escapeXml(initials)}</text>`;

  const centerGroup = `
    <defs>
      <clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${logoSide / 2}" /></clipPath>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="#ffffff" />
    <circle cx="${cx}" cy="${cy}" r="${rRing}" fill="#ffffff" stroke="${escapeXml(color)}" stroke-width="${strokeW}" />
    ${logo}
  `;
  return svg.replace(/<\/svg>\s*$/i, `${centerGroup}</svg>`);
}

export async function generateBusinessPortalQrSvg(
  businessSlug: string,
  brandPrimaryColor?: string | null,
  origin?: string,
  branding?: QrBranding
): Promise<string> {
  const portalUrl = buildBusinessPortalUrl(businessSlug, resolvePortalBaseUrl(origin));
  const color = normalizeQrColor(brandPrimaryColor);
  const rawSvg = await QRCode.toString(portalUrl, {
    type: 'svg',
    color: {
      dark: color,
      light: '#0000',
    },
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
  });
  return injectCenterBranding(rawSvg, color, branding);
}

export async function generateBusinessPortalQrPngDataUrl(
  businessSlug: string,
  brandPrimaryColor?: string | null,
  origin?: string,
  branding?: QrBranding
): Promise<string> {
  const svg = await generateBusinessPortalQrSvg(businessSlug, brandPrimaryColor, origin, branding);
  if (typeof window === 'undefined') {
    const portalUrl = buildBusinessPortalUrl(businessSlug, resolvePortalBaseUrl(origin));
    return QRCode.toDataURL(portalUrl, {
      color: {
        dark: normalizeQrColor(brandPrimaryColor),
        light: '#FFFFFFFF',
      },
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 1024,
    });
  }

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('QR SVG render failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Elements the QR generator emits (qrcode's `svg`/`path`, plus the centre branding). Lower-case for comparison. */
const QR_SVG_ELEMENTS = new Set(['svg', 'path', 'rect', 'g', 'defs', 'clippath', 'circle', 'image', 'text']);

/** Attributes the QR generator emits. No event handlers, no `style`. Lower-case for comparison. */
const QR_SVG_ATTRIBUTES = new Set([
  'xmlns',
  'xmlns:xlink',
  'version',
  'width',
  'height',
  'viewbox',
  'shape-rendering',
  'preserveaspectratio',
  'fill',
  'stroke',
  'stroke-width',
  'd',
  'x',
  'y',
  'cx',
  'cy',
  'r',
  'id',
  'clip-path',
  'text-anchor',
  'dominant-baseline',
  'font-size',
  'font-weight',
  'font-family',
  'href',
  'xlink:href',
]);

/** Logo hrefs: http(s), data:image/…, or a same-site absolute path (not protocol-relative). */
function isSafeQrImageHref(value: string): boolean {
  const v = value.trim();
  return /^https?:\/\//i.test(v) || /^data:image\//i.test(v) || /^\/(?!\/)/.test(v);
}

function isSafeQrAttribute(name: string, value: string): boolean {
  if (!QR_SVG_ATTRIBUTES.has(name)) return false;
  if (name === 'href' || name === 'xlink:href') return isSafeQrImageHref(value);
  // Only local references such as clip-path="url(#qrLogoClip-…)"; no external url(…) fetches.
  if (/url\s*\(/i.test(value)) return /^\s*url\(#[\w-]+\)\s*$/.test(value);
  return true;
}

function sanitizeQrSvgNode(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    if (!isSafeQrAttribute(attr.name.toLowerCase(), attr.value)) el.removeAttributeNode(attr);
  }
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3 /* TEXT_NODE */) continue;
    if (
      child.nodeType === 1 /* ELEMENT_NODE */ &&
      (child as Element).namespaceURI === SVG_NS &&
      QR_SVG_ELEMENTS.has((child as Element).localName.toLowerCase())
    ) {
      sanitizeQrSvgNode(child as Element);
      continue;
    }
    // Disallowed element (script, foreignObject, style, a, animate, set, …), comment, CDATA or processing instruction.
    el.removeChild(child);
  }
}

/**
 * Sanitises a stored QR SVG before it is inlined into the page or the print window.
 *
 * `businesses.qr_code` is plain text that any member of the business can write through the API, so it is not
 * trusted generator output by the time it is read back. Keeps only the elements and attributes the generator
 * emits (output of `generateBusinessPortalQrSvg` round-trips unchanged) and returns the re-serialised SVG, or
 * `null` when the value is not a well-formed SVG document. Browser-only (DOMParser / XMLSerializer).
 */
export function sanitizeQrSvg(svg: string | null | undefined): string | null {
  if (!svg || typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch {
    return null;
  }
  const root = doc.documentElement;
  if (
    !root ||
    root.namespaceURI !== SVG_NS ||
    root.localName !== 'svg' ||
    doc.getElementsByTagName('parsererror').length > 0
  ) {
    return null;
  }
  sanitizeQrSvgNode(root);
  return new XMLSerializer().serializeToString(root);
}

/**
 * Builds the QR print window's HTML. Every interpolated value is escaped and the SVG is sanitised;
 * returns `null` when the SVG is not valid. The layout matches the original inline template.
 */
export function buildQrPrintHtml(input: {
  slug: string;
  businessName: string | null | undefined;
  portalUrl: string;
  qrSvg: string;
}): string | null {
  const svg = sanitizeQrSvg(input.qrSvg);
  if (!svg) return null;
  return `
      <html>
        <head><title>QR ${escapeHtml(input.slug)}</title></head>
        <body style="font-family: sans-serif; margin: 24px;">
          <h2 style="margin-bottom: 12px;">${escapeHtml(input.businessName)}</h2>
          <p style="margin-bottom: 16px;">${escapeHtml(input.portalUrl)}</p>
          <div style="width: 320px; height: 320px;">${svg}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
}
