/**
 * Barcode = UPC/EAN/GTIN (primary for scan matching). SKU = internal id (required per product).
 * Valid barcode lengths for UPC/EAN/GTIN (digits only): 8, 12, 13, 14.
 * Used by client for quick feedback and by Edge Function for server validation.
 */
export const VALID_BARCODE_LENGTHS = [8, 12, 13, 14] as const;

/**
 * Validates barcode format: digits only, length 8, 12, 13, or 14.
 * @returns true if valid
 */
export function isValidBarcodeFormat(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^\d+$/.test(trimmed)) return false;
  return (VALID_BARCODE_LENGTHS as readonly number[]).includes(trimmed.length);
}

/**
 * Normalizes barcode for API lookup: trim and ensure string.
 * Does not validate format.
 */
export function normalizeBarcodeInput(value: string): string {
  return value.trim();
}

/**
 * Normalizes barcode for matching so 12-digit UPC and 13-digit EAN (0 + UPC) match.
 * Trims and pads 12-digit to 13 with leading 0; others returned trimmed.
 */
export function normalizeBarcodeForMatch(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed.length === 12) return '0' + trimmed;
  return trimmed;
}
