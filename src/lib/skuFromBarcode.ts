import type { Product } from '@/types/inventory';

const SKU_PREFIX = 'BC';

/**
 * Generates a unique SKU for a product created from a barcode lookup.
 * Uses BC-{barcode}; on collision appends -1, -2, etc.
 */
export function generateSkuForBarcode(
  barcode: string,
  existingProducts: Product[]
): string {
  const base = `${SKU_PREFIX}-${barcode}`;
  const existingSkus = new Set(existingProducts.map((p) => p.sku.toLowerCase()));
  if (!existingSkus.has(base.toLowerCase())) return base;
  let suffix = 1;
  while (existingSkus.has(`${base}-${suffix}`.toLowerCase())) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
