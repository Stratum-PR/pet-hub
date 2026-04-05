/** Persisted in `settings.business_branding_layout` (jsonb). */

export interface LogoSidebarExpandedLayout {
  zoom: number;
  heightPx: number;
  /** When set, allows wider horizontal logos (object-contain). Omitted or equals height → square cap. */
  maxWidthPx?: number;
}

export interface LogoKioskLayout {
  zoom: number;
  heightPx: number;
}

export interface IconSlotLayout {
  zoom: number;
  sizePx: number;
}

export interface BusinessBrandingLayout {
  logo: {
    sidebarExpanded: LogoSidebarExpandedLayout;
    kiosk: LogoKioskLayout;
  };
  icon: {
    sidebarCollapsed: IconSlotLayout;
    mobile: IconSlotLayout;
  };
}

export const DEFAULT_BUSINESS_BRANDING_LAYOUT: BusinessBrandingLayout = {
  logo: {
    sidebarExpanded: { zoom: 1, heightPx: 80 },
    kiosk: { zoom: 1, heightPx: 48 },
  },
  icon: {
    sidebarCollapsed: { zoom: 1, sizePx: 40 },
    mobile: { zoom: 1, sizePx: 36 },
  },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const x = parseFloat(v);
    if (Number.isFinite(x)) return x;
  }
  return fallback;
}

function optNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = num(v, NaN);
  return Number.isFinite(n) ? n : undefined;
}

function applyLegacyNavbar(
  base: BusinessBrandingLayout,
  legacy?: { navbar_logo_mode?: string | null; navbar_logo_size_px?: string | number | null }
) {
  if (!legacy) return;
  const sizeRaw = legacy.navbar_logo_size_px;
  const h = clamp(
    typeof sizeRaw === 'number' ? sizeRaw : parseInt(String(sizeRaw ?? '80'), 10) || 80,
    48,
    120
  );
  const wide = String(legacy.navbar_logo_mode || '').toLowerCase() === 'wide';
  base.logo.sidebarExpanded = {
    zoom: 1,
    heightPx: h,
    maxWidthPx: wide ? Math.round(h * 3) : h,
  };
  base.logo.kiosk = { zoom: 1, heightPx: 48 };
}

/** Parse DB jsonb / unknown; merge legacy navbar columns when layout is missing. */
export function parseBusinessBrandingLayout(
  raw: unknown,
  legacy?: { navbar_logo_mode?: string | null; navbar_logo_size_px?: string | number | null }
): BusinessBrandingLayout {
  const base: BusinessBrandingLayout = structuredClone(DEFAULT_BUSINESS_BRANDING_LAYOUT);

  const hasStoredLayout =
    raw != null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    (Object.prototype.hasOwnProperty.call(raw, 'logo') ||
      Object.prototype.hasOwnProperty.call(raw, 'icon'));

  if (!hasStoredLayout) {
    applyLegacyNavbar(base, legacy);
    return normalizeBusinessBrandingLayout(base);
  }

  const o = raw as Record<string, unknown>;
  const logo = o.logo as Record<string, unknown> | undefined;
  const icon = o.icon as Record<string, unknown> | undefined;

  if (logo?.sidebarExpanded && typeof logo.sidebarExpanded === 'object') {
    const se = logo.sidebarExpanded as Record<string, unknown>;
    base.logo.sidebarExpanded = {
      zoom: num(se.zoom, base.logo.sidebarExpanded.zoom),
      heightPx: num(se.heightPx, base.logo.sidebarExpanded.heightPx),
      maxWidthPx: optNum(se.maxWidthPx),
    };
  }
  if (logo?.kiosk && typeof logo.kiosk === 'object') {
    const k = logo.kiosk as Record<string, unknown>;
    base.logo.kiosk = {
      zoom: num(k.zoom, base.logo.kiosk.zoom),
      heightPx: num(k.heightPx, base.logo.kiosk.heightPx),
    };
  }
  if (icon?.sidebarCollapsed && typeof icon.sidebarCollapsed === 'object') {
    const sc = icon.sidebarCollapsed as Record<string, unknown>;
    base.icon.sidebarCollapsed = {
      zoom: num(sc.zoom, base.icon.sidebarCollapsed.zoom),
      sizePx: num(sc.sizePx, base.icon.sidebarCollapsed.sizePx),
    };
  }
  if (icon?.mobile && typeof icon.mobile === 'object') {
    const m = icon.mobile as Record<string, unknown>;
    base.icon.mobile = {
      zoom: num(m.zoom, base.icon.mobile.zoom),
      sizePx: num(m.sizePx, base.icon.mobile.sizePx),
    };
  }

  return normalizeBusinessBrandingLayout(base);
}

export function normalizeBusinessBrandingLayout(layout: BusinessBrandingLayout): BusinessBrandingLayout {
  const le = layout.logo.sidebarExpanded;
  const lk = layout.logo.kiosk;
  const ic = layout.icon.sidebarCollapsed;
  const im = layout.icon.mobile;
  return {
    logo: {
      sidebarExpanded: {
        zoom: clamp(le.zoom, 0.25, 3),
        heightPx: clamp(Math.round(le.heightPx), 32, 160),
        maxWidthPx:
          le.maxWidthPx != null ? clamp(Math.round(le.maxWidthPx), 32, 360) : undefined,
      },
      kiosk: {
        zoom: clamp(lk.zoom, 0.25, 3),
        heightPx: clamp(Math.round(lk.heightPx), 24, 120),
      },
    },
    icon: {
      sidebarCollapsed: {
        zoom: clamp(ic.zoom, 0.25, 3),
        sizePx: clamp(Math.round(ic.sizePx), 24, 72),
      },
      mobile: {
        zoom: clamp(im.zoom, 0.25, 3),
        sizePx: clamp(Math.round(im.sizePx), 24, 72),
      },
    },
  };
}

export function brandingLayoutToJson(layout: BusinessBrandingLayout): Record<string, unknown> {
  const n = normalizeBusinessBrandingLayout(layout);
  return {
    logo: {
      sidebarExpanded: {
        zoom: n.logo.sidebarExpanded.zoom,
        heightPx: n.logo.sidebarExpanded.heightPx,
        ...(n.logo.sidebarExpanded.maxWidthPx != null
          ? { maxWidthPx: n.logo.sidebarExpanded.maxWidthPx }
          : {}),
      },
      kiosk: { zoom: n.logo.kiosk.zoom, heightPx: n.logo.kiosk.heightPx },
    },
    icon: {
      sidebarCollapsed: { zoom: n.icon.sidebarCollapsed.zoom, sizePx: n.icon.sidebarCollapsed.sizePx },
      mobile: { zoom: n.icon.mobile.zoom, sizePx: n.icon.mobile.sizePx },
    },
  };
}
