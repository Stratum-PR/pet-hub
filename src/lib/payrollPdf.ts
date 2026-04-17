import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { DEFAULT_PRIMARY_COLOR_HSL } from '@/lib/defaultThemeColors';

/** Opened synchronously in a click handler; PDF is assigned after async generate (see assignBlobUrlToPreviewTab). */
export function openPdfPreviewTab(): Window | null {
  return window.open('about:blank', '_blank');
}

export function assignBlobUrlToPreviewTab(preview: Window | null, objectUrl: string): boolean {
  if (preview && !preview.closed) {
    try {
      preview.location.href = objectUrl;
      try {
        preview.opener = null;
      } catch {
        /* ignore */
      }
      return true;
    } catch {
      try {
        preview.close();
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

/** Does not navigate the current tab (unlike an anchor `download` on blob PDFs, which can replace the opener). */
export function openObjectUrlInNewTabViaAnchor(objectUrl: string): void {
  const a = document.createElement('a');
  a.href = objectUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type PayrollPdfImage = { dataUrl: string; format: 'PNG' | 'JPEG' | 'WEBP' | 'GIF' };

/** Load a raster image for jsPDF. SVG is skipped (not supported by addImage). */
export async function loadImageDataForPayrollPdf(logoUrl: string): Promise<PayrollPdfImage | null> {
  const pathLower = logoUrl.split('?')[0].toLowerCase();
  if (pathLower.endsWith('.svg')) return null;
  try {
    const resolved =
      logoUrl.startsWith('http') || logoUrl.startsWith('data:')
        ? logoUrl
        : `${typeof window !== 'undefined' ? window.location.origin : ''}${
            logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`
          }`;
    const res = await fetch(resolved);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type || '';
    if (mime.includes('svg')) return null;
    let formatImg: PayrollPdfImage['format'] = 'PNG';
    if (mime.includes('jpeg') || mime.includes('jpg')) formatImg = 'JPEG';
    else if (mime.includes('webp')) formatImg = 'WEBP';
    else if (mime.includes('gif')) formatImg = 'GIF';
    else if (mime.includes('png')) formatImg = 'PNG';
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(new Error('read'));
      fr.readAsDataURL(blob);
    });
    return { dataUrl, format: formatImg };
  } catch {
    return null;
  }
}

/** HSL theme string → RGB 0–255 for jsPDF header fill. */
export function hslStringToRgbForPdf(hsl: string): [number, number, number] {
  try {
    let match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    if (!match) {
      match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    }
    if (!match) return [0, 0, 0];

    const h = parseInt(match[1], 10) / 360;
    const s = parseInt(match[2], 10) / 100;
    const l = parseInt(match[3], 10) / 100;

    let r: number;
    let g: number;
    let b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  } catch {
    return [0, 0, 0];
  }
}

export async function downloadEmployeeTimesheetPdf(opts: {
  businessName: string;
  primaryHsl: string;
  payrollPdfIncludeLogo: boolean;
  logoSource: string | null | undefined;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  taxDisclaimer: string;
  summaryTable: { head: string[]; body: string[][] };
  detailTable: { head: string[]; body: string[][] };
  summaryTitle: string;
  detailTitle: string;
}): Promise<void> {
  const {
    businessName,
    primaryHsl,
    payrollPdfIncludeLogo,
    logoSource,
    payPeriodStart,
    payPeriodEnd,
    taxDisclaimer,
    summaryTable,
    detailTable,
    summaryTitle,
    detailTitle,
  } = opts;

  const previewTab = openPdfPreviewTab();

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPos = margin;
  const primaryColor = hslStringToRgbForPdf(primaryHsl || DEFAULT_PRIMARY_COLOR_HSL);

  const wantLogo = payrollPdfIncludeLogo && !!logoSource;
  let titleLeft = margin;
  let headerBottom = margin;

  if (wantLogo && logoSource) {
    const loaded = await loadImageDataForPayrollPdf(logoSource);
    if (loaded) {
      try {
        const props = doc.getImageProperties(loaded.dataUrl);
        const ratio = props.width / props.height;
        const logoMaxH = 14;
        const logoMaxW = 42;
        let drawH = logoMaxH;
        let drawW = ratio * drawH;
        if (drawW > logoMaxW) {
          drawW = logoMaxW;
          drawH = drawW / ratio;
        }
        doc.addImage(loaded.dataUrl, loaded.format, margin, margin, drawW, drawH);
        titleLeft = margin + drawW + 4;
        headerBottom = Math.max(headerBottom, margin + drawH);
      } catch {
        /* ignore */
      }
    }
  }

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const headline = `${businessName}: ${format(payPeriodStart, 'MMM d')}–${format(payPeriodEnd, 'MMM d, yyyy')}`;
  const headlineMaxW = pageWidth - titleLeft - margin;
  const headlineLines = doc.splitTextToSize(headline, Math.max(40, headlineMaxW));
  let lineY = margin + 6;
  headlineLines.forEach((line: string) => {
    doc.text(line, titleLeft, lineY);
    lineY += 7;
  });
  headerBottom = Math.max(headerBottom, lineY - 2);
  yPos = headerBottom + 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(72, 72, 72);
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, margin, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 12;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(summaryTitle, margin, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    head: [summaryTable.head],
    body: summaryTable.body,
    startY: yPos,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 52 },
    },
  });

  yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(detailTitle, margin, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'normal');

  const detailLast = detailTable.body.length - 1;

  autoTable(doc, {
    head: [detailTable.head],
    body: detailTable.body,
    startY: yPos,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { halign: 'left' },
      2: { halign: 'left' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === detailLast) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });

  yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  const noteLines = doc.splitTextToSize(taxDisclaimer, pageWidth - margin * 2);
  doc.text(noteLines, margin, yPos);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  if (!assignBlobUrlToPreviewTab(previewTab, url)) {
    openObjectUrlInNewTabViaAnchor(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
