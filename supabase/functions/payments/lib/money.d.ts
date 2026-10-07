/** Cents ⇄ dollars helpers. All math stays in integer cents. */
export declare function assertCents(value: number, label?: string): void;
/** 1050 → "10.50" */
export declare function centsToDecimalString(cents: number): string;
/** "10.5" | 10.5 → 1050 (rounded to the nearest cent). */
export declare function decimalToCents(value: string | number): number;
export declare function sumItems(items: {
    unitAmount: number;
    quantity: number;
}[]): number;
