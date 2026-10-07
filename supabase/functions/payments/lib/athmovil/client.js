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
import { PaymentProviderError } from '../types.js';
import { assertCents, centsToDecimalString, decimalToCents } from '../money.js';
export const ATH_BASE_URL = 'https://payments.athmovil.com/api/business-transaction/ecommerce';
export const ATH_WEBHOOK_SUBSCRIBE_URL = 'https://www.athmovil.com/transactions/webhook/post';
export const ATH_MIN_CENTS = 100;
export const ATH_MAX_CENTS = 150_000;
function digitsOnly(phone) {
    const d = phone.replace(/\D/g, '');
    // Accept "+1 787…" / "1787…" by dropping a leading country code.
    return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}
function clip40(s) {
    return s.length > 40 ? s.slice(0, 40) : s;
}
export function mapAthStatus(s, totalRefunded = 0, total = 0) {
    switch ((s ?? '').toUpperCase()) {
        case 'OPEN':
            return 'pending';
        case 'CONFIRM':
            return 'awaiting_capture';
        case 'COMPLETED':
            if (totalRefunded > 0)
                return totalRefunded >= total ? 'refunded' : 'partially_refunded';
            return 'succeeded';
        case 'CANCEL':
        case 'CANCELLED':
            return 'canceled';
        case 'EXPIRED':
            return 'expired';
        default:
            return 'failed';
    }
}
export class AthMovilClient {
    creds;
    baseUrl;
    webhookSubscribeUrl;
    fetchImpl;
    constructor(creds, opts = {}) {
        this.creds = creds;
        if (!creds.publicToken)
            throw new Error('ATH Móvil publicToken is required');
        this.baseUrl = opts.baseUrl ?? ATH_BASE_URL;
        this.webhookSubscribeUrl = opts.webhookSubscribeUrl ?? ATH_WEBHOOK_SUBSCRIBE_URL;
        this.fetchImpl = opts.fetch ?? ((i, init) => fetch(i, init));
    }
    async call(path, { method = 'POST', body, bearer } = {}) {
        const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
        if (bearer)
            headers.Authorization = `Bearer ${bearer}`;
        const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
            method,
            headers,
            body: body === undefined ? '' : JSON.stringify(body),
        });
        let json = null;
        try {
            json = (await res.json());
        }
        catch {
            /* non-JSON error page */
        }
        if (!res.ok || !json || json.status !== 'success') {
            throw new PaymentProviderError(json?.message ?? `ATH Móvil request failed (${res.status})`, 'athmovil', res.status, json?.errorcode, json);
        }
        return json.data;
    }
    /** Step 1: create the payment; ATH Móvil pushes a request to the customer's phone. */
    async createPayment(input) {
        assertCents(input.total, 'total');
        if (input.total < ATH_MIN_CENTS || input.total > ATH_MAX_CENTS) {
            throw new RangeError('ATH Móvil payments must be between $1.00 and $1,500.00');
        }
        const phone = digitsOnly(input.phoneNumber);
        if (phone.length !== 10)
            throw new RangeError('ATH Móvil phone number must have 10 digits');
        const timeout = Math.min(600, Math.max(120, Math.round(input.timeoutSeconds ?? 600)));
        const data = await this.call('/payment', {
            body: {
                env: 'production',
                publicToken: this.creds.publicToken,
                timeout: String(timeout),
                total: centsToDecimalString(input.total),
                subtotal: input.subtotal != null ? centsToDecimalString(input.subtotal) : undefined,
                tax: input.tax != null ? centsToDecimalString(input.tax) : undefined,
                metadata1: clip40(input.metadata1),
                metadata2: clip40(input.metadata2),
                items: (input.items ?? []).map((i) => ({
                    name: i.name,
                    description: i.description ?? '',
                    quantity: String(i.quantity),
                    price: centsToDecimalString(i.unitAmount),
                    tax: i.tax != null ? centsToDecimalString(i.tax) : null,
                    metadata: i.metadata ?? null,
                })),
                phoneNumber: phone,
            },
        });
        return { ecommerceId: data.ecommerceId, authToken: data.auth_token };
    }
    /** Current state of a payment. Use this to verify every webhook. */
    async findPayment(ecommerceId, authToken) {
        return this.call('/business/findPayment', {
            body: { ecommerceId, publicToken: this.creds.publicToken },
            bearer: authToken,
        });
    }
    /** Step 3: finalize a CONFIRM payment (debits the customer). Must happen before it expires. */
    async authorize(authToken) {
        return this.call('/authorization', { bearer: authToken });
    }
    /** Send the push to a different phone number (e.g. staff typed it wrong). */
    async updatePhoneNumber(ecommerceId, phoneNumber, authToken) {
        const phone = digitsOnly(phoneNumber);
        if (phone.length !== 10)
            throw new RangeError('ATH Móvil phone number must have 10 digits');
        await this.call('/business/updatePhoneNumber', { method: 'PUT', body: { ecommerceId, phoneNumber: phone }, bearer: authToken });
    }
    async cancel(ecommerceId) {
        await this.call('/business/cancel', { body: { ecommerceId, publicToken: this.creds.publicToken } });
    }
    /** Refund a COMPLETED payment (full or partial). Requires the private token. */
    async refund(referenceNumber, amountCents, message) {
        if (!this.creds.privateToken)
            throw new Error('ATH Móvil privateToken is required for refunds');
        assertCents(amountCents, 'amount');
        return this.call('/refund', {
            body: {
                publicToken: this.creds.publicToken,
                privateToken: this.creds.privateToken,
                referenceNumber,
                amount: centsToDecimalString(amountCents),
                ...(message ? { message: message.slice(0, 50) } : {}),
            },
        });
    }
    /**
     * Subscribe a listener URL to ATH Móvil Business events (done once per business).
     * Note: notifications are unsigned; put a hard-to-guess secret in the URL and still verify
     * each event with findPayment().
     */
    async subscribeWebhooks(listenerURL, events = {}) {
        if (!this.creds.privateToken)
            throw new Error('ATH Móvil privateToken is required to subscribe webhooks');
        const res = await this.fetchImpl(this.webhookSubscribeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                publicToken: this.creds.publicToken,
                privateToken: this.creds.privateToken,
                listenerURL,
                paymentReceivedEvent: events.paymentReceivedEvent ?? false,
                refundSentEvent: events.refundSentEvent ?? true,
                donationReceivedEvent: events.donationReceivedEvent ?? false,
                ecommercePaymentReceivedEvent: events.ecommercePaymentReceivedEvent ?? true,
                ecommercePaymentCancelledEvent: events.ecommercePaymentCancelledEvent ?? true,
                ecommercePaymentExpiredEvent: events.ecommercePaymentExpiredEvent ?? true,
            }),
        });
        if (!res.ok) {
            throw new PaymentProviderError(`ATH Móvil webhook subscription failed (${res.status})`, 'athmovil', res.status);
        }
    }
}
/** Turn findPayment()/authorize() details into the shared result shape. */
export function athDetailsToResult(d) {
    const total = decimalToCents(d.total ?? 0);
    const refunded = decimalToCents(d.totalRefundedAmount ?? 0);
    return {
        provider: 'athmovil',
        providerPaymentId: d.ecommerceId,
        status: mapAthStatus(d.ecommerceStatus, refunded, total),
        receiptReference: d.referenceNumber || undefined,
        amountPaid: d.ecommerceStatus === 'COMPLETED' ? total : undefined,
        fee: d.fee != null ? decimalToCents(d.fee) : undefined,
        raw: d,
    };
}
/**
 * Normalize an ATH Móvil webhook body. The documented payloads are inconsistent
 * (e.g. "ECOMMERCE"/"ecommerce", "COMPLETED"/"completed", "CANCEL"/"expired").
 * The result is UNTRUSTED: confirm with findPayment(ecommerceId) before acting on it.
 */
export function parseAthWebhook(body) {
    const b = (body ?? {});
    const type = String(b.transactionType ?? '').toLowerCase();
    const kind = ['ecommerce', 'payment', 'refund', 'donation', 'simulated'].includes(type)
        ? type
        : 'unknown';
    const statusRaw = String(b.status ?? '');
    const total = b.total != null && b.total !== '' ? decimalToCents(b.total) : undefined;
    return {
        kind,
        ecommerceId: typeof b.ecommerceId === 'string' && b.ecommerceId ? b.ecommerceId : undefined,
        referenceNumber: typeof b.referenceNumber === 'string' && b.referenceNumber ? b.referenceNumber : undefined,
        status: kind === 'refund' ? 'refunded' : mapAthStatus(statusRaw),
        totalCents: total,
        metadata1: typeof b.metadata1 === 'string' ? b.metadata1 : undefined,
        metadata2: typeof b.metadata2 === 'string' ? b.metadata2 : undefined,
    };
}
