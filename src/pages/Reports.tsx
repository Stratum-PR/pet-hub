import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, DollarSign, Clock, Users, Dog, Calendar } from 'lucide-react';
import { Client, Pet, Employee, TimeEntry, Appointment } from '@/types';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInHours, parseISO } from 'date-fns';

interface ReportsProps {
  clients: Client[];
  pets: Pet[];
  employees: Employee[];
  timeEntries: TimeEntry[];
  appointments: Appointment[];
}

const COLORS = ['hsl(168, 60%, 45%)', 'hsl(200, 55%, 55%)', 'hsl(145, 50%, 45%)', 'hsl(180, 45%, 50%)'];

export function Reports({ clients, pets, employees, timeEntries, appointments }: ReportsProps) {
  // Species distribution
  const speciesData = useMemo(() => {
    const counts = { dog: 0, cat: 0, other: 0 };
    pets.forEach(pet => counts[pet.species]++);
    return [
      { name: 'Dogs', value: counts.dog },
      { name: 'Cats', value: counts.cat },
      { name: 'Other', value: counts.other },
    ].filter(d => d.value > 0);
  }, [pets]);

  // Weekly registrations
  const weeklyData = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = endOfWeek(new Date());
    const days = eachDayOfInterval({ start, end });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const clientCount = clients.filter(c => 
        format(new Date(c.created_at), 'yyyy-MM-dd') === dayStr
      ).length;
      const petCount = pets.filter(p => 
        format(new Date(p.created_at), 'yyyy-MM-dd') === dayStr
      ).length;
      
      return {
        day: format(day, 'EEE'),
        clients: clientCount,
        pets: petCount,
      };
    });
  }, [clients, pets]);

  // Employee hours this week
  const employeeHours = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    return employees.filter(e => e.status === 'active').map(emp => {
      const empEntries = timeEntries.filter(entry => {
        const entryDate = new Date(entry.clock_in);
        return entry.employee_id === emp.id && entryDate >= weekStart && entry.clock_out;
      });
      
      const totalHours = empEntries.reduce((sum, entry) => {
        if (!entry.clock_out) return sum;
        return sum + differenceInHours(new Date(entry.clock_out), new Date(entry.clock_in));
      }, 0);
      
      return {
        name: emp.name.split(' ')[0],
        hours: totalHours,
        rate: emp.hourly_rate,
        earnings: totalHours * emp.hourly_rate,
      };
    });
  }, [employees, timeEntries]);

  // Appointment status
  const appointmentStats = useMemo(() => {
    const stats = { scheduled: 0, completed: 0, cancelled: 0, 'in-progress': 0 };
    appointments.forEach(apt => stats[apt.status]++);
    return [
      { name: 'Scheduled', value: stats.scheduled },
      { name: 'Completed', value: stats.completed },
      { name: 'In Progress', value: stats['in-progress'] },
      { name: 'Cancelled', value: stats.cancelled },
    ].filter(d => d.value > 0);
  }, [appointments]);

  // Revenue by day (last 7 days)
  const revenueData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
    
    return last7Days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayRevenue = appointments
        .filter(a => a.status === 'completed' && format(new Date(a.scheduled_date), 'yyyy-MM-dd') === dayStr)
        .reduce((sum, a) => sum + (a.price || 0), 0);
      
      return {
        day: format(day, 'MMM d'),
        revenue: dayRevenue,
      };
    });
  }, [appointments]);

  const totalRevenue = appointments
    .filter(a => a.status === 'completed')
    .reduce((sum, a) => sum + (a.price || 0), 0);

  const totalHoursWorked = employeeHours.reduce((sum, e) => sum + e.hours, 0);
  const totalPayroll = employeeHours.reduce((sum, e) => sum + e.earnings, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Business insights and performance metrics
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hours Worked</p>
                <p className="text-2xl font-bold">{totalHoursWorked}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payroll (Week)</p>
                <p className="text-2xl font-bold">${totalPayroll.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Appointments</p>
                <p className="text-2xl font-bold">{appointments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Revenue (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  formatter={(value) => [`$${value}`, 'Revenue']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(168, 60%, 45%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(168, 60%, 45%)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pet Distribution */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dog className="w-5 h-5 text-primary" />
              Pet Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {speciesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={speciesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {speciesData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-16">No pet data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Weekly Registrations */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Weekly Registrations</CardTitle>
            <CardDescription>New clients and pets this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="clients" fill="hsl(168, 60%, 45%)" name="Clients" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pets" fill="hsl(200, 55%, 55%)" name="Pets" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Employee Hours */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Employee Hours This Week</CardTitle>
            <CardDescription>Hours worked by active staff</CardDescription>
          </CardHeader>
          <CardContent>
            {employeeHours.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={employeeHours} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'hours') return [`${value}h`, 'Hours'];
                      return [value, name];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="hours" fill="hsl(145, 50%, 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-16">No employee data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}