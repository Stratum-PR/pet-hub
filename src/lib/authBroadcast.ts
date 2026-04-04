import type { User } from '@supabase/supabase-js';

/** Matches spec: cross-tab auth sync channel name. */
export const AUTH_BROADCAST_CHANNEL_NAME = 'auth_channel';

const LS_KEY = 'pet_hub_auth_channel_evt';

export type AuthBroadcastMessage =
  | { type: 'LOGOUT' }
  | { type: 'LOGIN'; payload: { user: Record<string, unknown> } };

function cloneUserForBroadcast(user: User): Record<string, unknown> {
  return JSON.parse(JSON.stringify(user)) as Record<string, unknown>;
}

function postViaLocalStorage(msg: AuthBroadcastMessage): void {
  try {
    const payload = JSON.stringify({ ...msg, _ts: Date.now() });
    localStorage.setItem(LS_KEY, payload);
    window.setTimeout(() => {
      try {
        localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }
    }, 750);
  } catch {
    /* quota / private mode */
  }
}

/** Notify other tabs that the session ended (explicit sign-out, expiry handling, etc.). */
export function broadcastAuthLogout(): void {
  const msg: AuthBroadcastMessage = { type: 'LOGOUT' };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(AUTH_BROADCAST_CHANNEL_NAME);
      ch.postMessage(msg);
      ch.close();
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') postViaLocalStorage(msg);
}

/** Notify other tabs that a session was established (password, OAuth, etc.). */
export function broadcastAuthLogin(user: User): void {
  const msg: AuthBroadcastMessage = { type: 'LOGIN', payload: { user: cloneUserForBroadcast(user) } };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(AUTH_BROADCAST_CHANNEL_NAME);
      ch.postMessage(msg);
      ch.close();
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') postViaLocalStorage(msg);
}

function parseStoredMessage(raw: string | null): AuthBroadcastMessage | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as AuthBroadcastMessage & { _ts?: number };
    if (o.type === 'LOGOUT') return { type: 'LOGOUT' };
    if (o.type === 'LOGIN' && o.payload?.user && typeof o.payload.user === 'object') {
      return { type: 'LOGIN', payload: { user: o.payload.user as Record<string, unknown> } };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Subscribe to auth messages from other tabs (BroadcastChannel + storage fallback).
 * Returns unsubscribe. Safe to call only in the browser.
 */
export function subscribeAuthBroadcast(onMessage: (msg: AuthBroadcastMessage) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const unsubs: Array<() => void> = [];

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(AUTH_BROADCAST_CHANNEL_NAME);
      ch.onmessage = (ev: MessageEvent<AuthBroadcastMessage>) => {
        const d = ev?.data;
        if (d?.type === 'LOGOUT' || d?.type === 'LOGIN') onMessage(d);
      };
      unsubs.push(() => {
        try {
          ch.close();
        } catch {
          /* ignore */
        }
      });
    }
  } catch {
    /* ignore */
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key !== LS_KEY || !e.newValue) return;
    const msg = parseStoredMessage(e.newValue);
    if (msg) onMessage(msg);
  };
  window.addEventListener('storage', onStorage);
  unsubs.push(() => window.removeEventListener('storage', onStorage));

  return () => {
    for (const u of unsubs) {
      try {
        u();
      } catch {
        /* ignore */
      }
    }
  };
}
