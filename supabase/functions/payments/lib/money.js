/** Cents ⇄ dollars helpers. All math stays in integer cents. */
export function assertCents(value, label = 'amount') {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`${label} must be a non-negative integer number of cents (got ${value})`);
    }
}
/** 1050 → "10.50" */
export function centsToDecimalString(cents) {
    assertCents(cents);
    return (cents / 100).toFixed(2);
}
/** "10.5" | 10.5 → 1050 (rounded to the nearest cent). */
export function decimalToCents(value) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n))
        throw new RangeError(`not a number: ${value}`);
    return Math.round(n * 100);
}
export function sumItems(items) {
    return items.reduce((s, i) => s + i.unitAmount * i.quantity, 0);
}
