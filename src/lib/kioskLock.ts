const KEY = 'kiosk_locked';
const EVENT_NAME = 'kiosklockchange';

export function isKioskLocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function setKioskLocked(locked: boolean): void {
  try {
    if (locked) {
      sessionStorage.setItem(KEY, 'true');
    } else {
      sessionStorage.removeItem(KEY);
    }
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    // ignore (e.g. during SSR)
  }
}

