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
    // DIAGNOSTIC: Log environment variables
    console.log('=== BUSINESS DASHBOARD DIAGNOSTIC ===');
    console.log('Environment:', import.meta.env.MODE);
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING');
    console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'SET' : 'MISSING');
    console.log('Business ID:', businessId || 'NULL');
    console.log('Timestamp:', new Date().toISOString());

    // If we don't yet have a businessId, stop loading
    if (!businessId) {
      console.warn('[BusinessDashboard] No businessId available – skipping dashboard queries');
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const today = startOfDay(new Date());
        console.log('[BusinessDashboard] Fetching dashboard data for business:', businessId);

        // CRITICAL: Fetch clients count - ALWAYS filter by business_id for multi-tenancy
        const startTime = performance.now();
        const { count: customersCount, error: clientsError } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId);
        const clientsTime = performance.now() - startTime;

        console.log('[BusinessDashboard] Clients query:', {
          count: customersCount,
          error: clientsError?.message,
          time: `${clientsTime.toFixed(2)}ms`
        });

        if (clientsError) {
          console.error('[BusinessDashboard] Clients query error:', {
            code: clientsError.code,
            message: clientsError.message,
            details: clientsError.details,
            hint: clientsError.hint
          });
        }

        // Fetch pets count - ALWAYS filter by business_id
        const petsStartTime = performance.now();
        const { count: petsCount, error: petsError } = await supabase
          .from('pets')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId);
        const petsTime = performance.now() - petsStartTime;

        console.log('[BusinessDashboard] Pets query:', {
          count: petsCount,
          error: petsError?.message,
          time: `${petsTime.toFixed(2)}ms`
        });

        if (petsError) {
          console.error('[BusinessDashboard] Pets query error:', {
            code: petsError.code,
            message: petsError.message
          });
        }

        // CRITICAL: Fetch today's appointments with clients - ALWAYS filter by business_id
        const appointmentsStartTime = performance.now();
        const { data: appointments, error: appointmentsError } = await supabase
          .from('appointments')
          .select(`
            *,
            clients:client_id (first_name, last_name),
            pets:pet_id (name),
            services:service_id (name)
          `)
          .eq('business_id', businessId)
          .eq('appointment_date', format(today, 'yyyy-MM-dd'))
          .order('start_time', { ascending: true });
        const appointmentsTime = performance.now() - appointmentsStartTime;

        console.log('[BusinessDashboard] Appointments query:', {
          count: appointments?.length || 0,
          error: appointmentsError?.message,
          time: `${appointmentsTime.toFixed(2)}ms`
        });

        if (appointmentsError) {
          console.error('[BusinessDashboard] Appointments query error:', {
            code: appointmentsError.code,
            message: appointmentsError.message,
            details: appointmentsError.details
          });
        }

        // Calculate revenue (from completed appointments) - ALWAYS filter by business_id
        const revenueStartTime = performance.now();
        const { data: completedAppointments, error: revenueError } = await supabase
          .from('appointments')
          .select('total_price')
          .eq('business_id', businessId)
          .eq('status', 'completed');
        const revenueTime = performance.now() - revenueStartTime;

        console.log('[BusinessDashboard] Revenue query:', {
          count: completedAppointments?.length || 0,
          error: revenueError?.message,
          time: `${revenueTime.toFixed(2)}ms`
        });

        const revenue = completedAppointments?.reduce(
          (sum, apt) => sum + (apt.total_price || 0),
          0
        ) || 0;

        console.log('[BusinessDashboard] Final stats:', {
          totalCustomers: customersCount || 0,
          totalPets: petsCount || 0,
          todayAppointments: appointments?.length || 0,
          totalRevenue: revenue
        });

        setStats({
          totalCustomers: customersCount || 0,
          totalPets: petsCount || 0,
          todayAppointments: appointments?.length || 0,
          totalRevenue: revenue,
        });

        setTodayAppointments(appointments || []);
      } catch (error) {
        console.error('[BusinessDashboard] Unexpected error fetching dashboard data:', error);
        if (error instanceof Error) {
          console.error('[BusinessDashboard] Error stack:', error.stack);
        }
      } finally {
        setLoading(false);
        console.log('=== BUSINESS DASHBOARD DIAGNOSTIC END ===');
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
        <div onClick={() => navigate('/app/clients')} className="cursor-pointer">
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
                const client = appointment.clients;
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
                        {client
                          ? `${client.first_name || ''} ${client.last_name || ''}`.trim() || t('common.unknownClient')
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
