import { cn } from '@/lib/utils';

interface SidebarLogoPreviewProps {
  logoUrl: string;
  zoom: number;
  /** Square size in pixels. */
  sizePx?: number;
  /** Match AppSidebar behavior for wordmarks. */
  mode?: 'square' | 'wide';
}

export function SidebarLogoPreview({ logoUrl, zoom, sizePx = 80, mode = 'square' }: SidebarLogoPreviewProps) {
  const isWide = mode === 'wide';
  return (
    <div
      className={cn('flex items-center justify-center overflow-visible')}
      style={{ width: isWide ? Math.round(sizePx * 3) : sizePx, height: sizePx }}
    >
      <img
        src={logoUrl}
        alt=""
        aria-hidden
        className="w-full h-full object-contain"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center',
        }}
      />
    </div>
  );
}

