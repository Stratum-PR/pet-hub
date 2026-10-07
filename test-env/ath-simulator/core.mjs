// ATH Móvil Payment Button API simulator: runtime-agnostic core.
//
// Used by the local Node server (server.mjs, in-memory store) and by cloud deployments
// (e.g. a Supabase Edge Function with a database-backed store). No timers: expiry and the
// magic auto-approve/decline numbers are applied lazily whenever a payment is read, and
// `sweep()` can be called periodically so expiry webhooks go out without traffic.
//
// Follows https://github.com/evertec/ATHM-Payment-Button-API (v1.2.2) and
// https://github.com/evertec/athmovil-webhooks. Fees are illustrative only.

export const BASE_PATH = '/api/business-transaction/ecommerce';
export const WEBHOOK_SUBSCRIBE_PATH = '/transactions/webhook/post';

export const MAGIC_PHONES = {
  autoApprove: '7870000001',
  overLimit: '7870000002',
  blockedCustomer: '7870000003',
  autoDecline: '7870000004',
};

/**
 * Store contract (all async):
 *   getBusiness(publicToken) → business | null
 *   saveBusiness(business)
 *   getPayment(ecommerceId) → payment | null
 *   findPaymentByToken(authToken) → payment | null
 *   findPaymentByReference(referenceNumber) → payment | null
 *   savePayment(payment)
 *   listPayments({ publicToken? }) → payment[]   (newest first)
 *   listOpenPayments() → payment[]               (status OPEN or CONFIRM)
 *
 * business: { publicToken, privateToken, name, webhook: null | {listenerURL, …flags}, dailyCount }
 * payment: plain JSON (see createPayment below).
 */
