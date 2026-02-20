import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DollarSign, ChevronLeft, ChevronRight, Clock, Edit } from 'lucide-react';
import { Employee, TimeEntry } from '@/types';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, differenceInHours, addWeeks, subWeeks, startOfDay } from 'date-fns';
import { t } from '@/lib/translations';

interface PayrollProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
  onUpdateTimeEntry: (id: string, entryData: Partial<TimeEntry>) => Promise<TimeEntry | null>;
  onAddTimeEntry: (employeeId: string, clockIn: string, clockOut?: string) => Promise<TimeEntry | null>;
}

export function Payroll({ employees, timeEntries, onUpdateTimeEntry, onAddTimeEntry }: PayrollProps) {
  const navigate = useNavigate();
  const [currentPayPeriod, setCurrentPayPeriod] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editingDay, setEditingDay] = useState<{ date: Date; entry?: TimeEntry } | null>(null);
  const [editFormData, setEditFormData] = useState({
    clock_in: '',
    clock_out: '',
  });

  // Two-week pay period: start of first week to end of second week
  const payPeriodStart = startOfWeek(currentPayPeriod);
  const payPeriodEnd = endOfWeek(addWeeks(payPeriodStart, 1));
  const payPeriodDays = eachDayOfInterval({ start: payPeriodStart, end: payPeriodEnd });

  const payrollData = useMemo(() => {
    return employees.map(emp => {
      const empEntries = timeEntries.filter(entry => {
        const entryDate = startOfDay(new Date(entry.clock_in));
        return entry.employee_id === emp.id && entryDate >= startOfDay(payPeriodStart) && entryDate <= startOfDay(payPeriodEnd) && entry.clock_out;
      });
      
      const totalHours = empEntries.reduce((sum, entry) => {
        if (!entry.clock_out) return sum;
        return sum + differenceInHours(new Date(entry.clock_out), new Date(entry.clock_in));
      }, 0);
      
      return {
        ...emp,
        hoursWorked: totalHours,
        grossPay: totalHours * emp.hourly_rate,
        entries: empEntries,
      };
    });
  }, [employees, timeEntries, payPeriodStart, payPeriodEnd]);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-end">
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            {t('payroll.payPeriodSummary')}
          </CardTitle>
          <CardDescription>
            {format(payPeriodStart, 'MMMM d')} - {format(payPeriodEnd, 'd, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium">{t('payroll.employee')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('payroll.role')}</th>
                  <th className="text-right py-3 px-4 font-medium">{t('payroll.hoursWorked')}</th>
                  <th className="text-right py-3 px-4 font-medium">{t('payroll.hourlyRate')}</th>
                  <th className="text-right py-3 px-4 font-medium">{t('payroll.totalPay')}</th>
                </tr>
              </thead>
              <tbody>
                {payrollData.map(emp => (
                  <tr key={emp.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="py-3 px-4 font-medium">{emp.name}</td>
                    <td className="py-3 px-4 capitalize text-muted-foreground">{emp.role}</td>
                    <td className="py-3 px-4 text-right font-semibold">{emp.hoursWorked.toFixed(1)}h</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">${emp.hourly_rate}/hr</td>
                    <td className="py-3 px-4 text-right font-semibold">${emp.grossPay.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/50">
                  <td colSpan={2} className="py-3 px-4 font-semibold">{t('dashboard.totalEarned')}</td>
                  <td className="py-3 px-4 text-right font-semibold">
                    {payrollData.reduce((sum, e) => sum + e.hoursWorked, 0).toFixed(1)}h
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

      {/* Employee Timesheet Section */}
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
