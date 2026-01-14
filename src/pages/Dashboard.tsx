import { Users, Dog, Calendar, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Client, Pet } from '@/types';
import heroImage from '@/assets/hero-dog.jpg';

interface DashboardProps {
  clients: Client[];
  pets: Pet[];
}

export function Dashboard({ clients, pets }: DashboardProps) {
  const recentClients = clients.slice(-5).reverse();
  const recentPets = pets.slice(-5).reverse();
  
  const dogCount = pets.filter(p => p.species === 'dog').length;
  const catCount = pets.filter(p => p.species === 'cat').length;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative border-2 border-border overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Pet grooming"
            className="w-full h-full object-cover opacity-30"
          />
        </div>
        <div className="relative p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Welcome to PawCare
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Your comprehensive pet grooming management system. Track clients, manage pets, and grow your business.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Clients"
          value={clients.length}
          icon={Users}
          description="Registered clients"
        />
        <StatCard
          title="Total Pets"
          value={pets.length}
          icon={Dog}
          description={`${dogCount} dogs, ${catCount} cats`}
        />
        <StatCard
          title="This Week"
          value={Math.floor(pets.length * 0.3) || 0}
          icon={Calendar}
          description="New registrations"
        />
        <StatCard
          title="Growth"
          value="+12%"
          icon={TrendingUp}
          description="vs last month"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
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
                    className="flex items-center justify-between p-3 bg-secondary border border-border"
                  >
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {pets.filter((p) => p.clientId === client.id).length} pets
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dog className="w-5 h-5" />
              Recent Pets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPets.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No pets yet</p>
            ) : (
              <div className="space-y-3">
                {recentPets.map((pet) => {
                  const owner = clients.find((c) => c.id === pet.clientId);
                  return (
                    <div
                      key={pet.id}
                      className="flex items-center justify-between p-3 bg-secondary border border-border"
                    >
                      <div>
                        <p className="font-medium">{pet.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {pet.breed} • {owner?.name || 'Unknown owner'}
                        </p>
                      </div>
                      <span className="px-2 py-1 text-xs bg-accent border border-border capitalize">
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
