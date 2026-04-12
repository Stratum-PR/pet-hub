import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { HelmetProvider } from "react-helmet-async";
import { isIgnorableWindowErrorEvent } from "./lib/ignorableWindowErrorEvent";
import { devConsole, isClientDebugSurfacesEnabled } from "./lib/clientDebug";

function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('AbortError');
  }
  if (typeof err === 'string') {
    return err.includes('AbortError') || err.includes('aborted');
  }
  return false;
}

function formatBootstrapError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack || err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

function renderFatalError(err: unknown) {
  // Ignore AbortErrors - these are harmless and occur during normal operation
  if (isAbortError(err)) {
    devConsole.warn("[bootstrap] Ignoring harmless AbortError:", err);
    return;
  }

  devConsole.error("[bootstrap] fatal error", err);
  const msg = formatBootstrapError(err);
  const showDetails = isClientDebugSurfacesEnabled();

  // Render a minimal fallback even if React can't mount. Use textContent for error
  // message and createElement for structure so no innerHTML with dynamic content (XSS-safe).
  const root = document.createElement("div");
  root.setAttribute("style", "padding:16px;font-family:ui-sans-serif,system-ui");
  const h2 = document.createElement("h2");
  h2.setAttribute("style", "font-size:18px;font-weight:700;margin-bottom:8px");
  h2.textContent = "App failed to start";
  const p = document.createElement("p");
  p.setAttribute("style", "margin-bottom:12px");
  p.textContent = showDetails
    ? "Copy the error below and paste it here."
    : "Please refresh the page or try again later.";
  const pre = document.createElement("pre");
  pre.setAttribute("style", "background:#111827;color:#e5e7eb;padding:12px;border-radius:8px;overflow:auto;max-height:360px;font-size:12px;line-height:1.4");
  pre.textContent = showDetails ? msg : "Something went wrong while starting the app.";
  root.appendChild(h2);
  root.appendChild(p);
  root.appendChild(pre);
  // Avoid replaceChildren: missing on Safari < 14 (WebKit); keep fatal UI working everywhere.
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  document.body.appendChild(root);
}

// Capture early runtime errors before React mounts.
window.addEventListener("error", (e) => {
  if (isIgnorableWindowErrorEvent(e)) {
    return;
  }
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
