import { cn } from '@/lib/utils';

/**
 * Shared shell for client + pet CRM profile dialogs.
 * Fixed height on all breakpoints (uses svh for stable mobile layout when browser chrome changes)
 * so tab panels never resize when switching tabs.
 */
export const profileDialogShellClassName = cn(
  'max-w-[min(100vw-1.5rem,56rem)] overflow-hidden gap-0 p-0 sm:rounded-3xl',
  'flex flex-col',
  'h-[min(90svh,900px)] max-h-[min(90svh,900px)]',
);

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
