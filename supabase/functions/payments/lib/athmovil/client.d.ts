/**
 * ATH Móvil Payment Button API (Evertec), REST flow.
 * Source: https://github.com/evertec/ATHM-Payment-Button-API (v1.2.2) and
 *         https://github.com/evertec/athmovil-webhooks
 *
 * Flow:
 *   1. createPayment(phone, total)  → ecommerceId + authToken; the customer gets a push in ATH Móvil.
 *   2. customer approves in the app  → status CONFIRM (poll findPayment or wait for the webhook)
 *   3. authorize(authToken)          → status COMPLETED, funds debited, referenceNumber issued.
 *   Unapproved payments become CANCEL after `timeoutSeconds` (120–600, default 600).
 *
 * Important facts from the docs:
 *   - There is NO test environment; testing uses real ATH Business + ATH Móvil accounts
 *     (the customer's card must differ from the business card).
 *   - Amounts must be between $1.00 and $1,500.00.
 *   - metadata1/metadata2 are required, max 40 characters each.
 *   - Webhooks are NOT signed. Never trust a webhook body: always re-check with findPayment().
 *   - The private token is only needed for refunds and webhook subscription. Keep it server-side.
 */
import { type PaymentResult, type PaymentStatus } from '../types.js';
export declare const ATH_BASE_URL = "https://payments.athmovil.com/api/business-transaction/ecommerce";
export declare const ATH_WEBHOOK_SUBSCRIBE_URL = "https://www.athmovil.com/transactions/webhook/post";
export declare const ATH_MIN_CENTS = 100;
export declare const ATH_MAX_CENTS = 150000;
export type AthEcommerceStatus = 'OPEN' | 'CONFIRM' | 'COMPLETED' | 'CANCEL';
export interface AthCredentials {
    /** Business public token (ATH Business app → Settings). */
    publicToken: string;
    /** Business private token. Only required for refunds and webhook subscription. */
    privateToken?: string;
}
export interface AthItem {
    name: string;
    description?: string;
    quantity: number;
    /** Unit price in cents. */
    unitAmount: number;
    /** Tax for this item in cents (optional). */
    tax?: number;
    metadata?: string | null;
}
export interface AthCreatePaymentInput {
    /** Customer's ATH Móvil phone number (10 digits, any formatting). Receives the push notification. */
    phoneNumber: string;
    /** Total in cents. */
    total: number;
    subtotal?: number;
    tax?: number;
    items?: AthItem[];
    /** Required by ATH (max 40 chars). Use your own ids, e.g. business + payment id. */
    metadata1: string;
    metadata2: string;
    /** Seconds the customer has to approve (120–600). */
    timeoutSeconds?: number;
}
export interface AthPaymentDetails {
    ecommerceStatus: AthEcommerceStatus;
    ecommerceId: string;
    referenceNumber: string;
    transactionDate: string;
    dailyTransactionId: string;
    businessName: string;
    total: number;
    subTotal?: number;
    tax: number;
    fee: number;
    netAmount: number;
    totalRefundedAmount: number;
    metadata1: string;
    metadata2: string;
    items: unknown[];
}
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export interface AthClientOptions {
    /** Override for the simulator, e.g. http://localhost:4010/api/business-transaction/ecommerce */
    baseUrl?: string;
    /** Override for the simulator, e.g. http://localhost:4010/transactions/webhook/post */
    webhookSubscribeUrl?: string;
    fetch?: FetchLike;
}
export declare function mapAthStatus(s: string | undefined, totalRefunded?: number, total?: number): PaymentStatus;
export declare class AthMovilClient {
    private readonly creds;
    private readonly baseUrl;
    private readonly webhookSubscribeUrl;
    private readonly fetchImpl;
    constructor(creds: AthCredentials, opts?: AthClientOptions);
    private call;
    /** Step 1: create the payment; ATH Móvil pushes a request to the customer's phone. */
    createPayment(input: AthCreatePaymentInput): Promise<{
        ecommerceId: string;
        authToken: string;
    }>;
    /** Current state of a payment. Use this to verify every webhook. */
    findPayment(ecommerceId: string, authToken?: string): Promise<AthPaymentDetails>;
    /** Step 3: finalize a CONFIRM payment (debits the customer). Must happen before it expires. */
    authorize(authToken: string): Promise<AthPaymentDetails>;
    /** Send the push to a different phone number (e.g. staff typed it wrong). */
    updatePhoneNumber(ecommerceId: string, phoneNumber: string, authToken: string): Promise<void>;
    cancel(ecommerceId: string): Promise<void>;
    /** Refund a COMPLETED payment (full or partial). Requires the private token. */
    refund(referenceNumber: string, amountCents: number, message?: string): Promise<{
        refund: {
            status: string;
            refundedAmount: number;
            referenceNumber: string;
        };
    }>;
    /**
     * Subscribe a listener URL to ATH Móvil Business events (done once per business).
     * Note: notifications are unsigned; put a hard-to-guess secret in the URL and still verify
     * each event with findPayment().
     */
    subscribeWebhooks(listenerURL: string, events?: Partial<Record<AthWebhookEventFlag, boolean>>): Promise<void>;
}
export type AthWebhookEventFlag = 'paymentReceivedEvent' | 'refundSentEvent' | 'donationReceivedEvent' | 'ecommercePaymentReceivedEvent' | 'ecommercePaymentCancelledEvent' | 'ecommercePaymentExpiredEvent';
/** Turn findPayment()/authorize() details into the shared result shape. */
export declare function athDetailsToResult(d: AthPaymentDetails): PaymentResult;
export type AthWebhookKind = 'ecommerce' | 'payment' | 'refund' | 'donation' | 'simulated' | 'unknown';
export interface AthWebhookEvent {
    kind: AthWebhookKind;
    /** Present for ecommerce (Payment Button) events. */
    ecommerceId?: string;
    referenceNumber?: string;
    status: PaymentStatus;
    totalCents?: number;
    metadata1?: string;
    metadata2?: string;
}
/**
 * Normalize an ATH Móvil webhook body. The documented payloads are inconsistent
 * (e.g. "ECOMMERCE"/"ecommerce", "COMPLETED"/"completed", "CANCEL"/"expired").
 * The result is UNTRUSTED: confirm with findPayment(ecommerceId) before acting on it.
 */
export declare function parseAthWebhook(body: unknown): AthWebhookEvent;
export {};
