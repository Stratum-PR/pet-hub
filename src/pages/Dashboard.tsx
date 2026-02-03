import { useNavigate, useParams, Link } from 'react-router-dom';
import { Users, Dog, Calendar, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Client, Pet, Employee, Appointment } from '@/types';
import { format } from 'date-fns';
import { t } from '@/lib/translations';
import { DataDiagnostics } from '@/components/DataDiagnostics';

interface DashboardProps {
  clients: Client[];
  pets: Pet[];
  employees: Employee[];
  appointments: Appointment[];
  onSelectClient?: (clientId: string) => void;
}

export function Dashboard({ clients, pets, employees, appointments, onSelectClient }: DashboardProps) {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const recentClients = clients.slice(0, 5);
  const recentPets = pets.slice(0, 5);

  const dogCount = pets.filter(p => p.species === 'dog').length;
  const catCount = pets.filter(p => p.species === 'cat').length;

  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const todayAppointments = appointments.filter(a => {
    const today = new Date().toDateString();
    return new Date(a.scheduled_date).toDateString() === today;
  }).length;

  const completedAppointments = appointments.filter(a => a.status === 'completed');
  const totalRevenue = completedAppointments.reduce((sum, a) => sum + (a.price || 0), 0);

  const todaysAppointmentsList = appointments.filter(a => {
    const today = new Date().toDateString();
    return new Date(a.scheduled_date).toDateString() === today;
  }).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  const handleClientClick = (clientId: string) => {
    if (onSelectClient) {
      onSelectClient(clientId);
    }
    const target = businessSlug ? `/${businessSlug}/clients` : '/clients';
    navigate(target, {
      state: { selectedClientId: clientId },
      replace: false
    });
  };

  const handlePetClick = (petId: string) => {
    const target = businessSlug ? `/${businessSlug}/pets?highlight=${petId}` : `/pets?highlight=${petId}`;
    navigate(target, { replace: false });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/20 to-background rounded-2xl">
        <div className="p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
            {t('common.welcome')}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div
          onClick={() => {
            const target = businessSlug ? `/${businessSlug}/clients` : '/clients';
            navigate(target);
          }}
          className="cursor-pointer h-full"
        >
          <StatCard
            title={t('dashboard.totalClients')}
            value={clients.length}
            icon={Users}
            description={t('dashboard.registeredClients')}
          />
        </div>
        <div
          onClick={() => {
            const target = businessSlug ? `/${businessSlug}/pets` : '/pets';
            navigate(target);
          }}
          className="cursor-pointer h-full"
        >
          <StatCard
            title={t('dashboard.totalPets')}
            value={pets.length}
            icon={Dog}
            description={`${dogCount} ${t('dashboard.dogs')}, ${catCount} ${t('dashboard.cats')}`}
          />
        </div>
        <div
          onClick={() => {
            const target = businessSlug ? `/${businessSlug}/employee-management` : '/employee-management';
            navigate(target);
          }}
          className="cursor-pointer h-full"
        >
          <StatCard
            title={t('dashboard.activeStaff')}
            value={activeEmployees}
            icon={Clock}
            description={t('dashboard.teamMembers')}
          />
        </div>
        <div className="h-full">
          <StatCard
            title={t('dashboard.today')}
            value={todayAppointments}
            icon={Calendar}
            description={t('dashboard.appointments')}
          />
        </div>
        <div
          onClick={() => {
            const target = businessSlug ? `/${businessSlug}/reports/analytics` : '/reports/analytics';
            navigate(target);
          }}
          className="cursor-pointer h-full"
        >
          <StatCard
            title={t('dashboard.revenue')}
            value={`$${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            description={t('dashboard.totalEarned')}
          />
        </div>
        <div className="h-full">
          <StatCard
            title={t('dashboard.growth')}
            value="+12%"
            icon={TrendingUp}
            description={t('dashboard.vsLastMonth')}
          />
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Today's Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaysAppointmentsList.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No appointments scheduled for today</p>
          ) : (
            <div className="space-y-3">
              {todaysAppointmentsList.map((appointment) => {
                const pet = pets.find(p => p.id === appointment.pet_id);
                const client = pet ? clients.find(c => c.id === pet.client_id) : null;
                const employee = appointment.employee_id ? employees.find(e => e.id === appointment.employee_id) : null;
                return (
                  <div
                    key={appointment.id}
                    onClick={() => {
                      const target = businessSlug ? `/${businessSlug}/appointments` : '/appointments';
                      navigate(target);
                    }}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{pet?.name || t('appointments.unknownPet')}</p>
                        <Badge variant={appointment.status === 'completed' ? 'default' : appointment.status === 'cancelled' ? 'destructive' : 'secondary'}>
                          {appointment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(appointment.scheduled_date), 'h:mm a')} • {client?.name || t('appointments.unknownClient')}
                        {employee && ` • ${employee.name}`}
                      </p>
                      {appointment.service_type && (
                        <p className="text-xs text-muted-foreground mt-1">{appointment.service_type}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        $
                        {typeof appointment.price === 'number'
                          ? appointment.price.toFixed(2)
                          : '0.00'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {t('dashboard.recentClients')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t('dashboard.noClientsYet')}</p>
            ) : (
              <div className="space-y-3">
                {recentClients.map((client) => {
                  const target = businessSlug ? `/${businessSlug}/clients` : '/clients';
                  return (
                    <Link
                      key={client.id}
                      to={target}
                      state={{ selectedClientId: client.id }}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors block"
                    >
                      <div>
                        <p className="font-medium hover:text-primary transition-colors cursor-pointer">{client.name || 'Sin nombre'}</p>
                        <p className="text-sm text-muted-foreground">{client.email || 'Sin email'}</p>
                      </div>
                      <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded">
                        {(() => {
                          const petCount = pets.filter((p) => p.client_id === client.id).length;
                          return petCount === 1 ? `${petCount} ${t('pets.pet')}` : `${petCount} ${t('pets.pets')}`;
                        })()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dog className="w-5 h-5 text-primary" />
              {t('dashboard.recentPets')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPets.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t('dashboard.noPetsYet')}</p>
            ) : (
              <div className="space-y-3">
                {recentPets.map((pet) => {
                  const owner = clients.find((c) => c.id === pet.client_id);
                  const target = businessSlug ? `/${businessSlug}/pets?highlight=${pet.id}` : `/pets?highlight=${pet.id}`;
                  return (
                    <Link
                      key={pet.id}
                      to={target}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors block"
                    >
                      <div>
                        <p className="font-medium hover:text-primary transition-colors cursor-pointer">{pet.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {pet.breed} • {owner?.name || t('dashboard.unknownOwner')}
                        </p>
                      </div>
                      <span className="px-2 py-1 text-xs bg-accent rounded capitalize">
                        {pet.species}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <details className="mt-8 border border-border rounded-lg bg-card/50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium flex items-center justify-between">
          <span>Show Diagnostics</span>
          <span className="text-xs text-muted-foreground">(for troubleshooting only)</span>
        </summary>
        <div className="pt-2">
          <DataDiagnostics />
        </div>
      </details>
    </div>
  );
}
