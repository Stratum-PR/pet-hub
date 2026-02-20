import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Employee, TimeEntry } from '@/types';
import { format, startOfWeek, endOfWeek, differenceInHours, parseISO, addWeeks, subWeeks, eachDayOfInterval, isSameWeek, startOfDay } from 'date-fns';
import { t } from '@/lib/translations';

interface EmployeeTimesheetProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
}

export function EmployeeTimesheet({ employees, timeEntries }: EmployeeTimesheetProps) {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [currentPayPeriod, setCurrentPayPeriod] = useState(() => {
    const state = location.state as { weekStart?: string } | null;
    const startDate = state?.weekStart ? parseISO(state.weekStart) : startOfWeek(new Date());
    return startOfWeek(startDate);
  });

  const employee = employees.find(emp => emp.id === employeeId);
  // Two-week pay period: start of first week to end of second week
  const payPeriodStart = startOfWeek(currentPayPeriod);
  const payPeriodEnd = endOfWeek(addWeeks(payPeriodStart, 1));
  const payPeriodDays = eachDayOfInterval({ start: payPeriodStart, end: payPeriodEnd });

  const isCurrentPayPeriod = useMemo(() => {
    const now = new Date();
    const currentPeriodStart = startOfWeek(startOfWeek(now));
    return payPeriodStart.getTime() === currentPeriodStart.getTime();
  }, [payPeriodStart]);

  const timesheetData = useMemo(() => {
    if (!employee) return null;

    const empEntries = timeEntries.filter(entry => {
      const entryDate = startOfDay(new Date(entry.clock_in));
      return entry.employee_id === employee.id && entryDate >= startOfDay(payPeriodStart) && entryDate <= startOfDay(payPeriodEnd) && entry.clock_out;
    });

    // Calculate daily totals for each day in the pay period
    const dailyData = payPeriodDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEntries = empEntries.filter(entry => {
        const entryDate = format(startOfDay(new Date(entry.clock_in)), 'yyyy-MM-dd');
        return entryDate === dayStr;
      });

      const dayHours = dayEntries.reduce((sum, entry) => {
        if (!entry.clock_out) return sum;
        return sum + differenceInHours(new Date(entry.clock_out), new Date(entry.clock_in));
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
    };
  }, [employee, timeEntries, payPeriodStart, payPeriodEnd, payPeriodDays]);

  const handlePreviousPayPeriod = () => {
    setCurrentPayPeriod(subWeeks(currentPayPeriod, 2));
  };

  const handleNextPayPeriod = () => {
    setCurrentPayPeriod(addWeeks(currentPayPeriod, 2));
  };

  const handleCurrentPayPeriod = () => {
    setCurrentPayPeriod(startOfWeek(new Date()));
  };

  if (!employee || !timesheetData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/reports/payroll')}
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {t('timesheet.backToPayroll')}
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t('timesheet.employeeNotFound')}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/reports/payroll')}
          className="mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {t('timesheet.backToPayroll')}
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
      </div>

      {/* Pay Period Summary */}
      <Card className="shadow-sm">
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
          <div className="flex items-center justify-end gap-2 mb-4">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{t('timesheet.totalHours')}</p>
              <p className="text-2xl font-bold">{timesheetData.totalHours.toFixed(1)}h</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{t('timesheet.hourlyRate')}</p>
              <p className="text-2xl font-bold">${employee.hourly_rate}/hr</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{t('timesheet.grossPay')}</p>
              <p className="text-2xl font-bold">${timesheetData.grossPay.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Details Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            {t('timesheet.timesheetDetails')}
          </CardTitle>
          <CardDescription>
            {t('timesheet.twoWeekBreakdown')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium">{t('timesheet.dateDay')}</th>
                  <th className="text-right py-3 px-4 font-medium">{t('timesheet.hoursWorked')}</th>
                  <th className="text-right py-3 px-4 font-medium">{t('timesheet.pay')}</th>
                </tr>
              </thead>
              <tbody>
                {timesheetData.dailyData.map((day) => (
                  <tr key={day.dateStr} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium">{format(day.date, 'EEE MMM d')}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {day.hours > 0 ? `${day.hours.toFixed(1)}h` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {day.pay > 0 ? `$${day.pay.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/50">
                  <td className="py-3 px-4 font-semibold">{t('dashboard.totalEarned')}</td>
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
  );
}
