import { cn } from '@/lib/utils';

/**
 * Radix dialog close is rendered as the last direct child of `DialogContent`.
 * Tint it for primary hero headers so it stays visible on `bg-primary`.
 */
/** Reuse on large modals that use a `bg-primary` header (e.g. staff editor). */
export const profileDialogCloseOnPrimaryClassName =
  '[&>button.absolute]:z-[101] [&>button.absolute]:text-primary-foreground [&>button.absolute]:opacity-90 [&>button.absolute]:hover:bg-primary-foreground/10 [&>button.absolute]:hover:opacity-100 [&>button.absolute]:focus-visible:ring-primary-foreground/40';

/**
 * Shared shell for client + pet CRM profile dialogs.
 * Fixed height on all breakpoints (uses svh for stable mobile layout when browser chrome changes)
 * so tab panels never resize when switching tabs.
 */
export const profileDialogShellClassName = cn(
  'max-w-[min(100vw-1.5rem,56rem)] overflow-hidden gap-0 p-0 sm:rounded-3xl',
  'flex flex-col bg-background',
  'h-[min(90svh,900px)] max-h-[min(90svh,900px)]',
  profileDialogCloseOnPrimaryClassName,
);

/** Padding inside the primary hero (client / pet profile modals). */
export const profileDialogPrimaryHeroInnerClassName = 'px-4 pb-4 pt-5 sm:px-6 sm:pt-6';

/**
 * Underline-style tab list (reference: bold active tab + thick bottom border).
 */
export const profileDialogTabsListClassName = cn(
  'relative z-10 mb-3 flex h-auto w-full shrink-0 flex-nowrap items-stretch justify-start gap-0 overflow-x-auto rounded-none border-0 border-b border-border bg-transparent p-0 text-muted-foreground',
);

export const profileDialogTabsTriggerClassName = cn(
  'shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium shadow-none',
  'text-muted-foreground hover:text-foreground',
  'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
);

/** Wrapper for tab area under the hero (white / background surface). */
export const profileDialogTabsChromeClassName =
  'relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-4 pb-4 pt-1 sm:px-6 sm:pb-6 sm:pt-2';

/**
 * Wrapper directly under the tab triggers: fills all space below the tabs inside the dialog.
 * Each tab panel is flex-1 inside this region so Resumen / Citas / etc. share the same height.
 */
export const profileTabsBodyShellClassName = 'flex min-h-0 flex-1 flex-col';

/**
 * Single tab panel: fills the body shell, scrolls inside, shared chrome (border / radius) so every tab looks the same frame.
 */
export const profileTabPanelClassName = cn(
  'mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-xl border border-border/60 bg-background p-4 shadow-sm sm:p-5',
  'data-[state=inactive]:hidden',
);
