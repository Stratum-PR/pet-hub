/**
 * Safari (and other browsers) fire window "error" for failed stylesheets, images, fonts, etc.
 * Those must not tear down the SPA — only real JS exceptions should.
 * Also ignore classic cross-origin "Script error." noise (no lineno / error object).
 */
export function isIgnorableWindowErrorEvent(event: ErrorEvent): boolean {
  if (event.message === "Script error." && !event.error) {
    const line = event.lineno;
    if (line === 0 || line == null || Number.isNaN(line)) {
      return true;
    }
  }

  const t = event.target;
  if (t == null || t === window) {
    return false;
  }

  if (typeof Node !== "undefined" && t instanceof Node && t.nodeType === Node.ELEMENT_NODE) {
    const tag = (t as Element).tagName;
    if (tag === "LINK" || tag === "IMG" || tag === "SOURCE") {
      return true;
    }
  }

  return false;
}
