import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useTransactions } from '@/hooks/useTransactions';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { t } from '@/lib/translations';

const SALE_STATUSES = ['paid', 'partial'];
const REVENUE_PERIOD_DAYS = 30;

export function BusinessReports() {
  const businessId = useBusinessId();
  const { transactions } = useTransactions();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAppointments: 0,
    totalClients: 0,
    totalPets: 0,
  });
  const [petDistribution, setPetDistribution] = useState<any[]>([]);
  const [weeklyRegistrations, setWeeklyRegistrations] = useState<any[]>([]);

  const sales = useMemo(
    () => transactions.filter((t) => SALE_STATUSES.includes(t.status)),
    [transactions]
  );

  const totalRevenue = useMemo(() => {
    const periodStart = subDays(new Date(), REVENUE_PERIOD_DAYS);
    const cents = sales
      .filter((t) => new Date(t.created_at) >= periodStart)
      .reduce((sum, t) => sum + t.total, 0);
    return cents / 100;
  }, [sales]);

  const revenueData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(new Date(), 6 - i);
      const dayStart = startOfDay(day);
      const dayRevenueCents = sales
        .filter((t) => startOfDay(new Date(t.created_at)).getTime() === dayStart.getTime())
        .reduce((sum, t) => sum + t.total, 0);
      return {
        date: format(day, 'MMM d'),
        revenue: dayRevenueCents / 100,
      };
    });
  }, [sales]);

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
      const { count: appointmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      const { data: pets } = await supabase
        .from('pets')
        .select('species, created_at')
        .eq('business_id', businessId);

      const petSpeciesCount: Record<string, number> = {};
      pets?.forEach(pet => {
        petSpeciesCount[pet.species] = (petSpeciesCount[pet.species] || 0) + 1;
      });
      const petDist = Object.entries(petSpeciesCount).map(([species, count]) => ({
        name: species.charAt(0).toUpperCase() + species.slice(1),
        value: count,
      }));

      const weeklyRegs = Array.from({ length: 4 }, (_, i) => {
        const weekStart = subDays(new Date(), (3 - i) * 7);
        const weekEnd = subDays(new Date(), (3 - i) * 7 - 6);
        return {
          week: `Week ${4 - i}`,
          clients: 0,
          pets: 0,
        };
      });

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
        totalAppointments: appointmentsCount || 0,
        totalClients: clientsCount || 0,
        totalPets: pets?.length || 0,
      });
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
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('reports.totalRevenueLast30Days')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('reports.revenueFromTransactions')}</p>
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
