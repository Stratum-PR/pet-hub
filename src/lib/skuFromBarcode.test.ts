import { describe, it, expect } from 'vitest';
import { generateSkuForBarcode } from './skuFromBarcode';
import type { Product } from '@/types/inventory';

function product(sku: string): Product {
  return {
    id: 'id-' + sku,
    name: 'Product',
    sku,
    price: 0,
    quantity: 0,
    created_at: '',
    updated_at: '',
  };
}

describe('generateSkuForBarcode', () => {
  it('returns BC-{barcode} when no collision', () => {
    expect(generateSkuForBarcode('012345678905', [])).toBe('BC-012345678905');
    expect(generateSkuForBarcode('12345678', [product('OTHER-1')])).toBe('BC-12345678');
  });

  it('returns BC-{barcode}-1 when BC-{barcode} exists', () => {
    const existing = [product('BC-012345678905')];
    expect(generateSkuForBarcode('012345678905', existing)).toBe('BC-012345678905-1');
  });

  it('returns BC-{barcode}-2 when BC-{barcode} and BC-{barcode}-1 exist', () => {
    const existing = [
      product('BC-012345678905'),
      product('BC-012345678905-1'),
    ];
    expect(generateSkuForBarcode('012345678905', existing)).toBe('BC-012345678905-2');
  });

  it('is case-insensitive for existing SKU check', () => {
    const existing = [product('bc-012345678905')];
    expect(generateSkuForBarcode('012345678905', existing)).toBe('BC-012345678905-1');
  });
});
