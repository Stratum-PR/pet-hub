import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";

function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('AbortError');
  }
  if (typeof err === 'string') {
    return err.includes('AbortError') || err.includes('aborted');
  }
  return false;
}

function renderFatalError(err: unknown) {
  // Ignore AbortErrors - these are harmless and occur during normal operation
  if (isAbortError(err)) {
    // eslint-disable-next-line no-console
    console.warn("[bootstrap] Ignoring harmless AbortError:", err);
    return;
  }

  // eslint-disable-next-line no-console
  console.error("[bootstrap] fatal error", err);
  const msg =
    err instanceof Error ? (err.stack || err.message) : JSON.stringify(err, null, 2);

  // Render a minimal fallback even if React can't mount.
  document.body.innerHTML = `
    <div style="padding:16px;font-family:ui-sans-serif,system-ui">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:8px">App failed to start</h2>
      <p style="margin-bottom:12px">Copy the error below and paste it here.</p>
      <pre style="background:#111827;color:#e5e7eb;padding:12px;border-radius:8px;overflow:auto;max-height:360px;font-size:12px;line-height:1.4">${msg
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")}</pre>
    </div>
  `;
}

// Capture early runtime errors before React mounts.
window.addEventListener("error", (e) => {
  if (!isAbortError(e.error || e.message)) {
    renderFatalError(e.error || e.message);
  }
});
window.addEventListener("unhandledrejection", (e) => {
  if (!isAbortError(e.reason)) {
    renderFatalError(e.reason);
  }
});

try {
  const el = document.getElementById("root");
  if (!el) throw new Error("Missing #root element in index.html");

  createRoot(el).render(
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );
} catch (err) {
  renderFatalError(err);
}
