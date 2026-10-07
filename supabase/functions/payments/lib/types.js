/**
 * Provider-neutral types shared by every Stratum app (pet-hub/Grumi first).
 * Amounts are always integer cents in USD; providers convert at the edge.
 */
export class PaymentProviderError extends Error {
    provider;
    status;
    code;
    details;
    constructor(message, provider, status, code, details) {
        super(message);
        this.provider = provider;
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'PaymentProviderError';
    }
}
