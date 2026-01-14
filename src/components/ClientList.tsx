import { Client, Pet } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin, Trash2, Dog, Edit } from 'lucide-react';

interface ClientListProps {
  clients: Client[];
  pets: Pet[];
  onDelete: (id: string) => void;
  onEdit: (client: Client) => void;
}

export function ClientList({ clients, pets, onDelete, onEdit }: ClientListProps) {
  if (clients.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No clients found. Add your first client above!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clients.map((client) => {
        const clientPets = pets.filter((pet) => pet.client_id === client.id);
        return (
          <Card key={client.id} className="shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-lg">{client.name}</h3>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(client)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(client.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{client.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{client.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{client.address}</span>
                </div>
              </div>
              {clientPets.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Dog className="w-4 h-4 text-primary" />
                    <span>{clientPets.length} pet{clientPets.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {clientPets.map((pet) => (
                      <span
                        key={pet.id}
                        className="px-2 py-1 bg-accent text-accent-foreground text-xs rounded-md"
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