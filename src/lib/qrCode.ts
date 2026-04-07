import QRCode from 'qrcode';
import { hslToHex, rgbStringToHsl } from '@/lib/colorFormat';

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

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
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
