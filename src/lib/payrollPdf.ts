import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInMinutes } from 'date-fns';
import type { Employee, TimeEntry } from '@/types';
import { DEFAULT_PRIMARY_COLOR_HSL } from '@/lib/defaultThemeColors';

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

const roundToQuarterHours = (hours: number) => Math.round(hours * 4) / 4;

export async function downloadEmployeeTimesheetPdf(opts: {
  businessName: string;
  primaryHsl: string;
  payrollPdfIncludeLogo: boolean;
  logoSource: string | null | undefined;
  employee: Employee;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  entries: TimeEntry[];
  taxDisclaimer: string;
}): Promise<void> {
  const {
    businessName,
    primaryHsl,
    payrollPdfIncludeLogo,
    logoSource,
    employee,
    payPeriodStart,
    payPeriodEnd,
    entries,
    taxDisclaimer,
  } = opts;

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
  const headline = `${businessName} — ${format(payPeriodStart, 'MMM d')}–${format(payPeriodEnd, 'MMM d, yyyy')}`;
  const headlineMaxW = pageWidth - titleLeft - margin;
  const headlineLines = doc.splitTextToSize(headline, Math.max(40, headlineMaxW));
  let lineY = margin + 6;
  headlineLines.forEach((line: string) => {
    doc.text(line, titleLeft, lineY);
    lineY += 7;
  });
  headerBottom = Math.max(headerBottom, lineY - 2);
  yPos = headerBottom + 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(employee.name, margin, yPos);
  yPos += 6;
  doc.text(
    `Hourly rate: $${Number(employee.hourly_rate).toFixed(2)}/hr`,
    margin,
    yPos
  );
  yPos += 6;
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, margin, yPos);
  yPos += 12;

  const sorted = [...entries].filter((e) => e.clock_out).sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());

  const bodyRows = sorted.map((entry) => {
    const mins = differenceInMinutes(new Date(entry.clock_out!), new Date(entry.clock_in));
    const hrs = roundToQuarterHours(mins / 60);
    const pay = hrs * employee.hourly_rate;
    return [
      format(new Date(entry.clock_in), 'MM/dd/yyyy'),
      format(new Date(entry.clock_in), 'h:mm a'),
      format(new Date(entry.clock_out!), 'h:mm a'),
      hrs.toFixed(2),
      `$${pay.toFixed(2)}`,
    ];
  });

  const totalHours = sorted.reduce((sum, e) => {
    const mins = differenceInMinutes(new Date(e.clock_out!), new Date(e.clock_in));
    return sum + roundToQuarterHours(mins / 60);
  }, 0);
  const grossPay = totalHours * employee.hourly_rate;

  bodyRows.push(['Total', '', '', totalHours.toFixed(2), `$${grossPay.toFixed(2)}`]);

  autoTable(doc, {
    head: [['Date', 'Clock in', 'Clock out', 'Hours', 'Pay']],
    body: bodyRows,
    startY: yPos,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    didParseCell: (data) => {
      const first = data.row.raw[0];
      if (first === 'Total') {
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

  const fileName = `timesheet-${format(payPeriodStart, 'yyyy-MM-dd')}-to-${format(payPeriodEnd, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
