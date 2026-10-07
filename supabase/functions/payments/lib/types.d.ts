/**
 * Provider-neutral types shared by every Stratum app (pet-hub/Grumi first).
 * Amounts are always integer cents in USD; providers convert at the edge.
 */
export type ProviderId = 'stripe' | 'athmovil';
/** Lifecycle every provider is mapped onto. */
export type PaymentStatus = 'pending' | 'awaiting_capture' | 'succeeded' | 'canceled' | 'expired' | 'failed' | 'refunded' | 'partially_refunded';
export interface LineItem {
    name: string;
    /** Unit price in cents. */
    unitAmount: number;
    quantity: number;
    description?: string;
}
export interface CreatePaymentInput {
    /** Total in cents (must equal the line items sum when items are given). */
    amount: number;
    currency?: 'usd';
    items?: LineItem[];
    /** Shown to the payer (business name, appointment summary…). */
    description?: string;
    /** Your own ids, echoed back on webhooks. Keep values short (ATH Móvil allows 40 chars). */
    reference: {
        businessId: string;
        paymentId: string;
        appointmentId?: string;
    };
}
export interface PaymentResult {
    provider: ProviderId;
    /** Provider's id for this attempt (Stripe Checkout Session id / ATH Móvil ecommerceId). */
    providerPaymentId: string;
    status: PaymentStatus;
    /** Where the payer completes the payment (Stripe hosted page). Encode it as a QR or text it. */
    payUrl?: string;
    /** Provider's final receipt/reference number once paid. */
    receiptReference?: string;
    /** Amount actually paid, cents. */
    amountPaid?: number;
    /** Provider fee, cents, when the provider reports it. */
    fee?: number;
    /** ISO timestamp after which the attempt can no longer be paid. */
    expiresAt?: string;
    raw?: unknown;
}
export declare class PaymentProviderError extends Error {
    readonly provider: ProviderId;
    readonly status?: number | undefined;
    readonly code?: string | undefined;
    readonly details?: unknown | undefined;
    constructor(message: string, provider: ProviderId, status?: number | undefined, code?: string | undefined, details?: unknown | undefined);
}
