const SERVICE_FILTER_KEY = 'appt_book_calendar_service_filter';
const CALENDAR_SCOPE_KEY = 'appt_book_calendar_scope';
const SIDEBAR_FILTER_MODE_KEY = 'appt_book_sidebar_filter_mode';
const SELECTED_SERVICE_IDS_KEY = 'appt_book_selected_service_ids';
const SELECTED_EMPLOYEE_IDS_KEY = 'appt_book_selected_employee_ids';

export type ApptBookCalendarScope = 'by-day' | 'by-week';
export type ApptBookSidebarFilterMode = 'specialist' | 'booking-category';

const VALID_SERVICES = new Set(['Grooming', 'Daycare', 'All Services']);

export function getStoredApptBookServiceFilter(): string {
  try {
    const raw = localStorage.getItem(SERVICE_FILTER_KEY);
    if (raw && VALID_SERVICES.has(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'All Services';
}

export function setStoredApptBookServiceFilter(value: string): void {
  if (!VALID_SERVICES.has(value)) return;
  try {
    localStorage.setItem(SERVICE_FILTER_KEY, value);
  } catch {
    /* ignore */
  }
}

export function getStoredApptBookCalendarScope(): ApptBookCalendarScope {
  try {
    const raw = localStorage.getItem(CALENDAR_SCOPE_KEY);
    if (raw === 'by-week' || raw === 'by-day') return raw;
  } catch {
    /* ignore */
  }
  return 'by-day';
}

export function setStoredApptBookCalendarScope(scope: ApptBookCalendarScope): void {
  try {
    localStorage.setItem(CALENDAR_SCOPE_KEY, scope);
  } catch {
    /* ignore */
  }
}

export function getStoredSidebarFilterMode(): ApptBookSidebarFilterMode {
  try {
    const raw = localStorage.getItem(SIDEBAR_FILTER_MODE_KEY);
    if (raw === 'specialist' || raw === 'booking-category') return raw;
  } catch {
    /* ignore */
  }
  return 'booking-category';
}

export function setStoredSidebarFilterMode(mode: ApptBookSidebarFilterMode): void {
  try {
    localStorage.setItem(SIDEBAR_FILTER_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function getStoredSelectedServiceIds(): string[] | null {
  try {
    const raw = localStorage.getItem(SELECTED_SERVICE_IDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

export function setStoredSelectedServiceIds(ids: string[]): void {
  try {
    localStorage.setItem(SELECTED_SERVICE_IDS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function getStoredSelectedEmployeeIds(): string[] | null {
  try {
    const raw = localStorage.getItem(SELECTED_EMPLOYEE_IDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

export function setStoredSelectedEmployeeIds(ids: string[]): void {
  try {
    localStorage.setItem(SELECTED_EMPLOYEE_IDS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function clearApptBookCategoryFilterStorage(): void {
  try {
    localStorage.removeItem(SELECTED_SERVICE_IDS_KEY);
    localStorage.removeItem(SELECTED_EMPLOYEE_IDS_KEY);
  } catch {
    /* ignore */
  }
}

export function clearStoredSelectedServiceIds(): void {
  try {
    localStorage.removeItem(SELECTED_SERVICE_IDS_KEY);
  } catch {
    /* ignore */
  }
}

export function clearStoredSelectedEmployeeIds(): void {
  try {
    localStorage.removeItem(SELECTED_EMPLOYEE_IDS_KEY);
  } catch {
    /* ignore */
  }
}
