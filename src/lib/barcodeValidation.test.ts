import { describe, it, expect } from 'vitest';
import {
  isValidBarcodeFormat,
  normalizeBarcodeInput,
  VALID_BARCODE_LENGTHS,
} from './barcodeValidation';

describe('isValidBarcodeFormat', () => {
  it('returns true for 8-digit barcode', () => {
    expect(isValidBarcodeFormat('12345678')).toBe(true);
  });
  it('returns true for 12-digit barcode (UPC-A)', () => {
    expect(isValidBarcodeFormat('012345678905')).toBe(true);
  });
  it('returns true for 13-digit barcode (EAN-13)', () => {
    expect(isValidBarcodeFormat('0123456789012')).toBe(true);
  });
  it('returns true for 14-digit barcode', () => {
    expect(isValidBarcodeFormat('01234567890123')).toBe(true);
  });
  it('returns false for empty string', () => {
    expect(isValidBarcodeFormat('')).toBe(false);
    expect(isValidBarcodeFormat('   ')).toBe(false);
  });
  it('returns false for non-digits', () => {
    expect(isValidBarcodeFormat('12345-7890')).toBe(false);
    expect(isValidBarcodeFormat('01234a678905')).toBe(false);
  });
  it('returns false for wrong lengths', () => {
    expect(isValidBarcodeFormat('123')).toBe(false);
    expect(isValidBarcodeFormat('123456789')).toBe(false);
    expect(isValidBarcodeFormat('123456789012345')).toBe(false); // 15 digits
  });
});

describe('normalizeBarcodeInput', () => {
  it('trims whitespace', () => {
    expect(normalizeBarcodeInput('  012345678905  ')).toBe('012345678905');
  });
  it('returns empty string as-is for trim', () => {
    expect(normalizeBarcodeInput('')).toBe('');
  });
});

describe('VALID_BARCODE_LENGTHS', () => {
  it('contains 8, 12, 13, 14', () => {
    expect(VALID_BARCODE_LENGTHS).toContain(8);
    expect(VALID_BARCODE_LENGTHS).toContain(12);
    expect(VALID_BARCODE_LENGTHS).toContain(13);
    expect(VALID_BARCODE_LENGTHS).toContain(14);
    expect(VALID_BARCODE_LENGTHS).toHaveLength(4);
  });
});
