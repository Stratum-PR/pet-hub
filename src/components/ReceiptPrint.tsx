/** Renders receipt content for printing (80mm thermal). Use in a window opened for print. */
import type { Transaction, TransactionLineItem } from '@/types/transactions';

function fromCents(c: number): number {
  return c / 100;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

interface ReceiptPrintProps {
  businessName: string;
  headerText?: string | null;
  footerText?: string | null;
  transaction: Transaction;
  lineItems: TransactionLineItem[];
  displayId: string;
}

export function ReceiptPrint({ businessName, headerText, footerText, transaction, lineItems, displayId }: ReceiptPrintProps) {
  return (
    <div className="receipt" style={{ width: '80mm', maxWidth: '80mm', margin: '0 auto', padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
      <div className="receipt-header" style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{businessName}</div>
        {headerText && <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{headerText}</div>}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <div>{displayId}</div>
        <div>{formatDate(transaction.created_at)}</div>
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
            <span>{tax.label}</span>
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

/** Open a new window and print the receipt. */
export function printReceipt(props: ReceiptPrintProps) {
  const win = window.open('', '_blank', 'width=1000,height=900,scrollbars=yes,resizable=yes');
  if (!win) return;
  win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${props.displayId}</title>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; padding: 0; min-height: 100%; min-width: 100%; box-sizing: border-box; }
    body { padding: 16px; font-family: monospace; font-size: 14px; }
    #receipt-content { width: 80mm; max-width: 80mm; margin: 0 auto; min-height: 400px; }
    @media print { body { width: 80mm; margin: 0; padding: 8px; } #receipt-content { min-height: auto; } }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.onload = function() {
      window.focus();
      setTimeout(function() { window.print(); window.close(); }, 250);
    };
  </script>
</body>
</html>
  `);
  const root = win.document.getElementById('root');
  if (root) {
    const div = win.document.createElement('div');
    div.id = 'receipt-content';
    div.innerHTML = `
    <div style="width:80mm;margin:0 auto;padding:8px;font-family:monospace;font-size:12px">
      <div style="text-align:center;margin-bottom:8px;border-bottom:1px dashed #000;padding-bottom:8px">
        <div style="font-weight:bold;font-size:14px">${escapeHtml(props.businessName)}</div>
        ${props.headerText ? `<div style="margin-top:4px;white-space:pre-wrap">${escapeHtml(props.headerText)}</div>` : ''}
      </div>
      <div style="margin-bottom:8px">
        <div>${escapeHtml(props.displayId)}</div>
        <div>${escapeHtml(formatDate(props.transaction.created_at))}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
        <tbody>
          ${props.lineItems.map((li) => `
            <tr><td style="padding:2px 0">${escapeHtml(li.name)} x${li.quantity}</td><td style="text-align:right">$${fromCents(li.line_total).toFixed(2)}</td></tr>
          `).join('')}
        </tbody>
      </table>
      <div style="border-top:1px dashed #000;padding-top:8px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>$${fromCents(props.transaction.subtotal).toFixed(2)}</span></div>
        ${props.transaction.discount_amount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-$${fromCents(props.transaction.discount_amount).toFixed(2)}</span></div>` : ''}
        ${(props.transaction.tax_snapshot || []).map((t) => `<div style="display:flex;justify-content:space-between;margin-top:2px"><span>${escapeHtml(t.label)}</span><span>$${fromCents(t.amount).toFixed(2)}</span></div>`).join('')}
        ${props.transaction.tip_amount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Tip</span><span>$${fromCents(props.transaction.tip_amount).toFixed(2)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:4px"><span>TOTAL</span><span>$${fromCents(props.transaction.total).toFixed(2)}</span></div>
      </div>
      <div style="text-align:center;font-size:10px;border-top:1px dashed #000;padding-top:8px;white-space:pre-wrap">${escapeHtml(props.footerText || 'Thank you for your business.')}</div>
    </div>
  `;
    root.appendChild(div);
  }
  win.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
