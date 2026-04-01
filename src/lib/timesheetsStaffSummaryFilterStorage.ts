/** Session-scoped staff multi-select on Reports → Timesheets → Staff summary. */

export function staffSummaryFilterStorageKey(businessId: string): string {
  return `pet-hub:timesheets-staff-summary:${businessId}`;
}

/** Drop saved filter when navigating outside `/reports/payroll` (refresh keeps storage). */
export function clearStaffSummaryFilterIfOutsidePayroll(
  businessId: string | undefined,
  pathWithinBusiness: string,
): void {
  if (!businessId) return;
  const underPayroll = /^\/reports\/payroll(\/|$)/.test(pathWithinBusiness);
  if (!underPayroll) {
    sessionStorage.removeItem(staffSummaryFilterStorageKey(businessId));
  }
}
