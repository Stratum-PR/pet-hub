/**
 * P1-12: error monitoring with Sentry (web app only; Edge Functions are a separate step).
 *
 * - Off unless `VITE_SENTRY_DSN` is set (Vercel env), and always off on localhost / 127.0.0.1.
 * - Errors only: no performance tracing, no session replay, no user feedback widget.
 * - Privacy: `sendDefaultPii: false`, the user is never attached, and `beforeSend` / `beforeBreadcrumb`
 *   replace email addresses and phone numbers with placeholders (clients' and staff's contact details
 *   show up in error messages and URLs).
 * - `release` is the git commit Vercel built (`VERCEL_GIT_COMMIT_SHA`, injected by vite.config.ts),
 *   so every error maps to a commit and, through the `fix/<unit>` tags, to a change unit.
 */
import * as Sentry from '@sentry/react';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 10+ digit phone numbers with optional +, spaces, dots, dashes or parentheses (e.g. "(787) 555-0100").
const PHONE_RE = /(?:\+?\d[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

export function scrubText(value: string): string {
  return value.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
}

/** Recursively scrubs every string in a JSON-like value (objects, arrays). Depth-limited. */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 8 || value == null) return value;
  if (typeof value === 'string') return scrubText(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1)) as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubDeep(v, depth + 1);
    return out as T;
  }
  return value;
}

function isAbortLike(event: ErrorEvent): boolean {
  return (event.exception?.values ?? []).some(
    (v) => v.type === 'AbortError' || /AbortError|aborted/.test(v.value ?? ''),
  );
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  // Harmless and frequent (navigation cancels fetches); the error boundary ignores them too.
  if (isAbortLike(event)) return null;
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  return scrubDeep(event);
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Console breadcrumbs can carry whole objects (profiles, clients); keep only the scrubbed message.
  if (breadcrumb.category === 'console') {
    return { ...breadcrumb, data: undefined, message: breadcrumb.message ? scrubText(breadcrumb.message) : undefined };
  }
  return scrubDeep(breadcrumb);
}

export function sentryEnvironment(hostname: string): 'production' | 'dev' | 'preview' | null {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return null;
  if (hostname === 'grumi.pet' || hostname === 'www.grumi.pet') return 'production';
  if (hostname === 'dev.grumi.pet') return 'dev';
  return 'preview';
}

let enabled = false;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const environment = typeof window !== 'undefined' ? sentryEnvironment(window.location.hostname) : null;
  if (!dsn || !environment) return;
  Sentry.init({
    dsn,
    environment,
    release: (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: (defaults) => defaults.filter((i) => i.name !== 'BrowserSession'),
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
  enabled = true;
}

/** Reports an error the app caught itself (e.g. the React error boundary). No-op when Sentry is off. */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
