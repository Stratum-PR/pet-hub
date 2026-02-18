import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useBusinessId } from '@/hooks/useBusinessId';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { t } from '@/lib/translations';

export function BusinessReports() {
  const businessId = useBusinessId();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalAppointments: 0,
    totalClients: 0,
    totalPets: 0,
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [petDistribution, setPetDistribution] = useState<any[]>([]);
  const [weeklyRegistrations, setWeeklyRegistrations] = useState<any[]>([]);

  useEffect(() => {
    if (!businessId) {
      console.warn('[BusinessReports] No businessId available – skipping reports queries');
      setLoading(false);
      return;
    }

    fetchReportData();
  }, [businessId]);

  const fetchReportData = async () => {
    if (!businessId) return;

    try {
      // Fetch completed appointments for revenue
      const { data: appointments } = await supabase
        .from('appointments')
        .select('total_price, appointment_date, status')
        .eq('business_id', businessId)
        .eq('status', 'completed');

      // Fetch all appointments count
      const { count: appointmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      // Fetch clients count
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      // Fetch pets count and distribution
      const { data: pets } = await supabase
        .from('pets')
        .select('species, created_at')
        .eq('business_id', businessId);

      // Calculate revenue
      const totalRevenue = appointments?.reduce((sum, apt) => sum + (apt.total_price || 0), 0) || 0;

      // Calculate revenue by day (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        return {
          date: format(date, 'MMM d'),
          revenue: 0,
        };
      });

      appointments?.forEach(apt => {
        if (apt.appointment_date) {
          const aptDate = new Date(apt.appointment_date);
          const dayIndex = last7Days.findIndex(d => {
            const dDate = new Date();
            dDate.setDate(dDate.getDate() - (6 - last7Days.indexOf(d)));
            return format(aptDate, 'MMM d') === format(dDate, 'MMM d');
          });
          if (dayIndex >= 0) {
            last7Days[dayIndex].revenue += apt.total_price || 0;
          }
        }
      });

      // Calculate pet distribution
      const petSpeciesCount: Record<string, number> = {};
      pets?.forEach(pet => {
        petSpeciesCount[pet.species] = (petSpeciesCount[pet.species] || 0) + 1;
      });
      const petDist = Object.entries(petSpeciesCount).map(([species, count]) => ({
        name: species.charAt(0).toUpperCase() + species.slice(1),
        value: count,
      }));

      // Calculate weekly registrations (last 4 weeks)
      const weeklyRegs = Array.from({ length: 4 }, (_, i) => {
        const weekStart = subDays(new Date(), (3 - i) * 7);
        const weekEnd = subDays(new Date(), (3 - i) * 7 - 6);
        return {
          week: `Week ${4 - i}`,
          clients: 0,
          pets: 0,
        };
      });

      // Count clients by week
      const { data: clientsByWeek } = await supabase
        .from('clients')
        .select('created_at')
        .eq('business_id', businessId);

      clientsByWeek?.forEach(c => {
        const created = new Date(c.created_at);
        weeklyRegs.forEach((week, index) => {
          const weekStart = subDays(new Date(), (3 - index) * 7);
          const weekEnd = subDays(new Date(), (3 - index) * 7 - 6);
          if (created >= weekStart && created <= weekEnd) {
            week.clients += 1;
          }
        });
      });

      // Count pets by week
      pets?.forEach(pet => {
        const created = new Date(pet.created_at);
        weeklyRegs.forEach((week, index) => {
          const weekStart = subDays(new Date(), (3 - index) * 7);
          const weekEnd = subDays(new Date(), (3 - index) * 7 - 6);
          if (created >= weekStart && created <= weekEnd) {
            week.pets += 1;
          }
        });
      });

      setStats({
        totalRevenue,
        totalAppointments: appointmentsCount || 0,
        totalClients: clientsCount || 0,
        totalPets: pets?.length || 0,
      });
      setRevenueData(last7Days);
      setPetDistribution(petDist);
      setWeeklyRegistrations(weeklyRegs);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('reports.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('reports.description')}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('reports.totalRevenue')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('reports.totalAppointments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAppointments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('reports.totalClients')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('reports.totalPets')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPets}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.revenueLast7Days')}</CardTitle>
            <CardDescription>{t('reports.revenueDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#0088FE" name={t('reports.revenue')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.petDistribution')}</CardTitle>
            <CardDescription>{t('reports.petDistributionDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={petDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {petDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('reports.weeklyRegistrations')}</CardTitle>
            <CardDescription>{t('reports.weeklyRegistrationsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyRegistrations}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="clients" fill="#0088FE" name={t('reports.clients')} />
                <Bar dataKey="pets" fill="#00C49F" name={t('reports.pets')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
