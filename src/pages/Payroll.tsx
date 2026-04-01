import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { DollarSign, ChevronLeft, ChevronRight, Edit, ChevronsUpDown, Plus, UserRound, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Employee, TimeEntry } from '@/types';
import { format, eachDayOfInterval, differenceInMinutes, startOfDay } from 'date-fns';
import { t } from '@/lib/translations';
import { useSettings } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { supabase } from '@/integrations/supabase/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPayPeriods, getPayPeriodRangeForDate, getPayPeriodStartForDate } from '@/lib/payScheduleUtils';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { DEFAULT_PRIMARY_COLOR_HSL } from '@/lib/defaultThemeColors';
import { loadImageDataForPayrollPdf, hslStringToRgbForPdf } from '@/lib/payrollPdf';
import { staffSummaryFilterStorageKey } from '@/lib/timesheetsStaffSummaryFilterStorage';

interface PayrollProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
  onUpdateTimeEntry: (id: string, entryData: Partial<TimeEntry>) => Promise<TimeEntry | null>;
  onAddTimeEntry: (employeeId: string, clockIn: string, clockOut?: string) => Promise<TimeEntry | null>;
}

export function Payroll({ employees, timeEntries, onUpdateTimeEntry, onAddTimeEntry }: PayrollProps) {
  const navigate = useNavigate();
  const { settings, loading: settingsLoading } = useSettings();
  const { business } = useAuth();
  const businessId = useBusinessId();
  const [businessLogoUrl, setBusinessLogoUrl] = useState<string | null>(null);
  const [currentPayPeriod, setCurrentPayPeriod] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const staffSummaryHydratedRef = useRef(false);
  const [staffFilterOpen, setStaffFilterOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editingDay, setEditingDay] = useState<{ date: Date; entry?: TimeEntry } | null>(null);
  const [editFormData, setEditFormData] = useState({
    clock_in: '',
    clock_out: '',
  });

  const roundToQuarterHours = (hours: number) => Math.round(hours * 4) / 4;

  const openEditForEntry = (entry: TimeEntry) => {
    setSelectedEmployeeId(entry.staff_id);
    const date = startOfDay(new Date(entry.clock_in));
    setEditingDay({ date, entry });
    setEditingEntry(entry);
    setEditFormData({
      clock_in: format(new Date(entry.clock_in), "yyyy-MM-dd'T'HH:mm"),
      clock_out: entry.clock_out ? format(new Date(entry.clock_out), "yyyy-MM-dd'T'HH:mm") : '',
    });
  };

  useEffect(() => {
    staffSummaryHydratedRef.current = false;
    setSelectedEmployeeIds([]);
  }, [businessId]);

  useEffect(() => {
    if (!businessId || employees.length === 0 || staffSummaryHydratedRef.current) return;

    const key = staffSummaryFilterStorageKey(businessId);
    const raw = sessionStorage.getItem(key);

    let next: string[];
    if (raw == null) {
      next = employees.map((e) => e.id);
    } else {
      try {
        const parsed = JSON.parse(raw) as string[];
        if (!Array.isArray(parsed)) {
          next = employees.map((e) => e.id);
        } else if (parsed.length === 0) {
          next = [];
        } else {
          const valid = parsed.filter((id) => employees.some((e) => e.id === id));
          next = valid.length > 0 ? valid : employees.map((e) => e.id);
        }
      } catch {
        next = employees.map((e) => e.id);
      }
    }

    staffSummaryHydratedRef.current = true;
    setSelectedEmployeeIds(next);
  }, [businessId, employees]);

  useEffect(() => {
    if (!businessId || !staffSummaryHydratedRef.current) return;
    sessionStorage.setItem(
      staffSummaryFilterStorageKey(businessId),
      JSON.stringify(selectedEmployeeIds),
    );
  }, [businessId, selectedEmployeeIds]);

  // Fetch business logo
  useEffect(() => {
    if (business?.logo_url) {
      setBusinessLogoUrl(business.logo_url);
    } else if (businessId) {
      // Fallback: fetch from database
      supabase
        .from('businesses')
        .select('logo_url')
        .eq('id', businessId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.logo_url) {
            setBusinessLogoUrl(data.logo_url);
          }
        });
    }
  }, [business, businessId]);

  // Use custom pay schedule only after settings have loaded so saved values are applied.
  const cadenceWeeks = Math.max(1, parseInt(settings.pay_schedule_cadence_weeks || '2', 10) || 2);
  const anchorDateISO = settings.pay_schedule_anchor_date || new Date().toISOString().slice(0, 10);

  const { periodStart: payPeriodStart, periodEnd: payPeriodEnd } = useMemo(() => {
    if (settingsLoading) {
      const d = new Date();
      return getPayPeriodRangeForDate(d, { anchorDateISO: d.toISOString().slice(0, 10), cadenceWeeks: 2 });
    }
    return getPayPeriodRangeForDate(currentPayPeriod, { anchorDateISO, cadenceWeeks });
  }, [currentPayPeriod, anchorDateISO, cadenceWeeks, settingsLoading]);

  const payPeriodDays = useMemo(() => {
    return eachDayOfInterval({ start: payPeriodStart, end: payPeriodEnd });
  }, [payPeriodStart, payPeriodEnd]);

  // Get all time entries for the pay period (with clock_out)
  const allPayPeriodEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      const entryDate = startOfDay(new Date(entry.clock_in));
      return entryDate >= startOfDay(payPeriodStart) &&
             entryDate <= startOfDay(payPeriodEnd) &&
             entry.clock_out;
    }).map(entry => {
      const employee = employees.find(e => e.id === entry.staff_id);
      const minutes = differenceInMinutes(new Date(entry.clock_out!), new Date(entry.clock_in));
      const hours = roundToQuarterHours(minutes / 60);
      return {
        ...entry,
        employee,
        hours,
        status: entry.status || 'approved' as 'active' | 'pending_edit' | 'approved' | 'rejected',
      };
    }).sort((a, b) => {
      // Sort by employee name, then by date
      const nameCompare = (a.employee?.name || '').localeCompare(b.employee?.name || '');
      if (nameCompare !== 0) return nameCompare;
      return new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime();
    });
  }, [timeEntries, employees, payPeriodStart, payPeriodEnd]);

  const payrollData = useMemo(() => {
    return employees.map(emp => {
      const empEntries = allPayPeriodEntries.filter(entry => entry.staff_id === emp.id);
      
      const totalHours = empEntries.reduce((sum, entry) => sum + entry.hours, 0);
      
      return {
        ...emp,
        hoursWorked: totalHours,
        grossPay: totalHours * emp.hourly_rate,
        entries: empEntries,
      };
    }).filter(emp => emp.entries.length > 0); // Only show employees with entries
  }, [employees, allPayPeriodEntries]);

  type MergedEntry = TimeEntry & {
    employee: Employee | undefined;
    hours: number;
    status: 'active' | 'pending_edit' | 'approved' | 'rejected';
  };

  const mergedEmployeeBlocks = useMemo(() => {
    if (selectedEmployeeIds.length === 0) return [];
    return [...selectedEmployeeIds]
      .map((id) => {
        const employee = employees.find((e) => e.id === id);
        if (!employee) return null;
        const entries: MergedEntry[] = timeEntries
          .filter((entry) => {
            const entryDate = startOfDay(new Date(entry.clock_in));
            return (
              entry.staff_id === id &&
              entryDate >= startOfDay(payPeriodStart) &&
              entryDate <= startOfDay(payPeriodEnd)
            );
          })
          .map((entry) => {
            const hours = entry.clock_out
              ? roundToQuarterHours(
                  differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) / 60,
                )
              : 0;
            return {
              ...entry,
              employee,
              hours,
              status: (entry.status || 'approved') as MergedEntry['status'],
            };
          })
          .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
        const totalHours = entries.reduce((sum, e) => sum + (e.clock_out ? e.hours : 0), 0);
        return { employee, entries, totalHours };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) =>
        (a.employee.name || '').localeCompare(b.employee.name || '', undefined, { sensitivity: 'base' }),
      );
  }, [selectedEmployeeIds, employees, timeEntries, payPeriodStart, payPeriodEnd]);

  const toggleEmployeeInFilter = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllStaffInFilter = () => {
    setSelectedEmployeeIds(employees.map((e) => e.id));
  };

  const clearStaffFilter = () => {
    setSelectedEmployeeIds([]);
  };

  const beginAddEntryForEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const today = startOfDay(new Date());
    const periodStart = startOfDay(payPeriodStart);
    const periodEnd = startOfDay(payPeriodEnd);
    const date =
      today >= periodStart && today <= periodEnd ? today : payPeriodStart;
    setEditingDay({ date, entry: undefined });
    setEditingEntry(null);
    setEditFormData({
      clock_in: format(date, "yyyy-MM-dd'T'09:00"),
      clock_out: '',
    });
  };

  const handlePreviousPayPeriod = () => {
    setCurrentPayPeriod(addPayPeriods(payPeriodStart, -1, cadenceWeeks));
  };

  const handleNextPayPeriod = () => {
    setCurrentPayPeriod(addPayPeriods(payPeriodStart, 1, cadenceWeeks));
  };

  const handleCurrentPayPeriod = () => {
    setCurrentPayPeriod(new Date());
  };

  const isCurrentPayPeriod = useMemo(() => {
    const todayPeriodStart = getPayPeriodStartForDate(new Date(), { anchorDateISO, cadenceWeeks });
    return payPeriodStart.getTime() === todayPeriodStart.getTime();
  }, [payPeriodStart, anchorDateISO, cadenceWeeks]);

  const employeeTimesheetEntries = useMemo(() => {
    if (!selectedEmployeeId) return [];
    
    const empEntries = timeEntries.filter(entry => {
      const entryDate = startOfDay(new Date(entry.clock_in));
      return entry.staff_id === selectedEmployeeId && entryDate >= startOfDay(payPeriodStart) && entryDate <= startOfDay(payPeriodEnd);
    });

    // Group entries by day
    const entriesByDay: Record<string, TimeEntry[]> = {};
    payPeriodDays.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      entriesByDay[dayStr] = empEntries.filter(entry => {
        const entryDate = format(startOfDay(new Date(entry.clock_in)), 'yyyy-MM-dd');
        return entryDate === dayStr;
      });
    });

    return payPeriodDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEntries = entriesByDay[dayStr] || [];
      const totalHours = dayEntries.reduce((sum, entry) => {
        if (!entry.clock_out) return sum;
        return sum + roundToQuarterHours(differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) / 60);
      }, 0);

      return {
        date: day,
        dateStr: dayStr,
        entries: dayEntries,
        totalHours,
      };
    });
  }, [selectedEmployeeId, timeEntries, payPeriodStart, payPeriodEnd, payPeriodDays]);

  const handleSaveAmend = async () => {
    if (!selectedEmployeeId || !editingDay) return;
    
    const clockInISO = new Date(editFormData.clock_in).toISOString();
    const clockOutISO = editFormData.clock_out ? new Date(editFormData.clock_out).toISOString() : undefined;

    if (editingEntry) {
      // Update existing entry
      const updated = await onUpdateTimeEntry(editingEntry.id, {
        clock_in: clockInISO,
        clock_out: clockOutISO || null,
      });

      if (updated) {
        setEditingDay(null);
        setEditingEntry(null);
        setEditFormData({ clock_in: '', clock_out: '' });
      }
    } else {
      // Create new entry
      const created = await onAddTimeEntry(selectedEmployeeId, clockInISO, clockOutISO);
      
      if (created) {
        setEditingDay(null);
        setEditingEntry(null);
        setEditFormData({ clock_in: '', clock_out: '' });
      }
    }
  };

  const handleCancelAmend = () => {
    setEditingDay(null);
    setEditingEntry(null);
    setEditFormData({ clock_in: '', clock_out: '' });
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    const businessName = settings.business_name || 'Business';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let yPos = margin;

    const primaryColor = hslStringToRgbForPdf(settings.primary_color || DEFAULT_PRIMARY_COLOR_HSL);
    const getEmployeeId = (empId: string) => empId.slice(-4).toUpperCase();

    const logoSource =
      settings.business_logo_url_light ||
      settings.business_logo_url ||
      businessLogoUrl ||
      '';
    const wantLogoOnPdf =
      settings.payroll_pdf_include_logo !== 'false' && !!logoSource;

    let titleLeft = margin;
    let headerBottom = margin;

    if (wantLogoOnPdf) {
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
          /* ignore invalid image */
        }
      }
    }

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const headline = `${businessName} - TIMESHEETS`;
    const headlineMaxW = pageWidth - titleLeft - margin;
    const headlineLines = doc.splitTextToSize(headline, Math.max(40, headlineMaxW));
    let lineY = margin + 7;
    headlineLines.forEach((line) => {
      doc.text(line, titleLeft, lineY);
      lineY += 7;
    });
    headerBottom = Math.max(headerBottom, lineY - 2);
    yPos = headerBottom + 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pay Period: ${format(payPeriodStart, 'MMMM dd')} - ${format(payPeriodEnd, 'MMMM dd, yyyy')}`, margin, yPos);
    yPos += 6;
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy')} at ${format(new Date(), 'h:mm a')}`, margin, yPos);
    yPos += 12;

    const availableWidth = pageWidth - margin * 2;
    const centeredCell = { halign: 'center' as const, valign: 'middle' as const };

    // --- Pay calculations: all active staff (0 hours if none worked), ordered by name ---
    const activeEmployeesSorted = employees
      .filter((e) => e.status === 'active')
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

    const payCalcData = activeEmployeesSorted.map((emp) => {
      const empEntries = allPayPeriodEntries.filter((entry) => entry.staff_id === emp.id);
      const totalHours = empEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const grossPay = totalHours * emp.hourly_rate;
      return [
        getEmployeeId(emp.id),
        emp.name,
        totalHours.toFixed(2),
        `$${emp.hourly_rate.toFixed(2)}`,
        `$${grossPay.toFixed(2)}`,
      ];
    });

    const grandTotalHours = activeEmployeesSorted.reduce((sum, emp) => {
      const hrs = allPayPeriodEntries
        .filter((e) => e.staff_id === emp.id)
        .reduce((s, e) => s + e.hours, 0);
      return sum + hrs;
    }, 0);
    const grandTotalPay = activeEmployeesSorted.reduce((sum, emp) => {
      const hrs = allPayPeriodEntries
        .filter((e) => e.staff_id === emp.id)
        .reduce((s, e) => s + e.hours, 0);
      return sum + hrs * emp.hourly_rate;
    }, 0);

    payCalcData.push(['TOTALS', '', grandTotalHours.toFixed(2), '', `$${grandTotalPay.toFixed(2)}`]);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(35, 35, 35);
    doc.text('PAY CALCULATIONS', margin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Includes all active staff. Gross pay is completed hours x hourly rate for this pay period.',
      margin,
      yPos,
    );
    yPos += 10;

    autoTable(doc, {
      head: [['Employee ID', 'Employee Name', 'Total Hours', 'Hourly Rate', 'Gross Pay']],
      body: payCalcData,
      startY: yPos,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3, ...centeredCell },
      headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', ...centeredCell },
      columnStyles: {
        0: { cellWidth: availableWidth * 0.15 },
        1: { cellWidth: availableWidth * 0.3 },
        2: { cellWidth: availableWidth * 0.18 },
        3: { cellWidth: availableWidth * 0.18 },
        4: { cellWidth: availableWidth * 0.19 },
      },
      didParseCell: (data: any) => {
        if (data.row.raw[0] === 'TOTALS') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 14;
    doc.setTextColor(0, 0, 0);

    // --- Staff summary: one table per employee with any time record in period (incl. open punch) ---
    type PdfShiftRow = {
      entry: TimeEntry;
      hours: number;
      employee: Employee;
    };

    const periodShiftRows: PdfShiftRow[] = timeEntries
      .filter((entry) => {
        const entryDate = startOfDay(new Date(entry.clock_in));
        return (
          entryDate >= startOfDay(payPeriodStart) && entryDate <= startOfDay(payPeriodEnd)
        );
      })
      .map((entry) => {
        const staff = employees.find((e) => e.id === entry.staff_id);
        if (!staff) return null;
        const hours = entry.clock_out
          ? roundToQuarterHours(
              differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) / 60,
            )
          : 0;
        return { entry, hours, employee: staff };
      })
      .filter((row): row is PdfShiftRow => row != null);

    const byStaff: Record<string, { employee: Employee; rows: PdfShiftRow[] }> = {};
    for (const row of periodShiftRows) {
      const id = row.entry.staff_id;
      if (!byStaff[id]) {
        byStaff[id] = { employee: row.employee, rows: [] };
      }
      byStaff[id].rows.push(row);
    }

    const staffSummaryBlocks = Object.values(byStaff)
      .map((block) => ({
        ...block,
        rows: block.rows.sort(
          (a, b) => new Date(a.entry.clock_in).getTime() - new Date(b.entry.clock_in).getTime(),
        ),
      }))
      .sort((a, b) =>
        (a.employee.name || '').localeCompare(b.employee.name || '', undefined, { sensitivity: 'base' }),
      );

    if (staffSummaryBlocks.length > 0) {
      doc.addPage();
      yPos = margin;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(35, 35, 35);
      doc.text('STAFF SUMMARY', margin, yPos);
      yPos += 10;

      const summarySubtotalBg: [number, number, number] = [232, 242, 255];
      const summaryLineGray: [number, number, number] = [210, 210, 210];
      const thinRowLine = { top: 0, left: 0, right: 0, bottom: 0.12 } as const;
      const noLine = { top: 0, left: 0, right: 0, bottom: 0 } as const;

      for (const block of staffSummaryBlocks) {
        const blockTotalHours = block.rows.reduce(
          (sum, r) => sum + (r.entry.clock_out ? r.hours : 0),
          0,
        );
        const minBlockMm = 36;
        if (yPos > pageHeight - margin - minBlockMm) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(35, 35, 35);
        doc.text(
          `${block.employee.name} (ID: ${getEmployeeId(block.employee.id)})`,
          margin,
          yPos,
        );
        yPos += 8;

        const entryCount = block.rows.length;
        const bodyRows: (string | number)[][] = block.rows.map(({ entry, hours }) => [
          format(new Date(entry.clock_in), 'MM/dd/yyyy'),
          format(new Date(entry.clock_in), 'h:mm a'),
          entry.clock_out ? format(new Date(entry.clock_out), 'h:mm a') : 'Open',
          entry.clock_out ? (Math.round(hours * 4) / 4).toFixed(2) : '—',
        ]);
        bodyRows.push([
          `Total — ${block.employee.name}`,
          '',
          '',
          blockTotalHours.toFixed(2),
        ]);

        autoTable(doc, {
          head: [['Date', 'Clock In', 'Clock Out', 'Hours']],
          body: bodyRows,
          startY: yPos,
          margin: { left: margin, right: margin },
          theme: 'plain',
          tableLineWidth: 0,
          styles: {
            fontSize: 8,
            font: 'helvetica',
            fontStyle: 'normal',
            valign: 'middle',
            fillColor: [255, 255, 255],
            textColor: [40, 40, 40],
            lineColor: summaryLineGray,
            lineWidth: thinRowLine,
            cellPadding: { top: 3.5, bottom: 3.5, left: 2.5, right: 2.5 },
          },
          headStyles: {
            fillColor: primaryColor,
            textColor: 255,
            fontStyle: 'bold',
            valign: 'middle',
            lineWidth: noLine,
            lineColor: summaryLineGray,
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
          },
          columnStyles: {
            0: { cellWidth: availableWidth * 0.26, halign: 'left' },
            1: { cellWidth: availableWidth * 0.22, halign: 'center' },
            2: { cellWidth: availableWidth * 0.22, halign: 'center' },
            3: { cellWidth: availableWidth * 0.3, halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (data: any) => {
            if (data.section === 'head') {
              if (data.column.index === 0) data.cell.styles.halign = 'left';
              if (data.column.index === 1 || data.column.index === 2) data.cell.styles.halign = 'center';
              if (data.column.index === 3) data.cell.styles.halign = 'right';
              return;
            }
            const raw0 = data.row.raw[0];
            const isTotalRow = typeof raw0 === 'string' && raw0.startsWith('Total —');
            if (isTotalRow) {
              data.cell.styles.fillColor = summarySubtotalBg;
              data.cell.styles.textColor = [25, 25, 25];
              data.cell.styles.fontStyle = 'bold';
              if (data.column.index === 0) data.cell.styles.halign = 'left';
              else if (data.column.index === 3) data.cell.styles.halign = 'right';
              else data.cell.styles.halign = 'center';
              data.cell.styles.lineWidth = {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0.12,
              };
              return;
            }
            const isLastDataRow = data.row.index === entryCount - 1;
            if (isLastDataRow) {
              data.cell.styles.lineWidth = noLine;
            }
          },
        });

        yPos = (doc as any).lastAutoTable.finalY + 16;
        doc.setTextColor(0, 0, 0);
      }
    }

    const fileName = `timesheets-${format(payPeriodStart, 'yyyy-MM-dd')}-to-${format(payPeriodEnd, 'yyyy-MM-dd')}.pdf`;
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const preview = window.open(url, '_blank', 'noopener,noreferrer');

    if (!preview) {
      toast.warning(t('payroll.pdfPopupBlocked'));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }

    // Leave blob URL valid while the preview tab is open (browser PDF viewers may still reference it).
  };

  return (
    <PawLoadedContent
      loading={settingsLoading}
      loaderLabel={t('common.loading')}
      loaderWrapperClassName="min-h-[240px]"
    >
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-end">
        <div className="flex flex-col gap-2 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center sm:justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadPDF}
            className="flex w-full min-[400px]:w-auto items-center justify-center gap-2 shrink-0"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{t('payroll.downloadPdfReport')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPayPeriod}
            className="flex w-full min-[400px]:w-auto items-center justify-center gap-2 shrink-0"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">{t('payroll.previousPayPeriod')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPayPeriod}
            className="flex w-full min-[400px]:w-auto items-center justify-center gap-2 shrink-0"
          >
            <span className="truncate">{t('payroll.nextPayPeriod')}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Button>
          <Button
            variant={isCurrentPayPeriod ? 'default' : 'outline'}
            size="sm"
            onClick={handleCurrentPayPeriod}
            className="w-full min-[400px]:w-auto shrink-0"
          >
            {t('payroll.currentPayPeriod')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="timesheets" className="space-y-4">
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap gap-1 p-1 sm:flex-nowrap">
          <TabsTrigger
            value="timesheets"
            className="min-h-9 flex-1 min-w-[9rem] px-2 sm:px-3 outline-none transition-[outline,outline-offset] data-[state=active]:outline data-[state=active]:outline-2 data-[state=active]:outline-primary data-[state=active]:outline-offset-2"
          >
            {t('payroll.employeeSummary')}
          </TabsTrigger>
          <TabsTrigger
            value="calculations"
            className="min-h-9 flex-1 min-w-[9rem] px-2 sm:px-3 outline-none transition-[outline,outline-offset] data-[state=active]:outline data-[state=active]:outline-2 data-[state=active]:outline-primary data-[state=active]:outline-offset-2"
          >
            {t('payroll.payCalculations')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timesheets" className="mt-4 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-2 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <UserRound className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    {t('payroll.employeeSummary')}
                  </CardTitle>
                  <CardDescription className="text-pretty">
                    {t('payroll.employeeSummaryDescription')}
                  </CardDescription>
                  <p className="text-sm text-muted-foreground">
                    {t('payroll.payPeriod')}: {format(payPeriodStart, 'MMMM d')} – {format(payPeriodEnd, 'MMMM d, yyyy')}
                  </p>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[200px]">
                  <Label className="text-xs font-medium sm:text-sm">{t('payroll.filterEmployees')}</Label>
                  <Popover open={staffFilterOpen} onOpenChange={setStaffFilterOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full justify-between font-normal sm:min-w-[220px]"
                        aria-expanded={staffFilterOpen}
                      >
                        <span className="truncate">
                          {selectedEmployeeIds.length === 0
                            ? t('payroll.selectEmployees')
                            : t('payroll.employeesSelected', { count: selectedEmployeeIds.length })}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="end">
                      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
                        <span className="text-sm font-medium">{t('payroll.selectEmployees')}</span>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={selectAllStaffInFilter}>
                            {t('payroll.selectAllStaff')}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearStaffFilter}>
                            {t('payroll.clearStaffSelection')}
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-[min(50vh,16rem)] overflow-y-auto p-2">
                        {employees.map((emp) => (
                          <label
                            key={emp.id}
                            className="flex cursor-pointer items-center gap-3 rounded-md py-2.5 pl-2 pr-2 hover:bg-muted/80"
                          >
                            <Checkbox
                              checked={selectedEmployeeIds.includes(emp.id)}
                              onCheckedChange={() => toggleEmployeeInFilter(emp.id)}
                              aria-label={emp.name}
                            />
                            <span className="min-w-0 flex-1 text-sm">
                              <span className="block truncate font-medium">{emp.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{emp.role}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
              {selectedEmployeeIds.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
                  {t('payroll.selectStaffToView')}
                </div>
              )}
              {selectedEmployeeIds.length > 0 &&
                mergedEmployeeBlocks.map((block) => (
                  <div key={block.employee.id} className="min-w-0 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-base font-semibold sm:text-lg">
                        {block.employee.name}{' '}
                        <span className="font-mono text-sm font-normal text-muted-foreground">
                          (ID: {block.employee.id.slice(-4).toUpperCase()})
                        </span>
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-full shrink-0 sm:w-auto"
                        onClick={() => beginAddEntryForEmployee(block.employee.id)}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        {t('payroll.addEntry')}
                      </Button>
                    </div>
                    <div className="-mx-4 overflow-x-auto sm:mx-0 sm:rounded-md sm:border sm:border-border">
                      <table className="w-full min-w-[320px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted">
                            <th className="whitespace-nowrap py-2.5 pl-4 pr-2 text-left text-xs font-medium sm:py-3 sm:pl-4 sm:text-sm">
                              {t('employeePayroll.table.date')}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2.5 text-left text-xs font-medium sm:py-3 sm:text-sm">
                              {t('payroll.clockIn')}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2.5 text-left text-xs font-medium sm:py-3 sm:text-sm">
                              {t('payroll.clockOut')}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2.5 text-right text-xs font-medium sm:py-3 sm:pr-2 sm:text-sm">
                              {t('employeePayroll.table.hours')}
                            </th>
                            <th className="w-12 py-2.5 pr-4 text-right sm:w-14 sm:py-3 sm:pr-4">
                              <span className="sr-only">{t('payroll.editTimesHint')}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.entries.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                {t('payroll.noEntriesThisPeriod')}
                              </td>
                            </tr>
                          ) : (
                            block.entries.map((entry) => (
                              <tr
                                key={entry.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => openEditForEntry(entry)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openEditForEntry(entry);
                                  }
                                }}
                                className="group border-b border-border transition-colors hover:bg-primary/10 cursor-pointer"
                                title={t('payroll.rowEditableHint')}
                              >
                                <td className="whitespace-nowrap py-2.5 pl-4 pr-2 sm:py-3">
                                  {format(new Date(entry.clock_in), 'MM/dd/yyyy')}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2.5 sm:py-3">
                                  {format(new Date(entry.clock_in), 'h:mm a')}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2.5 sm:py-3">
                                  {entry.clock_out
                                    ? format(new Date(entry.clock_out), 'h:mm a')
                                    : t('timeClock.clockedIn')}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold sm:py-3 sm:pr-2">
                                  {entry.clock_out ? (Math.round(entry.hours * 4) / 4).toFixed(2) : '—'}
                                </td>
                                <td className="py-2.5 pr-4 text-right align-middle sm:py-3" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                                    onClick={() => openEditForEntry(entry)}
                                    title={t('payroll.rowEditableHint')}
                                    aria-label={t('payroll.editTimesHint')}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {block.entries.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-border bg-primary/10 font-semibold">
                              <td className="py-2.5 pl-4 pr-2 sm:py-3">
                                {t('employeePayroll.total')} — {block.employee.name}
                              </td>
                              <td colSpan={2} className="py-2.5 sm:py-3" />
                              <td className="py-2.5 pr-2 text-right sm:py-3 sm:pr-2">{block.totalHours.toFixed(2)}</td>
                              <td className="py-2.5 pr-4 sm:py-3" />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculations" className="mt-4">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <DollarSign className="h-5 w-5 shrink-0 text-primary" />
                {t('payroll.payCalculations')}
              </CardTitle>
              <CardDescription className="text-pretty">
                {t('payroll.payCalculationsDescription')}
              </CardDescription>
              <p className="text-sm text-muted-foreground">
                {t('payroll.payPeriod')}: {format(payPeriodStart, 'MMMM d')} – {format(payPeriodEnd, 'MMMM d, yyyy')}
              </p>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="-mx-4 overflow-x-auto sm:mx-0 sm:rounded-md sm:border sm:border-border">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="py-2.5 pl-4 pr-2 text-left text-xs font-medium sm:py-3 sm:text-sm">
                        {t('payroll.employee')} ID
                      </th>
                      <th className="px-2 py-2.5 text-left text-xs font-medium sm:py-3 sm:text-sm">
                        {t('payroll.employee')}
                      </th>
                      <th className="px-2 py-2.5 text-right text-xs font-medium sm:py-3 sm:text-sm">
                        {t('payroll.hoursWorked')}
                      </th>
                      <th className="px-2 py-2.5 text-right text-xs font-medium sm:py-3 sm:text-sm">
                        {t('payroll.hourlyRate')}
                      </th>
                      <th className="py-2.5 pr-4 pl-2 text-right text-xs font-medium sm:py-3 sm:text-sm">
                        {t('payroll.totalPay')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollData.map((emp) => {
                      const empId = emp.id.slice(-4).toUpperCase();
                      return (
                        <tr key={emp.id} className="border-b border-border transition-colors hover:bg-primary/10">
                          <td className="py-2.5 pl-4 pr-2 font-mono text-xs sm:py-3 sm:text-sm">{empId}</td>
                          <td className="px-2 py-2.5 font-medium sm:py-3">{emp.name}</td>
                          <td className="px-2 py-2.5 text-right font-semibold sm:py-3">{emp.hoursWorked.toFixed(2)}</td>
                          <td className="px-2 py-2.5 text-right text-muted-foreground sm:py-3">
                            ${emp.hourly_rate.toFixed(2)}
                          </td>
                          <td className="py-2.5 pr-4 pl-2 text-right font-semibold sm:py-3">${emp.grossPay.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-primary/10 font-semibold">
                      <td colSpan={2} className="py-2.5 pl-4 sm:py-3">
                        TOTALS
                      </td>
                      <td className="px-2 py-2.5 text-right sm:py-3">
                        {payrollData.reduce((sum, e) => sum + e.hoursWorked, 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 sm:py-3" />
                      <td className="py-2.5 pr-4 pl-2 text-right font-bold sm:py-3">
                        ${payrollData.reduce((sum, e) => sum + e.grossPay, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Amend Timesheet Dialog */}
      <Dialog open={!!editingDay} onOpenChange={(open) => !open && handleCancelAmend}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? t('payroll.amendTimesheetEntry') : t('payroll.addTimesheetEntry')}</DialogTitle>
            <DialogDescription>
              {editingEntry 
                ? t('payroll.correctTimesDescription', { date: editingDay ? format(editingDay.date, 'EEEE, MMMM d') : '' })
                : t('payroll.addNewEntryDescription', { date: editingDay ? format(editingDay.date, 'EEEE, MMMM d') : '' })
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingDay && employeeTimesheetEntries.find(e => e.dateStr === format(editingDay.date, 'yyyy-MM-dd'))?.entries.length > 1 && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  {t('payroll.multipleEntriesNote')}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('payroll.clockIn')} *</Label>
              <Input
                type="datetime-local"
                value={editFormData.clock_in}
                onChange={(e) => setEditFormData({ ...editFormData, clock_in: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('payroll.clockOut')}</Label>
              <Input
                type="datetime-local"
                value={editFormData.clock_out}
                onChange={(e) => setEditFormData({ ...editFormData, clock_out: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t('payroll.leaveEmptyIfClockedIn')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelAmend}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveAmend}>
              {editingEntry ? t('payroll.saveChanges') : t('payroll.addEntry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PawLoadedContent>
  );
}
