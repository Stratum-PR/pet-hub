/** Invoice print for 8.5" x 11" letter. Opens print window with styled invoice. */
import type { Transaction, TransactionLineItem } from '@/types/transactions';
import { normalizeTaxLabelForDisplay } from '@/lib/taxLabels';

function fromCents(c: number): number {
  return c / 100;
}

function formatInvoiceDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export interface InvoicePrintProps {
  businessName: string;
  businessPhone?: string | null;
  businessAddress?: string | null;
  /** Logo URL for invoice header (absolute URL for print). Demo: Pet Hub icon at /pet-hub-icon.svg */
  logoUrl?: string | null;
  transaction: Transaction;
  lineItems: TransactionLineItem[];
  displayId: string;
  customerName: string;
}

const DEFAULT_PHONE = '(787) 555-5555';
const DEFAULT_ADDRESS = 'Trujillo Alto, Puerto Rico';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Stripe wordmark for print (same as business settings). */
const STRIPE_LOGO_HTML = '<span style="color:#635bff;font-weight:600;font-size:0.9rem;font-family:system-ui,sans-serif">Stripe</span>';

/** ATH Móvil logo for print (white background version for invoice). */
const ATH_LOGO_IMG = '<img src="https://ath.business/images/marketing/logos-section/ath-movil-bg-white.png" alt="ATH Móvil" class="payment-ath-img" />';

/** PayPal wordmark for print (same as business settings). */
const PAYPAL_LOGO_HTML = '<span style="color:#003087;font-weight:600;font-size:0.9rem;font-family:system-ui,sans-serif">PayPal</span>';

/** VISA wordmark-style placeholder (simple text badge for print). */
const VISA_LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 18" width="50" height="18"><rect width="50" height="18" rx="2" fill="#1A1F71"/><text x="25" y="13" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#fff">VISA</text></svg>';

