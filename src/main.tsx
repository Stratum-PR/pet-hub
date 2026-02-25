import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { HelmetProvider } from "react-helmet-async";

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
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[bootstrap] Ignoring harmless AbortError:", err);
    }
    return;
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error("[bootstrap] fatal error", err);
  }
  const msg =
    err instanceof Error ? (err.stack || err.message) : JSON.stringify(err, null, 2);

  // Render a minimal fallback even if React can't mount. Use textContent for error
  // message and createElement for structure so no innerHTML with dynamic content (XSS-safe).
  const root = document.createElement("div");
  root.setAttribute("style", "padding:16px;font-family:ui-sans-serif,system-ui");
  const h2 = document.createElement("h2");
  h2.setAttribute("style", "font-size:18px;font-weight:700;margin-bottom:8px");
  h2.textContent = "App failed to start";
  const p = document.createElement("p");
  p.setAttribute("style", "margin-bottom:12px");
  p.textContent = "Copy the error below and paste it here.";
  const pre = document.createElement("pre");
  pre.setAttribute("style", "background:#111827;color:#e5e7eb;padding:12px;border-radius:8px;overflow:auto;max-height:360px;font-size:12px;line-height:1.4");
  pre.textContent = msg;
  root.append(h2, p, pre);
  document.body.replaceChildren(root);
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
    <HelmetProvider>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    </HelmetProvider>
  );
} catch (err) {
  renderFatalError(err);
}
