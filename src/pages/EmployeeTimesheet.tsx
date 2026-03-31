import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, Download } from 'lucide-react';
import { Employee, TimeEntry } from '@/types';
import { format, differenceInMinutes, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';
import { t } from '@/lib/translations';
import { useSettings } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { supabase } from '@/integrations/supabase/client';
import { addPayPeriods, getPayPeriodRangeForDate, getPayPeriodStartForDate } from '@/lib/payScheduleUtils';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { downloadEmployeeTimesheetPdf } from '@/lib/payrollPdf';
import { toast } from 'sonner';

interface EmployeeTimesheetProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
}

function formatClockInsCell(entries: TimeEntry[]): string {
  const lines = entries.filter((e) => e.clock_out).map((e) => format(new Date(e.clock_in), 'h:mm a'));
  return lines.length ? lines.join('\n') : '—';
}

function formatClockOutsCell(entries: TimeEntry[]): string {
  const lines = entries.filter((e) => e.clock_out).map((e) => format(new Date(e.clock_out!), 'h:mm a'));
  return lines.length ? lines.join('\n') : '—';
}

export function EmployeeTimesheet({ employees, timeEntries }: EmployeeTimesheetProps) {
  const { staffId, employeeId, businessSlug } = useParams<{
    staffId?: string;
    employeeId?: string;
    businessSlug?: string;
  }>();
  const staffRecordId = staffId ?? employeeId ?? '';
  const pathPrefix = businessSlug ? `/${businessSlug}` : '';
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, loading: settingsLoading } = useSettings();
  const { role, profile, business } = useAuth();
  const businessId = useBusinessId();
  const [businessLogoUrl, setBusinessLogoUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [currentPayPeriod, setCurrentPayPeriod] = useState(() => {
    const state = location.state as { payPeriodStart?: string; weekStart?: string } | null;
    const startDateISO = state?.payPeriodStart || state?.weekStart;
    return startDateISO ? parseISO(startDateISO) : new Date();
  });

  useEffect(() => {
    if (business?.logo_url) {
      setBusinessLogoUrl(business.logo_url);
    } else if (businessId) {
      void supabase
        .from('businesses')
        .select('logo_url')
        .eq('id', businessId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.logo_url) setBusinessLogoUrl(data.logo_url);
        });
    }
  }, [business, businessId]);

  const employee = employees.find((emp) => emp.id === staffRecordId);
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

  const isCurrentPayPeriod = useMemo(() => {
    const todayPeriodStart = getPayPeriodStartForDate(new Date(), { anchorDateISO, cadenceWeeks });
    return payPeriodStart.getTime() === todayPeriodStart.getTime();
  }, [payPeriodStart, anchorDateISO, cadenceWeeks]);

  const timesheetData = useMemo(() => {
    if (!employee) return null;

    const roundToQuarterHours = (hours: number) => Math.round(hours * 4) / 4;

    const empEntries = timeEntries.filter((entry) => {
      const entryDate = startOfDay(new Date(entry.clock_in));
      return (
        entry.staff_id === employee.id &&
        entryDate >= startOfDay(payPeriodStart) &&
        entryDate <= startOfDay(payPeriodEnd) &&
        entry.clock_out
      );
    });

    const dailyData = payPeriodDays.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEntries = empEntries.filter((entry) => {
        const entryDate = format(startOfDay(new Date(entry.clock_in)), 'yyyy-MM-dd');
        return entryDate === dayStr;
      });

      const dayHours = dayEntries.reduce((sum, entry) => {
        if (!entry.clock_out) return sum;
        return sum + roundToQuarterHours(differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) / 60);
      }, 0);

      const dayPay = dayHours * employee.hourly_rate;

      return {
        date: day,
        dateStr: dayStr,
        hours: dayHours,
        pay: dayPay,
        entries: dayEntries,
      };
    });

    const totalHours = dailyData.reduce((sum, day) => sum + day.hours, 0);
    const grossPay = totalHours * employee.hourly_rate;

    return {
      employee,
      dailyData,
      totalHours,
      grossPay,
      empEntries,
    };
  }, [employee, timeEntries, payPeriodStart, payPeriodEnd, payPeriodDays]);

  const handlePreviousPayPeriod = () => {
    setCurrentPayPeriod(addPayPeriods(payPeriodStart, -1, cadenceWeeks));
  };

  const handleNextPayPeriod = () => {
    setCurrentPayPeriod(addPayPeriods(payPeriodStart, 1, cadenceWeeks));
  };

  const handleCurrentPayPeriod = () => {
    setCurrentPayPeriod(new Date());
  };

  const backTarget = role === 'employee' ? `${pathPrefix}/staff-management` : `${pathPrefix}/reports/payroll`;
  const backLabel = role === 'employee' ? t('timesheet.backToProfile') : t('timesheet.backToPayroll');

  const handleDownloadPdf = async () => {
    if (!employee || !timesheetData) return;
    if (role === 'employee' && profile?.staff_id !== employee.id) {
      toast.error(t('common.genericError'));
      return;
    }
    setPdfLoading(true);
    try {
      const logoSource =
        settings.business_logo_url_light ||
        settings.business_logo_url ||
        businessLogoUrl ||
        '';
      await downloadEmployeeTimesheetPdf({
        businessName: settings.business_name || business?.name || 'Business',
        primaryHsl: settings.primary_color,
        payrollPdfIncludeLogo: settings.payroll_pdf_include_logo !== 'false',
        logoSource,
        employee,
        payPeriodStart,
        payPeriodEnd,
        entries: timesheetData.empEntries,
        taxDisclaimer: t('timesheet.grossPayTaxNote'),
      });
    } catch (e) {
      if (import.meta.env.DEV) console.error(e);
      toast.error(t('common.genericError'));
    } finally {
      setPdfLoading(false);
    }
  };

  if (role === 'employee' && profile?.staff_id && staffRecordId && profile.staff_id !== staffRecordId) {
    return <Navigate to={`${pathPrefix}/staff-management`} replace />;
  }

  if (!settingsLoading && (!employee || !timesheetData)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Button variant="ghost" onClick={() => navigate(backTarget)} className="mb-4">
            <ChevronLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t('timesheet.employeeNotFound')}</h1>
        </div>
      </div>
    );
  }

  return (
    <PawLoadedContent
      loading={settingsLoading}
      loaderLabel={t('common.loading')}
      loaderWrapperClassName="min-h-[240px]"
    >
      {employee && timesheetData ? (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate(backTarget)} className="mb-4">
            <ChevronLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
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
                variant={isCurrentPayPeriod ? 'default' : 'outline'}
                size="sm"
                onClick={handleCurrentPayPeriod}
              >
                {t('payroll.currentPayPeriod')}
              </Button>
            </div>
            <Button
              variant="default"
              size="sm"
              disabled={pdfLoading || !timesheetData}
              onClick={() => void handleDownloadPdf()}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {t('timesheet.downloadPdf')}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {t('payroll.payPeriodSummary')}
            </CardTitle>
            <CardDescription>
              {format(payPeriodStart, 'MMMM d')} - {format(payPeriodEnd, 'd, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
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
                variant={isCurrentPayPeriod ? 'default' : 'outline'}
                size="sm"
                onClick={handleCurrentPayPeriod}
              >
                {t('payroll.currentPayPeriod')}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('timesheet.hourlyRate')}</p>
                <p className="text-2xl font-bold">${employee.hourly_rate}/hr</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('timesheet.totalHours')}</p>
                <p className="text-2xl font-bold">{timesheetData.totalHours.toFixed(1)}h</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('timesheet.grossPay')}</p>
                <p className="text-2xl font-bold">${timesheetData.grossPay.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t('timesheet.grossPayTaxNote')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {t('timesheet.timesheetDetails')}
            </CardTitle>
            <CardDescription>{t('timesheet.twoWeekBreakdown')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">{t('timesheet.dateDay')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('payroll.clockIn')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('payroll.clockOut')}</th>
                    <th className="text-right py-3 px-4 font-medium">{t('timesheet.hoursWorked')}</th>
                    <th className="text-right py-3 px-4 font-medium">{t('timesheet.pay')}</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheetData.dailyData.map((day) => (
                    <tr
                      key={day.dateStr}
                      className="border-b border-border hover:bg-secondary/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium">{format(day.date, 'EEE MMM d')}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground whitespace-pre-line">
                        {formatClockInsCell(day.entries)}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground whitespace-pre-line">
                        {formatClockOutsCell(day.entries)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {day.hours > 0 ? `${day.hours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {day.pay > 0 ? `$${day.pay.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/50">
                    <td colSpan={3} className="py-3 px-4 font-semibold">
                      {t('dashboard.totalEarned')}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {timesheetData.totalHours.toFixed(1)}h
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      ${timesheetData.grossPay.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      ) : null}
    </PawLoadedContent>
  );
}
