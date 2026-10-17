/**
 * Escapes a value for use in HTML text or a quoted attribute value.
 * Use it for every interpolation into an HTML string (print windows, document.write).
 */
// No String.prototype.replaceAll: the build targets Safari 12 / iOS 12, which lack it.
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
