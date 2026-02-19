import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, ChevronLeft, ChevronRight, Clock, Edit, Download } from 'lucide-react';
import { Employee, TimeEntry } from '@/types';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, differenceInHours, addWeeks, subWeeks, startOfDay } from 'date-fns';
import { t } from '@/lib/translations';
import { useSettings } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { supabase } from '@/integrations/supabase/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PayrollProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
  onUpdateTimeEntry: (id: string, entryData: Partial<TimeEntry>) => Promise<TimeEntry | null>;
  onAddTimeEntry: (employeeId: string, clockIn: string, clockOut?: string) => Promise<TimeEntry | null>;
}

export function Payroll({ employees, timeEntries, onUpdateTimeEntry, onAddTimeEntry }: PayrollProps) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { business } = useAuth();
  const businessId = useBusinessId();
  const [businessLogoUrl, setBusinessLogoUrl] = useState<string | null>(null);
  const [currentPayPeriod, setCurrentPayPeriod] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editingDay, setEditingDay] = useState<{ date: Date; entry?: TimeEntry } | null>(null);
  const [editFormData, setEditFormData] = useState({
    clock_in: '',
    clock_out: '',
  });

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

  // Helper to convert HSL to RGB array for jsPDF
  const hslToRgb = (hsl: string): [number, number, number] => {
    try {
      // Handle format: "168 60% 45%" or "hsl(168, 60%, 45%)"
      let match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
      if (!match) {
        match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      }
      if (!match) return [0, 0, 0];

      const h = parseInt(match[1]) / 360;
      const s = parseInt(match[2]) / 100;
      const l = parseInt(match[3]) / 100;

      let r: number, g: number, b: number;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }
      return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255),
      ];
    } catch {
      return [0, 0, 0];
    }
  };

  // Two-week pay period: start of first week to end of second week
  const payPeriodStart = startOfWeek(currentPayPeriod);
  const payPeriodEnd = endOfWeek(addWeeks(payPeriodStart, 1));
  const payPeriodDays = eachDayOfInterval({ start: payPeriodStart, end: payPeriodEnd });

  // Get all time entries for the pay period (with clock_out)
  const allPayPeriodEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      const entryDate = startOfDay(new Date(entry.clock_in));
      return entryDate >= startOfDay(payPeriodStart) &&
             entryDate <= startOfDay(payPeriodEnd) &&
             entry.clock_out;
    }).map(entry => {
      const employee = employees.find(e => e.id === entry.employee_id);
      const hours = differenceInHours(new Date(entry.clock_out!), new Date(entry.clock_in));
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
      const empEntries = allPayPeriodEntries.filter(entry => entry.employee_id === emp.id);
      
      const totalHours = empEntries.reduce((sum, entry) => sum + entry.hours, 0);
      
      return {
        ...emp,
        hoursWorked: totalHours,
        grossPay: totalHours * emp.hourly_rate,
        entries: empEntries,
      };
    }).filter(emp => emp.entries.length > 0); // Only show employees with entries
  }, [employees, allPayPeriodEntries]);

  // By Employee Summary data
  const byEmployeeSummary = useMemo(() => {
    const summary: Record<string, {
      employee: Employee;
      entries: typeof allPayPeriodEntries;
      totalHours: number;
    }> = {};

    allPayPeriodEntries.forEach(entry => {
      if (!entry.employee) return;
      const empId = entry.employee_id;
      if (!summary[empId]) {
        summary[empId] = {
          employee: entry.employee,
          entries: [],
          totalHours: 0,
        };
      }
      summary[empId].entries.push(entry);
      summary[empId].totalHours += entry.hours;
    });

    return Object.values(summary);
  }, [allPayPeriodEntries]);

  const handlePreviousPayPeriod = () => {
    setCurrentPayPeriod(subWeeks(currentPayPeriod, 2));
  };

  const handleNextPayPeriod = () => {
    setCurrentPayPeriod(addWeeks(currentPayPeriod, 2));
  };

  const handleCurrentPayPeriod = () => {
    setCurrentPayPeriod(startOfWeek(new Date()));
  };

  const isCurrentPayPeriod = useMemo(() => {
    const now = new Date();
    const currentPeriodStart = startOfWeek(startOfWeek(now));
    return payPeriodStart.getTime() === currentPeriodStart.getTime();
  }, [payPeriodStart]);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
  
  const employeeTimesheetEntries = useMemo(() => {
    if (!selectedEmployeeId) return [];
    
    const empEntries = timeEntries.filter(entry => {
      const entryDate = startOfDay(new Date(entry.clock_in));
      return entry.employee_id === selectedEmployeeId && entryDate >= startOfDay(payPeriodStart) && entryDate <= startOfDay(payPeriodEnd);
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
        return sum + differenceInHours(new Date(entry.clock_out), new Date(entry.clock_in));
      }, 0);

      return {
        date: day,
        dateStr: dayStr,
        entries: dayEntries,
        totalHours,
      };
    });
  }, [selectedEmployeeId, timeEntries, payPeriodStart, payPeriodEnd, payPeriodDays]);

  const handleAmendDay = (date: Date) => {
    if (!selectedEmployeeId) return;
    
    // Get the first entry for this day, or create a new one
    const dayEntries = employeeTimesheetEntries.find(e => e.dateStr === format(date, 'yyyy-MM-dd'))?.entries || [];
    const firstEntry = dayEntries.length > 0 ? dayEntries[0] : undefined;
    
    setEditingDay({ date, entry: firstEntry });
    if (firstEntry) {
      setEditingEntry(firstEntry);
      setEditFormData({
        clock_in: format(new Date(firstEntry.clock_in), "yyyy-MM-dd'T'HH:mm"),
        clock_out: firstEntry.clock_out ? format(new Date(firstEntry.clock_out), "yyyy-MM-dd'T'HH:mm") : '',
      });
    } else {
      // New entry - set default times for the day
      const defaultClockIn = format(date, "yyyy-MM-dd'T'09:00");
      setEditingEntry(null);
      setEditFormData({
        clock_in: defaultClockIn,
        clock_out: '',
      });
    }
  };

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
    const margin = 14;
    let yPos = margin;

    // Get primary color for table headers
    const primaryColor = hslToRgb(settings.primary_color || '168 60% 45%');

    // Helper to get employee ID (use last 4 digits of UUID or a short ID)
    const getEmployeeId = (empId: string) => {
      return empId.slice(-4).toUpperCase();
    };

    // Header - Business name, pay period, and generation date
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`${businessName} - PAYROLL TIMESHEET`, margin, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pay Period: ${format(payPeriodStart, 'MMMM dd')} - ${format(payPeriodEnd, 'MMMM dd, yyyy')}`, margin, yPos);
    yPos += 6;
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy')} at ${format(new Date(), 'h:mm a')}`, margin, yPos);
    yPos += 12;

    // Section 1: Payroll Timesheet (Detailed)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYROLL TIMESHEET', margin, yPos);
    yPos += 8;

    const timesheetData = allPayPeriodEntries.map(entry => [
      getEmployeeId(entry.employee_id),
      entry.employee?.name || 'Unknown',
      format(new Date(entry.clock_in), 'MM/dd/yyyy'),
      format(new Date(entry.clock_in), 'h:mm a'),
      format(new Date(entry.clock_out!), 'h:mm a'),
      entry.hours.toFixed(2),
      entry.status === 'approved' ? 'Approved' : entry.status === 'pending_edit' ? 'Pending' : 'Active',
      format(payPeriodStart, 'MM/dd/yyyy'),
      format(payPeriodEnd, 'MM/dd/yyyy'),
    ]);

    // Calculate available width for table (page width - margins)
    const availableWidth = pageWidth - (margin * 2);

    autoTable(doc, {
      head: [['Employee ID', 'Employee Name', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Period Start', 'Period End']],
      body: timesheetData,
      startY: yPos,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: availableWidth * 0.08 }, // Employee ID
        1: { cellWidth: availableWidth * 0.15 }, // Employee Name
        2: { cellWidth: availableWidth * 0.10 }, // Date
        3: { cellWidth: availableWidth * 0.10 }, // Clock In
        4: { cellWidth: availableWidth * 0.10 }, // Clock Out
        5: { cellWidth: availableWidth * 0.08 }, // Hours
        6: { cellWidth: availableWidth * 0.10 }, // Status
        7: { cellWidth: availableWidth * 0.10 }, // Period Start
        8: { cellWidth: availableWidth * 0.10 }, // Period End
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Total row
    const totalHours = allPayPeriodEntries.reduce((sum, entry) => sum + entry.hours, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${totalHours.toFixed(2)} hours`, margin, yPos);
    yPos += 15;

    // Section 2: By Employee Summary
    if (yPos > 250) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('BY EMPLOYEE SUMMARY', margin, yPos);
    yPos += 8;

    const summaryData: any[] = [];
    byEmployeeSummary.forEach(summary => {
      summary.entries.forEach(entry => {
        summaryData.push([
          format(new Date(entry.clock_in), 'MM/dd/yyyy'),
          format(new Date(entry.clock_in), 'h:mm a'),
          format(new Date(entry.clock_out!), 'h:mm a'),
          entry.hours.toFixed(2),
          entry.status === 'approved' ? 'Approved' : entry.status === 'pending_edit' ? 'Pending' : 'Active',
        ]);
      });
      // Subtotal row
      summaryData.push([
        `Subtotal - ${summary.employee.name}`,
        '',
        '',
        summary.totalHours.toFixed(2),
        '',
      ]);
    });

    autoTable(doc, {
      head: [['Date', 'Clock In', 'Clock Out', 'Hours', 'Status']],
      body: summaryData,
      startY: yPos,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: availableWidth * 0.25 }, // Date
        1: { cellWidth: availableWidth * 0.20 }, // Clock In
        2: { cellWidth: availableWidth * 0.20 }, // Clock Out
        3: { cellWidth: availableWidth * 0.15 }, // Hours
        4: { cellWidth: availableWidth * 0.20 }, // Status
      },
      didParseCell: (data: any) => {
        if (data.row.raw[0]?.includes('Subtotal')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [0, 0, 0];
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Section 3: Pay Calculations
    if (yPos > 250) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PAY CALCULATIONS', margin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Pay rates are editable. Gross Pay is calculated as Hours x Rate.', margin, yPos);
    yPos += 10;

    const payCalcData = payrollData.map(emp => [
      getEmployeeId(emp.id),
      emp.name,
      emp.hoursWorked.toFixed(2),
      `$${emp.hourly_rate.toFixed(2)}`,
      `$${emp.grossPay.toFixed(2)}`,
    ]);

    // Add totals row
    const grandTotalHours = payrollData.reduce((sum, e) => sum + e.hoursWorked, 0);
    const grandTotalPay = payrollData.reduce((sum, e) => sum + e.grossPay, 0);
    payCalcData.push([
      'TOTALS',
      '',
      grandTotalHours.toFixed(2),
      '',
      `$${grandTotalPay.toFixed(2)}`,
    ]);

    autoTable(doc, {
      head: [['Employee ID', 'Employee Name', 'Total Hours', 'Hourly Rate', 'Gross Pay']],
      body: payCalcData,
      startY: yPos,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: availableWidth * 0.15 }, // Employee ID
        1: { cellWidth: availableWidth * 0.30 }, // Employee Name
        2: { cellWidth: availableWidth * 0.18 }, // Total Hours
        3: { cellWidth: availableWidth * 0.18 }, // Hourly Rate
        4: { cellWidth: availableWidth * 0.19 }, // Gross Pay
      },
      didParseCell: (data: any) => {
        if (data.row.raw[0] === 'TOTALS') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });

    // Save PDF
    const fileName = `payroll-${format(payPeriodStart, 'yyyy-MM-dd')}-to-${format(payPeriodEnd, 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('payroll.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('payroll.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadPDF}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download PDF Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPayPeriod}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('payroll.previousPayPeriod')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPayPeriod}
            className="flex items-center gap-2"
          >
            {t('payroll.nextPayPeriod')}
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant={isCurrentPayPeriod ? "default" : "outline"}
            size="sm"
            onClick={handleCurrentPayPeriod}
          >
            {t('payroll.currentPayPeriod')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="timesheet" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timesheet">Payroll Timesheet</TabsTrigger>
          <TabsTrigger value="summary">By Employee Summary</TabsTrigger>
          <TabsTrigger value="calculations">Pay Calculations</TabsTrigger>
          <TabsTrigger value="edit">Edit Timesheet</TabsTrigger>
        </TabsList>

        {/* Payroll Timesheet Tab */}
        <TabsContent value="timesheet">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Payroll Timesheet
              </CardTitle>
              <CardDescription>
                Pay Period: {format(payPeriodStart, 'MMMM dd')} - {format(payPeriodEnd, 'MMMM dd, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="text-left py-3 px-4 font-medium">Employee ID</th>
                      <th className="text-left py-3 px-4 font-medium">Employee Name</th>
                      <th className="text-left py-3 px-4 font-medium">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Clock In</th>
                      <th className="text-left py-3 px-4 font-medium">Clock Out</th>
                      <th className="text-right py-3 px-4 font-medium">Hours</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Period Start</th>
                      <th className="text-left py-3 px-4 font-medium">Period End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayPeriodEntries.map((entry) => {
                      const empId = entry.employee_id.slice(-4).toUpperCase();
                      return (
                        <tr key={entry.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-sm">{empId}</td>
                          <td className="py-3 px-4 font-medium">{entry.employee?.name || 'Unknown'}</td>
                          <td className="py-3 px-4">{format(new Date(entry.clock_in), 'MM/dd/yyyy')}</td>
                          <td className="py-3 px-4">{format(new Date(entry.clock_in), 'h:mm a')}</td>
                          <td className="py-3 px-4">{format(new Date(entry.clock_out!), 'h:mm a')}</td>
                          <td className="py-3 px-4 text-right font-semibold">{entry.hours.toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                              entry.status === 'pending_edit' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {entry.status === 'approved' ? 'Approved' : entry.status === 'pending_edit' ? 'Pending' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{format(payPeriodStart, 'MM/dd/yyyy')}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{format(payPeriodEnd, 'MM/dd/yyyy')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/50 font-semibold">
                      <td colSpan={5} className="py-3 px-4">TOTAL</td>
                      <td className="py-3 px-4 text-right">
                        {allPayPeriodEntries.reduce((sum, entry) => sum + entry.hours, 0).toFixed(2)}
                      </td>
                      <td colSpan={3} className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Employee Summary Tab */}
        <TabsContent value="summary">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                By Employee Summary
              </CardTitle>
              <CardDescription>
                Pay Period: {format(payPeriodStart, 'MMMM dd')} - {format(payPeriodEnd, 'MMMM dd, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {byEmployeeSummary.map((summary) => (
                  <div key={summary.employee.id}>
                    <div className="mb-2">
                      <h3 className="font-semibold text-lg">
                        Employee: {summary.employee.name} (ID: {summary.employee.id.slice(-4).toUpperCase()})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-red-50">
                            <th className="text-left py-3 px-4 font-medium">Date</th>
                            <th className="text-left py-3 px-4 font-medium">Clock In</th>
                            <th className="text-left py-3 px-4 font-medium">Clock Out</th>
                            <th className="text-right py-3 px-4 font-medium">Hours</th>
                            <th className="text-left py-3 px-4 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.entries.map((entry) => (
                            <tr key={entry.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                              <td className="py-3 px-4">{format(new Date(entry.clock_in), 'MM/dd/yyyy')}</td>
                              <td className="py-3 px-4">{format(new Date(entry.clock_in), 'h:mm a')}</td>
                              <td className="py-3 px-4">{format(new Date(entry.clock_out!), 'h:mm a')}</td>
                              <td className="py-3 px-4 text-right font-semibold">{entry.hours.toFixed(2)}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  entry.status === 'pending_edit' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {entry.status === 'approved' ? 'Approved' : entry.status === 'pending_edit' ? 'Pending' : 'Active'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-secondary/50 font-semibold border-t-2 border-border">
                            <td className="py-3 px-4">Subtotal - {summary.employee.name}</td>
                            <td colSpan={2} className="py-3 px-4"></td>
                            <td className="py-3 px-4 text-right">{summary.totalHours.toFixed(2)}</td>
                            <td className="py-3 px-4"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pay Calculations Tab */}
        <TabsContent value="calculations">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Pay Calculations
              </CardTitle>
              <CardDescription>
                Pay Period: {format(payPeriodStart, 'MMMM dd')} - {format(payPeriodEnd, 'MMMM dd, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Pay rates are editable. Gross Pay is calculated as Hours x Rate.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-red-50">
                      <th className="text-left py-3 px-4 font-medium">Employee ID</th>
                      <th className="text-left py-3 px-4 font-medium">Employee Name</th>
                      <th className="text-right py-3 px-4 font-medium">Total Hours</th>
                      <th className="text-right py-3 px-4 font-medium">Hourly Rate</th>
                      <th className="text-right py-3 px-4 font-medium">Gross Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollData.map(emp => {
                      const empId = emp.id.slice(-4).toUpperCase();
                      return (
                        <tr key={emp.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-sm">{empId}</td>
                          <td className="py-3 px-4 font-medium">{emp.name}</td>
                          <td className="py-3 px-4 text-right font-semibold">{emp.hoursWorked.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right text-muted-foreground">${emp.hourly_rate.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-semibold">${emp.grossPay.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/50 font-semibold border-t-2 border-border">
                      <td colSpan={2} className="py-3 px-4">TOTALS</td>
                      <td className="py-3 px-4 text-right">
                        {payrollData.reduce((sum, e) => sum + e.hoursWorked, 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-right font-bold">
                        ${payrollData.reduce((sum, e) => sum + e.grossPay, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Timesheet Tab */}
        <TabsContent value="edit">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {t('payroll.employeeTimesheet')}
              </CardTitle>
              <CardDescription>
                {t('payroll.viewAndAmendDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('payroll.selectEmployee')}</Label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('payroll.chooseEmployee')} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEmployee && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground mb-4">
                      {t('payroll.timesheetFor')} <span className="font-semibold text-foreground">{selectedEmployee.name}</span> - {t('payroll.payPeriod')}: {format(payPeriodStart, 'MMMM d')} - {format(payPeriodEnd, 'd, yyyy')}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 font-medium">{t('timesheet.dateDay')}</th>
                            <th className="text-right py-3 px-4 font-medium">{t('reports.hours')}</th>
                            <th className="text-center py-3 px-4 font-medium">{t('payroll.action')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeTimesheetEntries.map(({ date, dateStr, entries, totalHours }) => (
                            <tr key={dateStr} className="border-b border-border hover:bg-secondary/50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-medium">{format(date, 'EEE MMM d')}</div>
                                {entries.length > 0 && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {entries.map((entry) => (
                                      <div key={entry.id}>
                                        {format(new Date(entry.clock_in), 'h:mm a')} - {entry.clock_out ? format(new Date(entry.clock_out), 'h:mm a') : t('timeClock.clockedIn')}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {entries.length === 0 && (
                                  <div className="text-xs text-muted-foreground mt-1">{t('schedule.noEntries')}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold">
                                {totalHours > 0 ? `${totalHours.toFixed(1)}h` : '-'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAmendDay(date)}
                                  className="flex items-center gap-1"
                                >
                                  <Edit className="w-3 h-3" />
                                  {t('payroll.amend')}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-secondary/50">
                            <td className="py-3 px-4 font-semibold">{t('dashboard.totalEarned')}</td>
                            <td className="py-3 px-4 text-right font-semibold">
                              {employeeTimesheetEntries.reduce((sum, day) => sum + day.totalHours, 0).toFixed(1)}h
                            </td>
                            <td className="py-3 px-4"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {!selectedEmployee && (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('payroll.selectEmployeeToView')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Amend Timesheet Dialog */}
      <Dialog open={!!editingDay} onOpenChange={(open) => !open && handleCancelAmend}>
        <DialogContent className="max-w-md">
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
  );
}
