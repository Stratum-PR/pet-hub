import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, Dog, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { useBusinessId } from '@/hooks/useBusinessId';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { format, startOfDay, isSameDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/translations';

export function BusinessDashboard() {
  const navigate = useNavigate();
  const businessId = useBusinessId();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalPets: 0,
    todayAppointments: 0,
    totalRevenue: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const today = startOfDay(new Date());
        
        // Check if business_id column exists in clients table
        let useBusinessId = false;
        if (businessId) {
          try {
            const testQuery = await supabase
              .from('clients')
              .select('business_id')
              .limit(1);
            useBusinessId = !testQuery.error;
          } catch (e) {
            useBusinessId = false;
          }
        }

        // CRITICAL: Fetch clients count (customers table was merged into clients)
        let clientsQuery = supabase
          .from('clients')
          .select('*', { count: 'exact', head: true });
        if (useBusinessId && businessId) {
          clientsQuery = clientsQuery.eq('business_id', businessId);
        }
        const { count: customersCount } = await clientsQuery;

        // Fetch pets count
        let petsQuery = supabase
          .from('pets')
          .select('*', { count: 'exact', head: true });
        if (useBusinessId && businessId) {
          petsQuery = petsQuery.eq('business_id', businessId);
        }
        const { count: petsCount } = await petsQuery;

        // CRITICAL: Fetch today's appointments with clients (not customers)
        // Try with joins first, fallback to simple query if joins fail
        let appointmentsQuery = supabase
          .from('appointments')
          .select('*')
          .eq('appointment_date', format(today, 'yyyy-MM-dd'))
          .order('start_time', { ascending: true });
        
        if (useBusinessId && businessId) {
          appointmentsQuery = appointmentsQuery.eq('business_id', businessId);
        }
        
        // Try to add joins, but fallback if they fail
        let appointments;
        try {
          const { data, error } = await supabase
            .from('appointments')
            .select(`
              *,
              clients:client_id (first_name, last_name, name),
              pets:pet_id (name),
              services:service_id (name)
            `)
            .eq('appointment_date', format(today, 'yyyy-MM-dd'))
            .order('start_time', { ascending: true });
          
          if (error && (error.message?.includes('relationship') || error.message?.includes('client_id'))) {
            // Joins failed, use simple query
            appointments = await appointmentsQuery;
          } else {
            appointments = { data, error };
          }
        } catch (e) {
          // Joins failed, use simple query
          appointments = await appointmentsQuery;
        }
        
        const appointmentsData = appointments?.data || [];

        // Calculate revenue (from completed appointments)
        let revenueQuery = supabase
          .from('appointments')
          .select('total_price')
          .eq('status', 'completed');
        if (useBusinessId && businessId) {
          revenueQuery = revenueQuery.eq('business_id', businessId);
        }
        const { data: completedAppointments } = await revenueQuery;

        const revenue = completedAppointments?.reduce(
          (sum, apt) => sum + (apt.total_price || 0),
          0
        ) || 0;

        setStats({
          totalCustomers: customersCount || 0,
          totalPets: petsCount || 0,
          todayAppointments: appointmentsData?.length || 0,
          totalRevenue: revenue,
        });

        setTodayAppointments(appointmentsData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [businessId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/20 to-background rounded-2xl">
        <div className="p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
            {t('dashboard.welcome')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t('dashboard.overview')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => navigate('/app/customers')} className="cursor-pointer">
          <StatCard
            title={t('dashboard.totalClients')}
            value={stats.totalCustomers}
            icon={Users}
            description={t('dashboard.registeredClients')}
          />
        </div>
        <div onClick={() => navigate('/app/pets')} className="cursor-pointer">
          <StatCard
            title={t('dashboard.totalPets')}
            value={stats.totalPets}
            icon={Dog}
            description={t('dashboard.petCountDescription', { dogs: 0, cats: 0 })}
          />
        </div>
        <StatCard
          title={t('dashboard.today')}
          value={stats.todayAppointments}
          icon={Calendar}
          description={t('dashboard.appointments')}
        />
        <div onClick={() => navigate('/app/reports')} className="cursor-pointer">
          <StatCard
            title={t('dashboard.revenue')}
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            description={t('dashboard.totalEarned')}
          />
        </div>
      </div>

      {/* Today's Appointments */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {t('dashboard.todaysAppointments')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t('dashboard.noAppointmentsToday')}
            </p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((appointment) => {
                const customer = appointment.clients; // CRITICAL: Use clients (not customers)
                const pet = appointment.pets;
                const service = appointment.services;
                return (
                  <div
                    key={appointment.id}
                    onClick={() => navigate('/app/appointments')}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{pet?.name || t('common.unknownPet')}</p>
                        <Badge
                          variant={
                            appointment.status === 'completed'
                              ? 'default'
                              : appointment.status === 'canceled'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {appointment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {appointment.start_time || 'N/A'} •{' '}
                        {customer
                          ? (customer.first_name && customer.last_name
                              ? `${customer.first_name} ${customer.last_name}`
                              : customer.name || t('common.unknownClient'))
                          : t('common.unknownClient')}
                      </p>
                      {service && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {service.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        ${appointment.total_price?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
