import { useNavigate } from 'react-router-dom';
import { Users, Dog, Calendar, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Client, Pet, Employee, Appointment } from '@/types';
import { format } from 'date-fns';

interface DashboardProps {
  clients: Client[];
  pets: Pet[];
  employees: Employee[];
  appointments: Appointment[];
  onSelectClient?: (clientId: string) => void;
}

export function Dashboard({ clients, pets, employees, appointments, onSelectClient }: DashboardProps) {
  const navigate = useNavigate();
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
    navigate('/clients', { state: { selectedClientId: clientId } });
  };

  const handlePetClick = (petId: string) => {
    navigate(`/pets?highlight=${petId}`);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/20 to-background rounded-2xl">
        <div className="p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
            Welcome to your Hub
          </h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div onClick={() => navigate('/clients')} className="cursor-pointer">
          <StatCard
            title="Total Clients"
            value={clients.length}
            icon={Users}
            description="Registered clients"
          />
        </div>
        <div onClick={() => navigate('/pets')} className="cursor-pointer">
          <StatCard
            title="Total Pets"
            value={pets.length}
            icon={Dog}
            description={`${dogCount} dogs, ${catCount} cats`}
          />
        </div>
        <div onClick={() => navigate('/employee-management')} className="cursor-pointer">
          <StatCard
            title="Active Staff"
            value={activeEmployees}
            icon={Clock}
            description="Team members"
          />
        </div>
        <StatCard
          title="Today"
          value={todayAppointments}
          icon={Calendar}
          description="Appointments"
        />
        <div onClick={() => navigate('/reports')} className="cursor-pointer">
          <StatCard
            title="Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            description="Total earned"
          />
        </div>
        <StatCard
          title="Growth"
          value="+12%"
          icon={TrendingUp}
          description="vs last month"
        />
      </div>

      {/* Today's Appointments */}
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
                    onClick={() => navigate('/appointments')}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{pet?.name || 'Unknown Pet'}</p>
                        <Badge variant={appointment.status === 'completed' ? 'default' : appointment.status === 'cancelled' ? 'destructive' : 'secondary'}>
                          {appointment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(appointment.scheduled_date), 'h:mm a')} • {client?.name || 'Unknown Client'}
                        {employee && ` • ${employee.name}`}
                      </p>
                      {appointment.service_type && (
                        <p className="text-xs text-muted-foreground mt-1">{appointment.service_type}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${appointment.price.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Recent Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No clients yet</p>
            ) : (
              <div className="space-y-3">
                {recentClients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => handleClientClick(client.id)}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                  >
                    <div>
                      <p className="font-medium hover:text-primary transition-colors cursor-pointer">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded">
                      {pets.filter((p) => p.client_id === client.id).length} pets
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dog className="w-5 h-5 text-primary" />
              Recent Pets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPets.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No pets yet</p>
            ) : (
              <div className="space-y-3">
                {recentPets.map((pet) => {
                  const owner = clients.find((c) => c.id === pet.client_id);
                  return (
                    <div
                      key={pet.id}
                      onClick={() => handlePetClick(pet.id)}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                    >
                      <div>
                        <p className="font-medium hover:text-primary transition-colors cursor-pointer">{pet.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {pet.breed} • {owner?.name || 'Unknown owner'}
                        </p>
                      </div>
                      <span className="px-2 py-1 text-xs bg-accent rounded capitalize">
                        {pet.species}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
