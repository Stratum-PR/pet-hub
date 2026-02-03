/**
 * In-memory auth debug log so we can capture the sequence of events even when
 * the console is cleared or the app is in a redirect loop. Only used in DEV.
 */

const MAX_ENTRIES = 100;
const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

export interface AuthLogEntry {
  ts: number;
  tag: string;
  message: string;
  data?: unknown;
}

const buffer: AuthLogEntry[] = [];

export function authLog(tag: string, message: string, data?: unknown): void {
  const entry: AuthLogEntry = { ts: Date.now(), tag, message, data };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  if (isDev && typeof console !== 'undefined' && console.log) {
    console.log(`[${tag}] ${message}`, data !== undefined ? data : '');
  }
}

export function getAuthLogs(): AuthLogEntry[] {
  return [...buffer];
}

export function getAuthLogsAsText(): string {
  return buffer
    .map((e) => {
      const dataStr = e.data !== undefined ? ' ' + JSON.stringify(e.data) : '';
      return `${new Date(e.ts).toISOString()} [${e.tag}] ${e.message}${dataStr}`;
    })
    .join('\n');
}

export function clearAuthLogs(): void {
  buffer.length = 0;
}
