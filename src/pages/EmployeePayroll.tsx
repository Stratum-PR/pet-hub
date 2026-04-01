import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, ChevronLeft, Clock, Calendar, User, FileText } from 'lucide-react';
import { Employee, TimeEntry } from '@/types';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { formatPhoneNumber } from '@/lib/phoneFormat';
import { t } from '@/lib/translations';
import { useSettings } from '@/hooks/useSupabaseData';
import { getPayPeriodRangeForDate } from '@/lib/payScheduleUtils';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { useAuth } from '@/contexts/AuthContext';
import { timeEntryCountsTowardPayroll } from '@/lib/timeEntryStatus';

interface EmployeePayrollProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
}

export function EmployeePayroll({ employees, timeEntries }: EmployeePayrollProps) {
  const { staffId, employeeId, businessSlug } = useParams<{
    staffId?: string;
    employeeId?: string;
    businessSlug?: string;
  }>();
  const staffRecordId = staffId ?? employeeId ?? '';
  const pathPrefix = businessSlug ? `/${businessSlug}` : '';
  const navigate = useNavigate();
  const location = useLocation();
  const { role, profile } = useAuth();

  const [currentPayPeriodDate] = useState(() => {
    const state = location.state as { payPeriodStart?: string; weekStart?: string } | null;
    const startISO = state?.payPeriodStart || state?.weekStart;
    return startISO ? parseISO(startISO) : new Date();
  });

  const { settings, loading: settingsLoading } = useSettings();

  const employee = employees.find(emp => emp.id === staffRecordId);
  const cadenceWeeks = Math.max(1, parseInt(settings.pay_schedule_cadence_weeks || '2', 10) || 2);
  const anchorDateISO = settings.pay_schedule_anchor_date || new Date().toISOString().slice(0, 10);

  const { periodStart: payPeriodStart, periodEnd: payPeriodEnd } = useMemo(() => {
    if (settingsLoading) {
      const d = new Date();
      return getPayPeriodRangeForDate(d, { anchorDateISO: d.toISOString().slice(0, 10), cadenceWeeks: 2 });
    }
    return getPayPeriodRangeForDate(currentPayPeriodDate, { anchorDateISO, cadenceWeeks });
  }, [currentPayPeriodDate, anchorDateISO, cadenceWeeks, settingsLoading]);

  const payrollData = useMemo(() => {
    if (!employee) return null;

    const roundToQuarterHours = (hours: number) => Math.round(hours * 4) / 4;

    const empEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.clock_in);
      return (
        entry.staff_id === employee.id &&
        entryDate >= payPeriodStart &&
        entryDate <= payPeriodEnd &&
        entry.clock_out &&
        timeEntryCountsTowardPayroll(entry)
      );
    });

    const entriesWithHours = empEntries.map(entry => {
      const hours = roundToQuarterHours(differenceInMinutes(new Date(entry.clock_out!), new Date(entry.clock_in)) / 60);
      return {
        ...entry,
        hours,
        pay: hours * employee.hourly_rate,
      };
    });

    const totalHours = entriesWithHours.reduce((sum, entry) => sum + entry.hours, 0);
    const grossPay = totalHours * employee.hourly_rate;

    return {
      employee,
      entries: entriesWithHours,
      totalHours,
      grossPay,
    };
  }, [employee, timeEntries, payPeriodStart, payPeriodEnd]);

  if (role === 'employee' && profile?.staff_id && staffRecordId && profile.staff_id !== staffRecordId) {
    return <Navigate to={`${pathPrefix}/staff-management`} replace />;
  }

  const backTarget = role === 'employee' ? `${pathPrefix}/staff-management` : `${pathPrefix}/reports/payroll`;
  const backLabel = role === 'employee' ? t('timesheet.backToProfile') : t('employeePayroll.backToPayroll');

  if (!settingsLoading && (!employee || !payrollData)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Button variant="ghost" onClick={() => navigate(backTarget)} className="mb-4">
            <ChevronLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t('employeePayroll.employeeNotFound')}</h1>
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
    <div className="space-y-6">
      <div>
        <Button variant="ghost" onClick={() => navigate(backTarget)} className="mb-4">
          <ChevronLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate(`${pathPrefix}/reports/payroll/staff/${employee.id}/timesheet`, {
              state: {
                payPeriodStart: payPeriodStart.toISOString(),
                payPeriodEnd: payPeriodEnd.toISOString()
              }
            })}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {t('employeePayroll.viewTimesheet')}
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            {t('employeePayroll.payrollSummary')}
          </CardTitle>
          <CardDescription>
            {t('employeePayroll.weekOf')} {format(payPeriodStart, 'MMMM d')} - {format(payPeriodEnd, 'd, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{t('payroll.hourlyRate')}</p>
              <p className="text-2xl font-bold">${employee.hourly_rate}/hr</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{t('payroll.hoursWorked')}</p>
              <p className="text-2xl font-bold">{payrollData.totalHours.toFixed(1)}h</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{t('payroll.totalPay')}</p>
              <p className="text-2xl font-bold">${payrollData.grossPay.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{t('employeePayroll.timeEntries')}</p>
              <p className="text-2xl font-bold">{payrollData.entries.length}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{t('timesheet.grossPayTaxNote')}</p>
        </CardContent>
      </Card>

      {/* Timekeeping Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            {t('employeePayroll.timekeepingRecords')}
          </CardTitle>
          <CardDescription>
            {t('employeePayroll.timekeepingDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payrollData.entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('employeePayroll.noTimeEntries')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">{t('employeePayroll.table.date')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('payroll.clockIn')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('payroll.clockOut')}</th>
                    <th className="text-right py-3 px-4 font-medium">{t('employeePayroll.table.hours')}</th>
                    <th className="text-right py-3 px-4 font-medium">{t('employeePayroll.table.pay')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollData.entries.map((entry, index) => (
                    <tr key={entry.id || index} className="border-b border-border hover:bg-secondary/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(entry.clock_in), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {format(new Date(entry.clock_in), 'h:mm a')}
                      </td>
                      <td className="py-3 px-4">
                        {entry.clock_out ? format(new Date(entry.clock_out), 'h:mm a') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {entry.hours.toFixed(1)}h
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        ${entry.pay.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/50">
                    <td colSpan={3} className="py-3 px-4 font-semibold">{t('employeePayroll.total')}</td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {payrollData.totalHours.toFixed(1)}h
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      ${payrollData.grossPay.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {t('employeePayroll.employeeInformation')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('employeePayroll.employee.name')}</p>
              <p className="text-lg font-semibold">{employee.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('employeePayroll.employee.role')}</p>
              <p className="text-lg font-semibold capitalize">{employee.role}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('employeePayroll.employee.email')}</p>
              <p className="text-lg">{employee.email || t('common.na')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('employeePayroll.employee.phone')}</p>
              <p className="text-lg">{employee.phone ? formatPhoneNumber(employee.phone) : t('common.na')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('employeePayroll.employee.status')}</p>
              <p className="text-lg capitalize">{employee.status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('employeePayroll.employee.hourlyRate')}</p>
              <p className="text-lg font-semibold">${employee.hourly_rate}/hr</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </PawLoadedContent>
  );
}
