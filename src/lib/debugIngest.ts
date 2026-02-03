/**
 * Debug-mode logging: send one NDJSON payload per call to the session debug endpoint.
 * Used to capture logout, redirect, and auth flow for debugging.
 */
const DEBUG_INGEST_URL = 'http://127.0.0.1:7243/ingest/a4ba6c3b-50d1-4bbf-87b8-3274399108d1';

export function debugIngest(payload: {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
}) {
  const body = {
    sessionId: 'debug-session',
    runId: payload.runId ?? 'run1',
    hypothesisId: payload.hypothesisId ?? '',
    location: payload.location,
    message: payload.message,
    data: payload.data ?? {},
    timestamp: Date.now(),
  };
  fetch(DEBUG_INGEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}
