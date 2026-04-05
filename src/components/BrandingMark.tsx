import type { BusinessBrandingLayout } from '@/lib/businessBrandingLayout';
import { cn } from '@/lib/utils';

/** Expanded sidebar header: logo with height + optional wide max width + zoom. */
export function BrandingLogoSidebarExpanded({
  logoUrl,
  layout,
  className,
}: {
  logoUrl: string;
  layout: BusinessBrandingLayout['logo']['sidebarExpanded'];
  className?: string;
}) {
  const maxW = layout.maxWidthPx ?? layout.heightPx;
  return (
    <img
      src={logoUrl}
      alt=""
      aria-hidden
      className={cn('object-contain', className)}
      style={{
        height: layout.heightPx,
        maxWidth: maxW,
        transform: `scale(${layout.zoom})`,
        transformOrigin: 'center',
      }}
    />
  );
}

/** Collapsed rail or mobile sheet: icon (or logo fallback) in a square slot. */
export function BrandingIconCompact({
  imageUrl,
  layout,
  className,
}: {
  imageUrl: string;
  layout: BusinessBrandingLayout['icon']['sidebarCollapsed'] | BusinessBrandingLayout['icon']['mobile'];
  className?: string;
}) {
  return (
    <img
      src={imageUrl}
      alt=""
      aria-hidden
      className={cn('object-contain', className)}
      style={{
        width: layout.sizePx,
        height: layout.sizePx,
        maxWidth: '100%',
        transform: `scale(${layout.zoom})`,
        transformOrigin: 'center',
      }}
    />
  );
}

/** Punch clock header logo. */
export function BrandingLogoKiosk({
  logoUrl,
  layout,
  className,
  alt = '',
}: {
  logoUrl: string;
  layout: BusinessBrandingLayout['logo']['kiosk'];
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      className={cn('w-auto object-contain', className)}
      style={{
        height: layout.heightPx,
        maxWidth: 240,
        transform: `scale(${layout.zoom})`,
        transformOrigin: 'center',
      }}
    />
  );
}
