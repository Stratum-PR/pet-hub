import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, ChevronLeft, Clock, Calendar, User, FileText } from 'lucide-react';
import { Employee, TimeEntry } from '@/types';
import { format, startOfWeek, endOfWeek, differenceInHours, parseISO } from 'date-fns';
import { formatPhoneNumber } from '@/lib/phoneFormat';

interface EmployeePayrollProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
}

export function EmployeePayroll({ employees, timeEntries }: EmployeePayrollProps) {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [weekStart, setWeekStart] = useState(() => {
    const state = location.state as { weekStart?: string } | null;
    return state?.weekStart ? parseISO(state.weekStart) : startOfWeek(new Date());
  });

  const employee = employees.find(emp => emp.id === employeeId);
  const weekEnd = endOfWeek(weekStart);

  const payrollData = useMemo(() => {
    if (!employee) return null;

    const empEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.clock_in);
      return entry.employee_id === employee.id && entryDate >= weekStart && entryDate <= weekEnd && entry.clock_out;
    });

    const entriesWithHours = empEntries.map(entry => {
      const hours = differenceInHours(new Date(entry.clock_out!), new Date(entry.clock_in));
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
  }, [employee, timeEntries, weekStart, weekEnd]);

  if (!employee || !payrollData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/reports/payroll')}
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Payroll
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Employee Not Found</h1>
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
          Back to Payroll
        </Button>
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate(`/reports/payroll/employee/${employee.id}/timesheet`, {
              state: {
                weekStart: weekStart.toISOString(),
                weekEnd: weekEnd.toISOString()
              }
            })}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            View Timesheet
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Payroll Summary
          </CardTitle>
          <CardDescription>
            Week of {format(weekStart, 'MMMM d')} - {format(weekEnd, 'd, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Hours</p>
              <p className="text-2xl font-bold">{payrollData.totalHours.toFixed(1)}h</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Hourly Rate</p>
              <p className="text-2xl font-bold">${employee.hourly_rate}/hr</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Gross Pay</p>
              <p className="text-2xl font-bold">${payrollData.grossPay.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Time Entries</p>
              <p className="text-2xl font-bold">{payrollData.entries.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timekeeping Records */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Timekeeping Records
          </CardTitle>
          <CardDescription>
            Detailed breakdown of clock in/out times and hours worked
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payrollData.entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No time entries for this week</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Clock In</th>
                    <th className="text-left py-3 px-4 font-medium">Clock Out</th>
                    <th className="text-right py-3 px-4 font-medium">Hours</th>
                    <th className="text-right py-3 px-4 font-medium">Pay</th>
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
                    <td colSpan={3} className="py-3 px-4 font-semibold">Total</td>
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
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Employee Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="text-lg font-semibold">{employee.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="text-lg font-semibold capitalize">{employee.role}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-lg">{employee.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="text-lg">{employee.phone ? formatPhoneNumber(employee.phone) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-lg capitalize">{employee.status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hourly Rate</p>
              <p className="text-lg font-semibold">${employee.hourly_rate}/hr</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
