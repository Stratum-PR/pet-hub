import { Client, Pet } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin, Trash2, Dog } from 'lucide-react';

interface ClientListProps {
  clients: Client[];
  pets: Pet[];
  onDelete: (id: string) => void;
}

export function ClientList({ clients, pets, onDelete }: ClientListProps) {
  if (clients.length === 0) {
    return (
      <Card className="border-2 border-dashed border-border">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No clients yet. Add your first client above!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clients.map((client) => {
        const clientPets = pets.filter((pet) => pet.clientId === client.id);
        return (
          <Card key={client.id} className="border-2 border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-bold text-lg">{client.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(client.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{client.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{client.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{client.address}</span>
                </div>
              </div>
              {clientPets.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Dog className="w-4 h-4" />
                    <span>{clientPets.length} pet{clientPets.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {clientPets.map((pet) => (
                      <span
                        key={pet.id}
                        className="px-2 py-1 bg-accent text-accent-foreground text-xs border border-border"
                      >
                        {pet.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
