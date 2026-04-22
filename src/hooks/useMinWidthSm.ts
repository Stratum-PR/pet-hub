import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 640px)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getSnapshot() {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/** True when viewport is at least Tailwind `sm` (640px). */
export function useMinWidthSm(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
