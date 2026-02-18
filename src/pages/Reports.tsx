import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, DollarSign, Clock, Users, Dog, Calendar } from 'lucide-react';
import { Client, Pet, Employee, TimeEntry, Appointment } from '@/types';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInHours, startOfDay } from 'date-fns';
import { t } from '@/lib/translations';
import { useTransactions } from '@/hooks/useTransactions';

interface ReportsProps {
  clients: Client[];
  pets: Pet[];
  employees: Employee[];
  timeEntries: TimeEntry[];
  appointments: Appointment[];
}

const COLORS = ['hsl(168, 60%, 45%)', 'hsl(200, 55%, 55%)', 'hsl(145, 50%, 45%)', 'hsl(180, 45%, 50%)'];

const SALE_STATUSES = ['paid', 'partial'];
const REVENUE_PERIOD_DAYS = 30;

export function Reports({ clients, pets, employees, timeEntries, appointments }: ReportsProps) {
  const { transactions } = useTransactions();
  const sales = useMemo(
    () => transactions.filter((t) => SALE_STATUSES.includes(t.status)),
    [transactions]
  );

  // Total revenue from transactions (last 30 days)
  const totalRevenue = useMemo(() => {
    const periodStart = subDays(new Date(), REVENUE_PERIOD_DAYS);
    const cents = sales
      .filter((t) => new Date(t.created_at) >= periodStart)
      .reduce((sum, t) => sum + t.total, 0);
    return cents / 100;
  }, [sales]);

  // Revenue by day from transactions (last 7 days)
  const revenueData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
    return last7Days.map((day) => {
      const dayStart = startOfDay(day);
      const dayRevenueCents = sales
        .filter((t) => startOfDay(new Date(t.created_at)).getTime() === dayStart.getTime())
        .reduce((sum, t) => sum + t.total, 0);
      return {
        day: format(day, 'MMM d'),
        revenue: dayRevenueCents / 100,
      };
    });
  }, [sales]);

  // Species distribution
  const speciesData = useMemo(() => {
    const counts = { dog: 0, cat: 0, other: 0 };
    pets.forEach(pet => counts[pet.species]++);
    return [
      { name: t('pets.dogs'), value: counts.dog },
      { name: t('pets.cats'), value: counts.cat },
      { name: t('pets.other'), value: counts.other },
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
      { name: t('reports.scheduled'), value: stats.scheduled },
      { name: t('reports.completed'), value: stats.completed },
      { name: t('reports.inProgress'), value: stats['in-progress'] },
      { name: t('reports.cancelled'), value: stats.cancelled },
    ].filter(d => d.value > 0);
  }, [appointments]);

  const totalHoursWorked = employeeHours.reduce((sum, e) => sum + e.hours, 0);
  const totalPayroll = employeeHours.reduce((sum, e) => sum + e.earnings, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('reports.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('reports.description')}
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
                <p className="text-sm text-muted-foreground">{t('reports.totalRevenueLast30Days')}</p>
                <p className="text-2xl font-bold">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('reports.revenueFromTransactions')}</p>
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
                <p className="text-sm text-muted-foreground">{t('reports.hoursWorked')}</p>
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
                <p className="text-sm text-muted-foreground">{t('reports.payrollWeek')}</p>
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
                <p className="text-sm text-muted-foreground">{t('dashboard.appointments')}</p>
                <p className="text-2xl font-bold">{appointments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart - from transactions */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t('reports.revenueLast7Days')}
            </CardTitle>
            <CardDescription>{t('reports.revenueDescription')}</CardDescription>
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
              {t('reports.speciesDistribution')}
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
              <p className="text-center text-muted-foreground py-16">{t('reports.noPetData')}</p>
            )}
          </CardContent>
        </Card>

        {/* Weekly Registrations */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t('reports.weeklyRegistrations')}</CardTitle>
            <CardDescription>{t('reports.newClientsPetsThisWeek')}</CardDescription>
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
                <Bar dataKey="clients" fill="hsl(168, 60%, 45%)" name={t('reports.clients')} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pets" fill="hsl(200, 55%, 55%)" name={t('reports.pets')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Employee Hours */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t('reports.employeeHours')}</CardTitle>
            <CardDescription>{t('reports.hoursWorkedByStaff')}</CardDescription>
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
                      if (name === 'hours') return [`${value}h`, t('reports.hours')];
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
              <p className="text-center text-muted-foreground py-16">{t('reports.noEmployeeData')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}