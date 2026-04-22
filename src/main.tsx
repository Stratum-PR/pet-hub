import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { HelmetProvider } from "react-helmet-async";
import { isIgnorableWindowErrorEvent } from "./lib/ignorableWindowErrorEvent";
import { devConsole, isClientDebugSurfacesEnabled } from "./lib/clientDebug";

// #region agent log
if (import.meta.env.DEV) {
  fetch("/__agent-debug-be8983", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "be8983",
      location: "src/main.tsx:post-import",
      message: "main module finished imports",
      data: {
        href: typeof window !== "undefined" ? window.location?.pathname : "ssr",
        safariLikely:
          typeof navigator !== "undefined" &&
          /safari/i.test(navigator.userAgent) &&
          !/chrom(e|ium)/i.test(navigator.userAgent),
        dvhMinHeightSupported:
          typeof CSS !== "undefined" &&
          typeof CSS.supports === "function" &&
          CSS.supports("min-height", "100dvh"),
      },
      timestamp: Date.now(),
      hypothesisId: "A",
      runId: "post-safari-dvh",
    }),
  }).catch(() => {});
}
// #endregion

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
    // #region agent log
    if (import.meta.env.DEV) {
      fetch("/__agent-debug-be8983", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "be8983",
          location: "src/main.tsx:window-error",
          message: "window error before fatal UI",
          data: {
            eventMessage: String(e.message ?? "").slice(0, 240),
            filename: e.filename ? String(e.filename).split("/").slice(-2).join("/") : "",
            lineno: e.lineno ?? null,
            colno: e.colno ?? null,
          },
          timestamp: Date.now(),
          hypothesisId: "C",
          runId: "pre-fix",
        }),
      }).catch(() => {});
    }
    // #endregion
    renderFatalError(e.error || e.message);
  }
});
window.addEventListener("unhandledrejection", (e) => {
  if (!isAbortError(e.reason)) {
    // #region agent log
    if (import.meta.env.DEV) {
      const r = e.reason;
      const reasonStr =
        r instanceof Error ? `${r.name}:${String(r.message).slice(0, 200)}` : String(r).slice(0, 200);
      fetch("/__agent-debug-be8983", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "be8983",
          location: "src/main.tsx:unhandledrejection",
          message: "unhandled rejection before fatal UI",
          data: { reason: reasonStr },
          timestamp: Date.now(),
          hypothesisId: "C",
          runId: "pre-fix",
        }),
      }).catch(() => {});
    }
    // #endregion
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
  // #region agent log
  if (import.meta.env.DEV) {
    fetch("/__agent-debug-be8983", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "be8983",
        location: "src/main.tsx:after-render",
        message: "createRoot().render invoked",
        data: { hasRootEl: !!document.getElementById("root") },
        timestamp: Date.now(),
        hypothesisId: "B",
        runId: "pre-fix",
      }),
    }).catch(() => {});
  }
  // #endregion
} catch (err) {
  // #region agent log
  if (import.meta.env.DEV) {
    fetch("/__agent-debug-be8983", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "be8983",
        location: "src/main.tsx:catch",
        message: "bootstrap try/catch threw",
        data: {
          isError: err instanceof Error,
          name: err instanceof Error ? err.name : typeof err,
        },
        timestamp: Date.now(),
        hypothesisId: "E",
        runId: "pre-fix",
      }),
    }).catch(() => {});
  }
  // #endregion
  renderFatalError(err);
}
