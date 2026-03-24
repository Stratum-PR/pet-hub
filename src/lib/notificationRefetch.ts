/** CustomEvent name — all mounted `useNotifications` instances listen and refetch. */
export const PET_HUB_REFETCH_NOTIFICATIONS = 'pet-hub-refetch-notifications';

/** Call after server-side notification inserts (e.g. `dispatch_staff_birthdays_for_business`) so the header bell updates without a full reload. */
export function requestNotificationsRefetch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PET_HUB_REFETCH_NOTIFICATIONS));
}
