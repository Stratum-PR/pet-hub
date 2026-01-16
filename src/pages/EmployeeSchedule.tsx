import { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfDay, differenceInHours, differenceInMinutes } from 'date-fns';
import { Employee, TimeEntry } from '@/types';
import { cn } from '@/lib/utils';

interface EmployeeScheduleProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
}

export function EmployeeSchedule({ employees, timeEntries }: EmployeeScheduleProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Get time entries for the selected week
  const weekEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      const entryDate = startOfDay(new Date(entry.clock_in));
      return entryDate >= startOfDay(weekStart) && entryDate <= startOfDay(weekEnd);
    });
  }, [timeEntries, weekStart, weekEnd]);

  // Group entries by employee and day
  const scheduleData = useMemo(() => {
    const data: Record<string, Record<string, TimeEntry[]>> = {};
    
    employees.forEach(emp => {
      data[emp.id] = {};
      weekDays.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        data[emp.id][dayStr] = weekEntries.filter(entry => {
          const entryDate = format(startOfDay(new Date(entry.clock_in)), 'yyyy-MM-dd');
          return entry.employee_id === emp.id && entryDate === dayStr;
        });
      });
    });
    
    return data;
  }, [employees, weekDays, weekEntries]);

  const getTotalHoursForDay = (employeeId: string, day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayEntries = scheduleData[employeeId]?.[dayStr] || [];
    
    return dayEntries.reduce((total, entry) => {
      if (!entry.clock_out) return total;
      const hours = differenceInHours(new Date(entry.clock_out), new Date(entry.clock_in));
      const minutes = differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) % 60;
      return total + hours + (minutes / 60);
    }, 0);
  };

  const getTotalHoursForWeek = (employeeId: string) => {
    return weekDays.reduce((total, day) => {
      return total + getTotalHoursForDay(employeeId, day);
    }, 0);
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a');
  };

  const getStatusColor = (entry: TimeEntry) => {
    if (!entry.clock_out) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Schedule</h1>
          <p className="text-muted-foreground mt-1">
            View all employees' schedules in one calendar
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={viewMode} onValueChange={(value: 'week' | 'month') => setViewMode(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week View</SelectItem>
              <SelectItem value="month">Month View</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </div>

        {/* Schedule Table */}
        <div className="lg:col-span-3">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold sticky left-0 bg-background z-10 min-w-[150px]">
                        Employee
                      </th>
                      {weekDays.map(day => (
                        <th
                          key={format(day, 'yyyy-MM-dd')}
                          className={cn(
                            "text-center p-3 font-semibold min-w-[120px]",
                            isSameDay(day, new Date()) && "bg-primary/10"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">
                              {format(day, 'EEE')}
                            </span>
                            <span className="text-sm">
                              {format(day, 'MMM d')}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="text-center p-3 font-semibold min-w-[80px]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(emp => emp.status === 'active').map(employee => {
                      const totalHours = getTotalHoursForWeek(employee.id);
                      return (
                        <tr key={employee.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 sticky left-0 bg-background z-10 font-medium">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              {employee.name}
                            </div>
                          </td>
                          {weekDays.map(day => {
                            const dayStr = format(day, 'yyyy-MM-dd');
                            const dayEntries = scheduleData[employee.id]?.[dayStr] || [];
                            const dayHours = getTotalHoursForDay(employee.id, day);
                            
                            return (
                              <td
                                key={dayStr}
                                className={cn(
                                  "p-2 text-center text-sm",
                                  isSameDay(day, new Date()) && "bg-primary/5"
                                )}
                              >
                                {dayEntries.length > 0 ? (
                                  <div className="space-y-1">
                                    {dayEntries.map(entry => (
                                      <div
                                        key={entry.id}
                                        className={cn(
                                          "px-2 py-1 rounded text-xs",
                                          getStatusColor(entry)
                                        )}
                                      >
                                        <div className="font-medium">
                                          {formatTime(entry.clock_in)}
                                        </div>
                                        {entry.clock_out ? (
                                          <div className="text-xs opacity-80">
                                            {formatTime(entry.clock_out)}
                                          </div>
                                        ) : (
                                          <Badge variant="outline" className="text-xs mt-1">
                                            Active
                                          </Badge>
                                        )}
                                      </div>
                                    ))}
                                    {dayHours > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {dayHours.toFixed(1)}h
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-3 text-center font-semibold">
                            {totalHours > 0 ? (
                              <span className="text-primary">{totalHours.toFixed(1)}h</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {employees.filter(emp => emp.status === 'active').length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No active employees found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
