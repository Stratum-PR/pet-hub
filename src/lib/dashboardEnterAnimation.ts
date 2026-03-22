/**
 * Dashboard card stagger (`Dashboard.tsx` `DashboardStaggerItem`) + paw overlay handoff (`PawLoadedContent`).
 * Keep in sync: `dashboard-box-enter` duration in tailwind.config.ts
 */

/** Matches Tailwind animation `dashboard-box-enter` duration */
export const DASHBOARD_CARD_ENTER_MS = 520;

/** First dashboard block starts mid exit so it rides the same beat as the paw (shorter exit). */
export const DASHBOARD_STAGGER_AFTER_PAW_MS = 160;

/** Gap between each subsequent card (snappy cascade). */
export const DASHBOARD_STAGGER_STEP_MS = 40;

/**
 * Must be ≥ scale-reveal duration in PawStagedLoading.css + a few ms for compositor.
 */
export const PAW_STAGED_EXIT_UNMOUNT_MS = 320;

export function dashboardStaggerDelayMs(slot: number): number {
  return DASHBOARD_STAGGER_AFTER_PAW_MS + slot * DASHBOARD_STAGGER_STEP_MS;
}
