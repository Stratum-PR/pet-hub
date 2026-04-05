import type { ReactNode } from 'react';

/** Mimics desktop expanded sidebar header (`AppSidebar` ~w-60, h-20). */
export function BrandingSidebarExpandedChromePreview({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-sidebar text-sidebar-foreground overflow-hidden w-60 shrink-0 shadow-sm">
      <div className="h-20 px-3 flex items-center justify-center min-w-0 border-b border-sidebar-border">
        {children}
      </div>
    </div>
  );
}

/** Mimics collapsed rail (`w-[72px]`). */
export function BrandingSidebarCollapsedChromePreview({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-sidebar text-sidebar-foreground overflow-hidden w-[72px] shrink-0 shadow-sm">
      <div className="h-20 px-0 flex items-center justify-center min-w-0">{children}</div>
    </div>
  );
}

/** Narrow strip like mobile sheet top row. */
export function BrandingMobileHeaderChromePreview({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-sidebar text-sidebar-foreground overflow-hidden w-full max-w-[280px] shadow-sm">
      <div className="h-14 px-3 flex items-center gap-2 min-w-0 border-b border-sidebar-border">{children}</div>
    </div>
  );
}
