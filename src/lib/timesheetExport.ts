import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import type { Employee, TimeEntry } from '@/types';

export function formatClockInsForExport(entries: TimeEntry[]): string {
  const lines = entries.filter((e) => e.clock_out).map((e) => format(new Date(e.clock_in), 'h:mm a'));
  return lines.length ? lines.join('\n') : '—';
}

export function formatClockOutsForExport(entries: TimeEntry[]): string {
  const lines = entries.filter((e) => e.clock_out).map((e) => format(new Date(e.clock_out!), 'h:mm a'));
  return lines.length ? lines.join('\n') : '—';
}

function escapeCsvField(val: string): string {
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

export function triggerDownloadText(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Standard summary: field label in col A, value in col B */
export function buildStandardSummaryRows(opts: {
  labels: {
    field: string;
    value: string;
    employee: string;
    payPeriod: string;
    hourlyRate: string;
    totalHours: string;
    grossPay: string;
  };
  employee: Employee;
  payPeriodLabel: string;
  totalHours: number;
  grossPay: number;
}): { head: string[]; rows: string[][] } {
  const { labels, employee, payPeriodLabel, totalHours, grossPay } = opts;
  return {
    head: [labels.field, labels.value],
    rows: [
      [labels.employee, employee.name],
      [labels.payPeriod, payPeriodLabel],
      [labels.hourlyRate, `$${Number(employee.hourly_rate).toFixed(2)}/hr`],
      [labels.totalHours, `${totalHours.toFixed(1)}h`],
      [labels.grossPay, `$${grossPay.toFixed(2)}`],
    ],
  };
}

/** Daily breakdown rows matching the on-screen timesheet table */
export function buildStandardDetailRows(opts: {
  labels: {
    dateDay: string;
    clockIn: string;
    clockOut: string;
    hoursWorked: string;
    pay: string;
    totalLabel: string;
  };
  dailyData: Array<{
    date: Date;
    entries: TimeEntry[];
    hours: number;
    pay: number;
  }>;
  totalHours: number;
  grossPay: number;
}): { head: string[]; rows: string[][] } {
  const { labels, dailyData, totalHours, grossPay } = opts;
  const head = [labels.dateDay, labels.clockIn, labels.clockOut, labels.hoursWorked, labels.pay];
  const rows = dailyData.map((day) => [
    format(day.date, 'EEE MMM d'),
    formatClockInsForExport(day.entries),
    formatClockOutsForExport(day.entries),
    day.hours > 0 ? `${day.hours.toFixed(1)}h` : '—',
    day.pay > 0 ? `$${day.pay.toFixed(2)}` : '—',
  ]);
  rows.push([labels.totalLabel, '', '', `${totalHours.toFixed(1)}h`, `$${grossPay.toFixed(2)}`]);
  return { head, rows };
}

export function downloadStandardTimesheetCsv(opts: {
  summarySectionTitle: string;
  detailsSectionTitle: string;
  summary: { head: string[]; rows: string[][] };
  detail: { head: string[]; rows: string[][] };
  fileName: string;
}): void {
  const { summarySectionTitle, detailsSectionTitle, summary, detail, fileName } = opts;
  const summaryBlock = [
    [summarySectionTitle],
    summary.head,
    ...summary.rows,
    [],
    [detailsSectionTitle],
    detail.head,
    ...detail.rows,
  ];
  const csv = `\uFEFF${rowsToCsv(summaryBlock)}`;
  triggerDownloadText(csv, fileName, 'text/csv;charset=utf-8');
}

export function downloadTwoSheetXlsx(opts: {
  sheetNames: { summary: string; detail: string };
  summary: { head: string[]; rows: string[][] };
  detail: { head: string[]; rows: string[][] };
  fileName: string;
}): void {
  const { sheetNames, summary, detail, fileName } = opts;
  const wb = XLSX.utils.book_new();
  const summaryAoA = [summary.head, ...summary.rows];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryAoA);
  XLSX.utils.book_append_sheet(wb, ws1, sheetNames.summary.slice(0, 31));
  const detailAoA = [detail.head, ...detail.rows];
  const ws2 = XLSX.utils.aoa_to_sheet(detailAoA);
  XLSX.utils.book_append_sheet(wb, ws2, sheetNames.detail.slice(0, 31));
  XLSX.writeFile(wb, fileName);
}

export function timesheetExportBaseName(payPeriodStart: Date, payPeriodEnd: Date): string {
  return `timesheet-${format(payPeriodStart, 'yyyy-MM-dd')}-to-${format(payPeriodEnd, 'yyyy-MM-dd')}`;
}