export function createMemoryStore(businesses = []) {
  const biz = new Map(businesses.map((b) => [b.publicToken, { webhook: null, dailyCount: 0, ...b }]));
  let payments = new Map();
  return {
    async getBusiness(t) { return biz.get(t) ?? null; },
    async saveBusiness(b) { biz.set(b.publicToken, b); },
    async getPayment(id) { return payments.get(id) ?? null; },
    async findPaymentByToken(t) { return [...payments.values()].find((p) => p.authToken === t) ?? null; },
    async findPaymentByReference(r) { return [...payments.values()].find((p) => p.referenceNumber && p.referenceNumber === r) ?? null; },
    async savePayment(p) { payments.set(p.ecommerceId, p); },
    async listPayments({ publicToken } = {}) {
      return [...payments.values()].filter((p) => !publicToken || p.publicToken === publicToken).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async listOpenPayments() { return [...payments.values()].filter((p) => p.status === 'OPEN' || p.status === 'CONFIRM'); },
    reset(newBusinesses = businesses) {
      biz.clear();
      for (const b of newBusinesses) biz.set(b.publicToken, { webhook: null, dailyCount: 0, ...b });
      payments = new Map();
    },
  };
}

const money = (n) => Math.round(Number(n) * 100) / 100;

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {object} opts
 * @param {object} opts.store
 * @param {number} [opts.timeScale=1]        60 → a 600 s approval window lasts 10 s
 * @param {number} [opts.autoMs=1500]        delay for the magic auto-approve/decline numbers
 * @param {(url:string, body:object)=>Promise<{ok:boolean,status:number}>} [opts.deliver]  webhook sender
 * @param {()=>number} [opts.now]
 */
export function createSimulator({ store, timeScale = 1, autoMs = 1500, feePct = 0.025, feeFixed = 0.1, deliver, now = () => Date.now() } = {}) {
  const webhookLog = [];
  const stamp = (ms = now()) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
  const send = deliver ?? (async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status };
  });

  const ok = (data, status = 200) => ({ status, body: { status: 'success', data } });
  const fail = (status, errorcode, message) => ({ status, body: { status: 'error', message, errorcode, data: null } });

  async function postWebhook(business, flag, body) {
    const w = business?.webhook;
    const entry = { at: stamp(), event: flag, publicToken: business?.publicToken, url: w?.listenerURL ?? null, delivered: false, body };
    webhookLog.unshift(entry);
    webhookLog.length = Math.min(webhookLog.length, 100);
    if (!w || !w[flag]) return;
    try {
      const r = await send(w.listenerURL, body);
      entry.delivered = r.ok;
      entry.responseStatus = r.status;
    } catch (e) {
      entry.error = String(e);
    }
  }

  function view(p, business) {
    return {
      ecommerceStatus: p.status,
      ecommerceId: p.ecommerceId,
      referenceNumber: p.referenceNumber ?? '',
      businessCustomerId: p.businessCustomerId,
      transactionDate: p.transactionDate ?? '',
      dailyTransactionId: p.dailyTransactionId ?? '',
      businessName: business?.name ?? '',
      businessPath: (business?.name ?? '').replace(/\s+/g, ''),
      industry: 'PETS',
      subTotal: p.subtotal,
      tax: p.tax,
      total: p.total,
      fee: p.fee ?? 0,
      netAmount: p.netAmount ?? 0,
      totalRefundedAmount: p.totalRefunded,
      metadata1: p.metadata1,
      metadata2: p.metadata2,
      items: p.items,
      isNonProfit: false,
    };
  }

  // The documented payloads differ between event types; reproduce that on purpose.
  function ecommerceWebhook(p, business, status) {
    if (status === 'expired') {
      return {
        transactionType: 'ecommerce', status: 'expired', date: `${stamp()}.0`, referenceNumber: '', dailyTransactionID: '',
        name: '', phoneNumber: '', email: '', message: '', total: p.total.toFixed(2), tax: p.tax.toFixed(2),
        subtotal: p.subtotal.toFixed(2), fee: '0.00', netAmount: '0.00', totalRefundedAmount: '0.00',
        metadata1: p.metadata1, metadata2: p.metadata2, items: p.items,
      };
    }
    return {
      businessName: business?.name ?? '', dailyTransactionId: p.dailyTransactionId ?? '', date: stamp(), ecommerceId: p.ecommerceId,
      email: '', fee: p.fee ?? 0, isNonProfit: false, items: p.items, message: '', metadata1: p.metadata1, metadata2: p.metadata2,
      name: '', netAmount: p.netAmount ?? 0, phoneNumber: 0, referenceNumber: p.referenceNumber ?? '',
      referenceTransactionId: p.businessCustomerId, status, subTotal: p.subtotal, tax: p.tax, total: p.total,
      totalRefundedAmount: p.totalRefunded, transactionDate: p.transactionDate ?? '', transactionType: 'ECOMMERCE',
    };
  }

  async function cancel(p, reason) {
    if (p.status === 'COMPLETED' || p.status === 'CANCEL') return p;
    p.status = 'CANCEL';
    p.cancelReason = reason;
    await store.savePayment(p);
    const business = await store.getBusiness(p.publicToken);
    if (reason === 'expired') await postWebhook(business, 'ecommercePaymentExpiredEvent', ecommerceWebhook(p, business, 'expired'));
    else if (reason === 'customer_declined') await postWebhook(business, 'ecommercePaymentCancelledEvent', ecommerceWebhook(p, business, 'CANCEL'));
    return p;
  }

  /** Apply time-based transitions (expiry, magic numbers) before using a payment. */
  async function settle(p) {
    if (!p) return p;
    const t = now();
    const age = t - Date.parse(p.createdAt);
    if (p.status === 'OPEN' && p.phone === MAGIC_PHONES.autoApprove && age >= autoMs) {
      p.status = 'CONFIRM';
      await store.savePayment(p);
    }
    if (p.status === 'OPEN' && p.phone === MAGIC_PHONES.autoDecline && age >= autoMs) {
      return cancel(p, 'customer_declined');
    }
    if ((p.status === 'OPEN' || p.status === 'CONFIRM') && t >= Date.parse(p.expiresAt)) {
      return cancel(p, 'expired');
    }
    return p;
  }

  const api = {
    async payment(_h, b) {
      if (!b || typeof b !== 'object' || Object.keys(b).length === 0) return fail(400, 'BTRA_0006', 'Required request body is missing');
      const business = await store.getBusiness(b.publicToken);
      if (!business) return fail(401, 'BTRA_0401', 'Invalid authorization token');
      const total = money(b.total);
      if (!Number.isFinite(total) || total <= 0) return fail(400, 'BTRA_0013', 'Amount is Zero');
      if (total < 1) return fail(400, 'BTRA_0001', 'The transfer amount is under Minimum allowed');
      if (total > 1500) return fail(400, 'BTRA_0004', 'Amount is Over the limits');
      for (const k of ['metadata1', 'metadata2']) {
        if (b[k] == null || b[k] === '') return fail(400, 'BTRA_0018', `${k} must not be blank`);
        if (String(b[k]).length > 40) return fail(400, 'BTRA_0038', 'The metadata field exceeds the maximum supported characters (40)');
      }
      const phone = String(b.phoneNumber ?? '').replace(/\D/g, '');
      if (phone.length !== 10) return fail(400, 'BTRA_0006', 'Invalid format');
      if (phone === MAGIC_PHONES.overLimit) return fail(400, 'BTRA_0004', 'Amount is Over the limits');
      if (phone === MAGIC_PHONES.blockedCustomer) return fail(400, 'BTRA_0002', 'Customer status is Pending Regain Access Verification');
      const timeout = Math.min(600, Math.max(120, Number(b.timeout ?? 600) || 600));
      const created = now();
      const p = {
        ecommerceId: crypto.randomUUID(),
        authToken: `sim.${randomHex(24)}`,
        publicToken: business.publicToken,
        phone,
        status: 'OPEN',
        createdAt: new Date(created).toISOString(),
        expiresAt: new Date(created + (timeout * 1000) / timeScale).toISOString(),
        total, subtotal: money(b.subtotal ?? 0), tax: money(b.tax ?? 0), totalRefunded: 0,
        metadata1: String(b.metadata1), metadata2: String(b.metadata2),
        items: (b.items ?? []).map((i) => ({
          name: i.name, description: i.description ?? '', quantity: Number(i.quantity ?? 1), price: money(i.price ?? 0),
          tax: i.tax == null ? null : money(i.tax), metadata: i.metadata ?? null, formattedPrice: '', sku: '',
        })),
        businessCustomerId: randomHex(16),
      };
      await store.savePayment(p);
      return ok({ ecommerceId: p.ecommerceId, auth_token: p.authToken });
    },

    async findPayment(_h, b) {
      const p = await settle(await store.getPayment(b?.ecommerceId));
      if (!p) return fail(400, 'BTRA_0031', 'EcommerceId does not exist');
      if (p.publicToken !== b.publicToken) return fail(400, 'BTRA_0008', 'TransactionId does not belong to the business');
      return ok(view(p, await store.getBusiness(p.publicToken)));
    },

    async authorization(h) {
      const t = h.bearer;
      if (!t) return fail(401, 'token.invalid.header', 'No authorization header present.');
      const p = await settle(await store.findPaymentByToken(t));
      if (!p) return fail(401, 'BTRA_0401', 'Invalid authorization token');
      if (p.status === 'CANCEL') return fail(400, 'BTRA_0039', 'Valid time to execute the transaction has expired');
      if (p.status !== 'CONFIRM') return fail(400, 'BTRA_0032', 'The status of the e-commerce is not confirm');
      const business = await store.getBusiness(p.publicToken);
      business.dailyCount = (business.dailyCount ?? 0) + 1;
      await store.saveBusiness(business);
      p.status = 'COMPLETED';
      p.transactionDate = stamp();
      p.dailyTransactionId = String(business.dailyCount).padStart(4, '0');
      p.referenceNumber = `${Math.floor(Math.random() * 1e9)}-${randomHex(16)}`;
      p.fee = money(p.total * feePct + feeFixed);
      p.netAmount = money(p.total - p.fee);
      await store.savePayment(p);
      await postWebhook(business, 'ecommercePaymentReceivedEvent', ecommerceWebhook(p, business, 'COMPLETED'));
      return ok(view(p, business));
    },

    async updatePhoneNumber(h, b) {
      const p = await settle(await store.getPayment(b?.ecommerceId));
      if (!p) return fail(400, 'BTRA_0031', 'EcommerceId does not exist');
      if (!h.bearer || h.bearer !== p.authToken) return fail(401, 'BTRA_0401', 'Invalid authorization token');
      if (p.status !== 'OPEN') return fail(400, 'BTRA_0035', 'The e-commerce transaction has not the expected status');
      const phone = String(b.phoneNumber ?? '').replace(/\D/g, '');
      if (phone.length !== 10) return fail(400, 'BTRA_0006', 'Invalid format');
      p.phone = phone;
      await store.savePayment(p);
      return ok('Update Phone Number');
    },

    async cancel(_h, b) {
      const p = await settle(await store.getPayment(b?.ecommerceId));
      if (!p) return fail(400, 'BTRA_0031', 'EcommerceId does not exist');
      if (p.publicToken !== b.publicToken) return fail(400, 'BTRA_0008', 'TransactionId does not belong to the business');
      if (p.status === 'COMPLETED') return fail(400, 'BTRA_0035', 'The e-commerce transaction has not the expected status');
      await cancel(p, 'business_canceled');
      return ok('Payment Cancelled.');
    },

    async refund(_h, b) {
      const business = await store.getBusiness(b?.publicToken);
      if (!business || business.privateToken !== b.privateToken) return fail(401, 'BTRA_0401', 'Invalid authorization token');
      const p = await store.findPaymentByReference(b.referenceNumber);
      if (!p) return fail(400, 'BTRA_0053', 'ReferenceNumber not found');
      if (p.publicToken !== business.publicToken) return fail(400, 'BTRA_0043', "The business ins't owner of payment");
      const amount = money(b.amount);
      if (!(amount > 0)) return fail(400, 'BTRA_0028', 'is less than 0.01');
      if (b.message && String(b.message).length > 50) return fail(400, 'BTRA_0040', 'The message can not exceed 50 characters');
      if (money(p.totalRefunded + amount) > p.total) return fail(400, 'BTRA_0030', 'The refund failed with a status error');
      p.totalRefunded = money(p.totalRefunded + amount);
      await store.savePayment(p);
      business.dailyCount = (business.dailyCount ?? 0) + 1;
      await store.saveBusiness(business);
      const refundRef = randomHex(16);
      const refund = {
        transactionType: 'REFUND', status: 'COMPLETED', refundedAmount: amount, date: String(now()),
        referenceNumber: refundRef, dailyTransactionID: String(business.dailyCount).padStart(4, '0'),
        name: 'Cliente Prueba', phoneNumber: p.phone, email: '',
      };
      await postWebhook(business, 'refundSentEvent', {
        transactionType: 'refund', status: 'completed', date: `${stamp()}.0`, referenceNumber: refundRef,
        dailyTransactionID: refund.dailyTransactionID, name: 'Cliente Prueba', phoneNumber: p.phone, email: '', message: b.message ?? '',
        total: amount.toFixed(2), tax: '0.00', subtotal: '0.00', fee: '0.00', netAmount: '0.00',
        totalRefundedAmount: p.totalRefunded.toFixed(2), metadata1: p.metadata1, metadata2: p.metadata2, items: [],
      });
      return ok({ refund, originalTransaction: { ...view(p, business), transactionType: 'PAYMENT', status: 'COMPLETED' } });
    },

    async subscribe(_h, b) {
      const business = await store.getBusiness(b?.publicToken);
      if (!business || business.privateToken !== b.privateToken) return { status: 401, body: { status: 'error', message: 'Invalid credentials' } };
      if (!/^https?:\/\//.test(String(b.listenerURL ?? ''))) return { status: 400, body: { status: 'error', message: 'listenerURL required' } };
      const { privateToken: _drop, publicToken: _p, ...webhook } = b;
      business.webhook = webhook;
      await store.saveBusiness(business);
      return { status: 200, body: { status: 'success', data: 'Webhook subscribed' } };
    },
  };

  const routes = {
    [`POST ${BASE_PATH}/payment`]: api.payment,
    [`POST ${BASE_PATH}/business/findPayment`]: api.findPayment,
    [`POST ${BASE_PATH}/authorization`]: api.authorization,
    [`PUT ${BASE_PATH}/business/updatePhoneNumber`]: api.updatePhoneNumber,
    [`POST ${BASE_PATH}/business/cancel`]: api.cancel,
    [`POST ${BASE_PATH}/refund`]: api.refund,
    [`POST ${WEBHOOK_SUBSCRIBE_PATH}`]: api.subscribe,
  };

  return {
    /** Handle one ATH Móvil API request. `body` is the parsed JSON (or undefined). */
    async handle(method, path, { authorization = '' } = {}, body) {
      const fn = routes[`${method.toUpperCase()} ${path}`];
      if (!fn) return fail(404, 'BTRA_9999', 'Internal Error');
      const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
      try {
        return await fn({ bearer }, body);
      } catch (e) {
        return fail(500, 'BTRA_9999', 'Internal Error');
      }
    },

    // ---- customer-side controls (what the person does in the ATH Móvil app) ----
    async customerAction(ecommerceId, action) {
      const p = await settle(await store.getPayment(ecommerceId));
      if (!p) return { ok: false, error: 'not_found' };
      if (action === 'approve') {
        if (p.status !== 'OPEN') return { ok: false, status: p.status };
        p.status = 'CONFIRM';
        await store.savePayment(p);
        return { ok: true, status: p.status };
      }
      await cancel(p, action === 'decline' ? 'customer_declined' : 'expired');
      return { ok: true, status: p.status };
    },

    async state({ publicToken } = {}) {
      const list = await store.listPayments({ publicToken });
      const out = [];
      for (const p of list) {
        const s = await settle(p);
        out.push({ ...view(s, await store.getBusiness(s.publicToken)), phone: s.phone, expiresAt: s.expiresAt, cancelReason: s.cancelReason, createdAt: s.createdAt });
      }
      return { payments: out, webhooks: webhookLog.filter((w) => !publicToken || w.publicToken === publicToken) };
    },

    /** Expire overdue payments (sends expiry webhooks). Call periodically. */
    async sweep() {
      for (const p of await store.listOpenPayments()) await settle(p);
    },
  };
}
