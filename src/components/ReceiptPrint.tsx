/** Renders receipt content for printing (80mm thermal). Use in a window opened for print. */
import type { Transaction, TransactionLineItem } from '@/types/transactions';
import { normalizeTaxLabelForDisplay } from '@/lib/taxLabels';

function fromCents(c: number): number {
  return c / 100;
}

/** Format transaction timestamp without seconds (hours:minutes). */
function formatReceiptDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
}

interface ReceiptPrintProps {
  businessName: string;
  headerText?: string | null;
  footerText?: string | null;
  /** Phone number on receipt (e.g. from business/receipt settings). Default demo: (787) 555-5555 */
  receiptPhone?: string | null;
  /** Location/address on receipt. Default demo: Trujillo Alto, Puerto Rico */
  receiptLocation?: string | null;
  transaction: Transaction;
  lineItems: TransactionLineItem[];
  displayId: string;
}

const DEFAULT_RECEIPT_PHONE = '(787) 555-5555';
const DEFAULT_RECEIPT_LOCATION = 'Trujillo Alto, Puerto Rico';

export function ReceiptPrint({ businessName, headerText, footerText, receiptPhone, receiptLocation, transaction, lineItems, displayId }: ReceiptPrintProps) {
  const phone = receiptPhone ?? DEFAULT_RECEIPT_PHONE;
  const location = receiptLocation ?? DEFAULT_RECEIPT_LOCATION;
  return (
    <div className="receipt" style={{ width: '80mm', maxWidth: '80mm', margin: '0 auto', padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
      <div className="receipt-header" style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{businessName}</div>
        {headerText && <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{headerText}</div>}
        <div style={{ marginTop: '4px', fontSize: '11px' }}>{phone}</div>
        <div style={{ marginTop: '2px', fontSize: '11px' }}>{location}</div>
      </div>
      <div style={{ marginBottom: '8px' }}>
        <div>{displayId}</div>
        <div>{formatReceiptDate(transaction.created_at)}</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
        <tbody>
          {lineItems.map((li) => (
            <tr key={li.id}>
              <td style={{ padding: '2px 0' }}>{li.name} x{li.quantity}</td>
              <td style={{ textAlign: 'right' }}>${fromCents(li.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: '1px dashed #000', paddingTop: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal</span>
          <span>${fromCents(transaction.subtotal).toFixed(2)}</span>
        </div>
        {transaction.discount_amount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Discount</span>
            <span>-${fromCents(transaction.discount_amount).toFixed(2)}</span>
          </div>
        )}
        {transaction.tax_snapshot?.map((tax) => (
          <div key={tax.label} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <span>{normalizeTaxLabelForDisplay(tax.label)}</span>
            <span>${fromCents(tax.amount).toFixed(2)}</span>
          </div>
        ))}
        {transaction.tip_amount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tip</span>
            <span>${fromCents(transaction.tip_amount).toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '4px' }}>
          <span>TOTAL</span>
          <span>${fromCents(transaction.total).toFixed(2)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: '10px', borderTop: '1px dashed #000', paddingTop: '8px', whiteSpace: 'pre-wrap' }}>
        {footerText || 'Thank you for your business.'}
      </div>
    </div>
  );
}

/** Build receipt body HTML with all user content escaped to prevent XSS. */
function buildReceiptBodyHtml(props: ReceiptPrintProps): string {
  const c = props.transaction;
  const phone = props.receiptPhone ?? DEFAULT_RECEIPT_PHONE;
  const location = props.receiptLocation ?? DEFAULT_RECEIPT_LOCATION;
  return `<div style="width:80mm;margin:0 auto;padding:8px;font-family:monospace;font-size:12px">
  <div style="text-align:center;margin-bottom:8px;border-bottom:1px dashed #000;padding-bottom:8px">
    <div style="font-weight:bold;font-size:14px">${escapeHtml(props.businessName)}</div>
    ${props.headerText ? `<div style="margin-top:4px;white-space:pre-wrap">${escapeHtml(props.headerText)}</div>` : ''}
    <div style="margin-top:4px;font-size:11px">${escapeHtml(phone)}</div>
    <div style="margin-top:2px;font-size:11px">${escapeHtml(location)}</div>
  </div>
  <div style="margin-bottom:8px">
    <div>${escapeHtml(props.displayId)}</div>
    <div>${escapeHtml(formatReceiptDate(c.created_at))}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px"><tbody>
    ${props.lineItems.map((li) => `<tr><td style="padding:2px 0">${escapeHtml(li.name)} x${li.quantity}</td><td style="text-align:right">$${fromCents(li.line_total).toFixed(2)}</td></tr>`).join('')}
  </tbody></table>
  <div style="border-top:1px dashed #000;padding-top:8px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>$${fromCents(c.subtotal).toFixed(2)}</span></div>
    ${c.discount_amount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-$${fromCents(c.discount_amount).toFixed(2)}</span></div>` : ''}
    ${(c.tax_snapshot || []).map((t) => `<div style="display:flex;justify-content:space-between;margin-top:2px"><span>${escapeHtml(normalizeTaxLabelForDisplay(t.label))}</span><span>$${fromCents(t.amount).toFixed(2)}</span></div>`).join('')}
    ${c.tip_amount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Tip</span><span>$${fromCents(c.tip_amount).toFixed(2)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:4px"><span>TOTAL</span><span>$${fromCents(c.total).toFixed(2)}</span></div>
  </div>
  <div style="text-align:center;font-size:10px;border-top:1px dashed #000;padding-top:8px;white-space:pre-wrap">${escapeHtml(props.footerText || 'Thank you for your business.')}</div>
</div>`;
}

/** Open a new window and print the receipt. Uses Blob URL so the window loads and is not blocked. */
export function printReceipt(props: ReceiptPrintProps) {
  const bodyHtml = buildReceiptBodyHtml(props);
  const title = escapeHtml(props.displayId);
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${title}</title>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; padding: 0; min-height: 100%; min-width: 100%; box-sizing: border-box; }
    body { padding: 16px; font-family: monospace; font-size: 14px; }
    #receipt-content { width: 80mm; max-width: 80mm; margin: 0 auto; min-height: 400px; }
    @media print { body { width: 80mm; margin: 0; padding: 8px; } #receipt-content { min-height: auto; } }
  </style>
</head>
<body>
  <div id="receipt-content">${bodyHtml}</div>
</body>
</html>`;
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank', 'width=1000,height=900,scrollbars=yes,resizable=yes');
  if (win) {
    win.addEventListener('load', () => {
      URL.revokeObjectURL(blobUrl);
      win.focus();
      setTimeout(() => { win.print(); win.close(); }, 300);
    });
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } else {
    URL.revokeObjectURL(blobUrl);
    if (typeof window !== 'undefined' && window.alert) {
      window.alert('Popup blocked. Please allow popups for this site to print receipts.');
    }
  }
}

/** Open receipt in a new window for viewing (no print dialog). */
export function viewReceipt(props: ReceiptPrintProps) {
  const bodyHtml = buildReceiptBodyHtml(props);
  const title = escapeHtml(props.displayId);
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${title}</title>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; padding: 0; min-height: 100%; min-width: 100%; box-sizing: border-box; }
    body { padding: 16px; font-family: monospace; font-size: 14px; }
    #receipt-content { width: 80mm; max-width: 80mm; margin: 0 auto; min-height: 400px; }
    @media print { body { width: 80mm; margin: 0; padding: 8px; } #receipt-content { min-height: auto; } }
  </style>
</head>
<body>
  <div id="receipt-content">${bodyHtml}</div>
</body>
</html>`;
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank', 'width=1000,height=900,scrollbars=yes,resizable=yes');
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