function buildInvoiceHtml(props: InvoicePrintProps, resolvedLogoUrl: string, baseUrl: string): string {
  const { businessName, transaction, lineItems, displayId, customerName } = props;
  const phone = props.businessPhone ?? DEFAULT_PHONE;
  const address = props.businessAddress ?? DEFAULT_ADDRESS;
  const c = transaction;
  const stratumLogoUrl = baseUrl ? `${baseUrl}/Logo 4.svg` : '';

  const rows = lineItems
    .map(
      (li) =>
        `<tr>
          <td class="item-desc">${escapeHtml(li.name)}</td>
          <td class="item-qty">${li.quantity}</td>
          <td class="item-price">$${fromCents(li.unit_price).toFixed(2)}</td>
          <td class="item-total">$${fromCents(li.line_total).toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const logoImg = resolvedLogoUrl
    ? `<img src="${escapeHtml(resolvedLogoUrl)}" alt="" class="invoice-logo" />`
    : '';

  return `
  <div class="invoice-page">
    <header class="invoice-header">
      <div class="business-block">
        <div class="business-brand">
          ${logoImg}
          <h1 class="business-name">${escapeHtml(businessName)}</h1>
        </div>
        <p class="business-contact">${escapeHtml(phone)}</p>
        <p class="business-contact">${escapeHtml(address)}</p>
      </div>
      <div class="invoice-title-block">
        <h2 class="invoice-title">INVOICE</h2>
        <p class="invoice-meta"><strong>Invoice #</strong> ${escapeHtml(displayId)}</p>
        <p class="invoice-meta"><strong>Date</strong> ${escapeHtml(formatInvoiceDate(c.created_at))}</p>
      </div>
    </header>

    <section class="bill-to">
      <h3 class="section-label">Bill to</h3>
      <p class="customer-name">${escapeHtml(customerName)}</p>
    </section>

    <table class="line-items">
      <thead>
        <tr>
          <th class="col-desc">Description</th>
          <th class="col-qty">Qty</th>
          <th class="col-price">Unit Price</th>
          <th class="col-total">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals-block">
      <div class="totals-row"><span>Subtotal</span><span>$${fromCents(c.subtotal).toFixed(2)}</span></div>
      ${c.discount_amount > 0 ? `<div class="totals-row"><span>Discount</span><span>-$${fromCents(c.discount_amount).toFixed(2)}</span></div>` : ''}
      ${(c.tax_snapshot || []).map((t) => `<div class="totals-row"><span>${escapeHtml(normalizeTaxLabelForDisplay(t.label))}</span><span>$${fromCents(t.amount).toFixed(2)}</span></div>`).join('')}
      ${c.tip_amount > 0 ? `<div class="totals-row"><span>Tip</span><span>$${fromCents(c.tip_amount).toFixed(2)}</span></div>` : ''}
      <div class="totals-row total-due"><span>Total</span><span>$${fromCents(c.total).toFixed(2)}</span></div>
    </div>

    ${c.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(c.notes)}</div>` : ''}

    <section class="payment-methods">
      <h3 class="section-label">Payment methods</h3>
      <div class="payment-method-list">
        <span class="payment-pill payment-wordmark">${STRIPE_LOGO_HTML}</span>
        <span class="payment-pill payment-ath">${ATH_LOGO_IMG}</span>
        <span class="payment-pill payment-wordmark">${PAYPAL_LOGO_HTML}</span>
        <span class="payment-pill payment-visa">${VISA_LOGO_SVG}</span>
        <span class="payment-pill">Cash</span>
      </div>
    </section>

    <footer class="invoice-footer">
      <p class="powered-by"><span class="pet-hub-text">Pet Hub</span> powered by <img src="${escapeHtml(stratumLogoUrl)}" alt="Stratum" class="stratum-logo" /></p>
    </footer>
  </div>`;
}

/** Open a new window and print the invoice (8.5" x 11" letter). */
export function printInvoice(props: InvoicePrintProps) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const resolvedLogoUrl = props.logoUrl || (baseUrl ? `${baseUrl}/pet-hub-icon.svg` : '');
  const bodyHtml = buildInvoiceHtml(props, resolvedLogoUrl, baseUrl);
  const title = escapeHtml(props.displayId);
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice ${title}</title>
  <link href="https://fonts.cdnfonts.com/css/telegraf" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #1a1a1a; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 11pt; line-height: 1.4; padding: 0.5in; }
    .invoice-page { max-width: 7.5in; margin: 0 auto; min-height: 10in; display: flex; flex-direction: column; }
    .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 2px solid #1a1a1a; }
    .business-block { }
    .business-brand { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
    .invoice-logo { height: 48px; width: auto; max-width: 140px; object-fit: contain; }
    .business-name { margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; color: #1a1a1a; }
    .business-contact { margin: 0.15rem 0; font-size: 0.95rem; color: #444; }
    .invoice-title-block { text-align: right; }
    .invoice-title { margin: 0 0 0.5rem 0; font-size: 1.75rem; font-weight: 700; letter-spacing: 0.05em; color: #1a1a1a; }
    .invoice-meta { margin: 0.2rem 0; font-size: 0.9rem; color: #444; }
    .bill-to { margin-bottom: 1.5rem; }
    .section-label { margin: 0 0 0.35rem 0; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }
    .customer-name { margin: 0; font-size: 1rem; }
    .line-items { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    .line-items thead { border-bottom: 2px solid #1a1a1a; }
    .line-items th { text-align: left; padding: 0.5rem 0.75rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
    .line-items th.col-qty, .line-items th.col-price, .line-items th.col-total { text-align: right; }
    .line-items td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #e5e5e5; }
    .line-items .item-desc { font-weight: 500; }
    .line-items .item-qty, .line-items .item-price, .line-items .item-total { text-align: right; }
    .line-items tbody tr:hover { background: #fafafa; }
    .totals-block { margin-left: auto; width: 240px; margin-bottom: 2rem; }
    .totals-row { display: flex; justify-content: space-between; padding: 0.35rem 0; font-size: 0.95rem; }
    .totals-row.total-due { margin-top: 0.5rem; padding-top: 0.6rem; border-top: 2px solid #1a1a1a; font-size: 1.15rem; font-weight: 700; }
    .notes { margin-top: 1rem; padding: 0.75rem; background: #f8f8f8; border-radius: 6px; font-size: 0.9rem; color: #444; }
    .payment-methods { margin-top: 1.5rem; margin-bottom: 1rem; }
    .payment-method-list { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.35rem; }
    .payment-pill { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.6rem; background: #f0f0f0; border-radius: 6px; font-size: 0.8rem; color: #444; }
    .payment-pill.payment-logo .payment-icon { height: 20px; width: auto; }
    .payment-pill.payment-logo .payment-label { margin-left: 0.15rem; }
    .payment-pill.payment-ath { background: transparent; border: none; padding: 0.25rem 0.5rem; }
    .payment-pill.payment-ath .payment-ath-img { display: block; height: 18px; width: auto; max-height: 18px; object-fit: contain; border: none; vertical-align: middle; }
    .payment-pill.payment-wordmark { background: transparent; }
    .payment-pill.payment-visa { padding: 0.25rem 0.5rem; background: transparent; }
    .payment-visa svg { display: block; }
    .invoice-footer { margin-top: auto; padding-top: 2rem; text-align: center; }
    .powered-by { margin: 0; font-size: 0.7rem; color: #888; letter-spacing: 0.03em; display: flex; align-items: center; justify-content: center; gap: 0.35rem; flex-wrap: wrap; }
    .powered-by .pet-hub-text { font-family: 'Telegraf', 'PP Telegraf', sans-serif; font-weight: 600; color: #333; }
    .powered-by .stratum-logo { height: 1.25rem; width: auto; max-width: 80px; object-fit: contain; vertical-align: middle; }
    @media print {
      html, body { padding: 0; margin: 0; width: 8.5in; min-height: 11in; height: 11in; }
      body { padding: 0.5in; }
      .invoice-page { min-height: 10in; }
      .line-items tbody tr:hover { background: transparent; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank', 'width=800,height=1000,scrollbars=yes,resizable=yes');
  if (win) {
    win.addEventListener('load', () => {
      URL.revokeObjectURL(blobUrl);
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 400);
    });
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } else {
    URL.revokeObjectURL(blobUrl);
    if (typeof window !== 'undefined' && window.alert) {
      window.alert('Popup blocked. Please allow popups to print the invoice.');
    }
  }
}

/** Open invoice in a new window for viewing (no print dialog). */
export function viewInvoice(props: InvoicePrintProps) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const resolvedLogoUrl = props.logoUrl || (baseUrl ? `${baseUrl}/pet-hub-icon.svg` : '');
  const bodyHtml = buildInvoiceHtml(props, resolvedLogoUrl, baseUrl);
  const title = escapeHtml(props.displayId);
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice ${title}</title>
  <link href="https://fonts.cdnfonts.com/css/telegraf" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #1a1a1a; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 11pt; line-height: 1.4; padding: 0.5in; }
    .invoice-page { max-width: 7.5in; margin: 0 auto; min-height: 10in; display: flex; flex-direction: column; }
    .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 2px solid #1a1a1a; }
    .business-block { }
    .business-brand { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
    .invoice-logo { height: 48px; width: auto; max-width: 140px; object-fit: contain; }
    .business-name { margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; color: #1a1a1a; }
    .business-contact { margin: 0.15rem 0; font-size: 0.95rem; color: #444; }
    .invoice-title-block { text-align: right; }
    .invoice-title { margin: 0 0 0.5rem 0; font-size: 1.75rem; font-weight: 700; letter-spacing: 0.05em; color: #1a1a1a; }
    .invoice-meta { margin: 0.2rem 0; font-size: 0.9rem; color: #444; }
    .bill-to { margin-bottom: 1.5rem; }
    .section-label { margin: 0 0 0.35rem 0; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }
    .customer-name { margin: 0; font-size: 1rem; }
    .line-items { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    .line-items thead { border-bottom: 2px solid #1a1a1a; }
    .line-items th { text-align: left; padding: 0.5rem 0.75rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
    .line-items th.col-qty, .line-items th.col-price, .line-items th.col-total { text-align: right; }
    .line-items td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #e5e5e5; }
    .line-items .item-desc { font-weight: 500; }
    .line-items .item-qty, .line-items .item-price, .line-items .item-total { text-align: right; }
    .line-items tbody tr:hover { background: #fafafa; }
    .totals-block { margin-left: auto; width: 240px; margin-bottom: 2rem; }
    .totals-row { display: flex; justify-content: space-between; padding: 0.35rem 0; font-size: 0.95rem; }
    .totals-row.total-due { margin-top: 0.5rem; padding-top: 0.6rem; border-top: 2px solid #1a1a1a; font-size: 1.15rem; font-weight: 700; }
    .notes { margin-top: 1rem; padding: 0.75rem; background: #f8f8f8; border-radius: 6px; font-size: 0.9rem; color: #444; }
    .payment-methods { margin-top: 1.5rem; margin-bottom: 1rem; }
    .payment-method-list { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.35rem; }
    .payment-pill { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.6rem; background: #f0f0f0; border-radius: 6px; font-size: 0.8rem; color: #444; }
    .payment-pill.payment-logo .payment-icon { height: 20px; width: auto; }
    .payment-pill.payment-logo .payment-label { margin-left: 0.15rem; }
    .payment-pill.payment-ath { background: transparent; border: none; padding: 0.25rem 0.5rem; }
    .payment-pill.payment-ath .payment-ath-img { display: block; height: 18px; width: auto; max-height: 18px; object-fit: contain; border: none; vertical-align: middle; }
    .payment-pill.payment-wordmark { background: transparent; }
    .payment-pill.payment-visa { padding: 0.25rem 0.5rem; background: transparent; }
    .payment-visa svg { display: block; }
    .invoice-footer { margin-top: auto; padding-top: 2rem; text-align: center; }
    .powered-by { margin: 0; font-size: 0.7rem; color: #888; letter-spacing: 0.03em; display: flex; align-items: center; justify-content: center; gap: 0.35rem; flex-wrap: wrap; }
    .powered-by .pet-hub-text { font-family: 'Telegraf', 'PP Telegraf', sans-serif; font-weight: 600; color: #333; }
    .powered-by .stratum-logo { height: 1.25rem; width: auto; max-width: 80px; object-fit: contain; vertical-align: middle; }
    @media print {
      html, body { padding: 0; margin: 0; width: 8.5in; min-height: 11in; height: 11in; }
      body { padding: 0.5in; }
      .invoice-page { min-height: 10in; }
      .line-items tbody tr:hover { background: transparent; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank', 'width=800,height=1000,scrollbars=yes,resizable=yes');
  if (win) {
    win.addEventListener('load', () => {
      URL.revokeObjectURL(blobUrl);
      win.focus();
    });
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } else {
    URL.revokeObjectURL(blobUrl);
  }
}
