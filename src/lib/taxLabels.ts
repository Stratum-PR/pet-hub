/**
 * Single source of truth for Puerto Rico tax label normalization.
 * Legacy labels (IVU, Municipal, "State (IVU)", etc.) must never appear in UI or new data.
 */

/** Canonical labels we allow. Legacy variants map to these. */
const STATE_TAX = 'State Tax';
const MUNICIPAL_TAX = 'Municipal Tax';

/** Legacy labels (case-insensitive match) → canonical. */
const LEGACY_LOWER_TO_CANONICAL: Record<string, string> = {
  ivu: STATE_TAX,
  'state (ivu)': STATE_TAX,
  'state(ivu)': STATE_TAX,
  municipal: MUNICIPAL_TAX,
  'municipal tax': MUNICIPAL_TAX,
  'state tax': STATE_TAX,
};

function normalize(label: string): string {
  if (!label || typeof label !== 'string') return label;
  const trimmed = label.trim();
  const lower = trimmed.toLowerCase();
  return LEGACY_LOWER_TO_CANONICAL[lower] ?? trimmed;
}

/**
 * Normalize a tax label for display (receipt, invoice, transaction detail, create, settings).
 * Use whenever a tax label is shown to the user.
 */
export function normalizeTaxLabelForDisplay(label: string): string {
  return normalize(label);
}

/**
 * Normalize a tax label before persisting (tax_snapshot on transactions, tax_settings in DB).
 * Ensures we never save IVU / Municipal / "State (IVU)" again.
 */
export function normalizeTaxLabelForStorage(label: string): string {
  return normalize(label);
}
