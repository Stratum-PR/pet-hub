import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Mail, Phone, MapPin, Dog } from 'lucide-react';
import { Client, Pet } from '@/types';
import { t } from '@/lib/translations';

interface ClientListProps {
  clients: Client[];
  pets: Pet[];
  onViewClient?: (client: Client) => void;
  onDelete?: (id: string) => void;
  onEdit?: (client: Client) => void;
  selectedClientId?: string | null;
}

export function ClientList({ clients, pets, onViewClient, onDelete, onEdit, selectedClientId }: ClientListProps) {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();

  useEffect(() => {
    if (selectedClientId) {
      const element = document.getElementById(`client-${selectedClientId}`);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 3000);
        }, 100);
      }
    }
  }, [selectedClientId]);


  const handlePetClick = (petId: string) => {
    // Preserve the business slug (e.g. /demo/pets?highlight=...)
    if (businessSlug) {
      navigate(`/${businessSlug}/pets?highlight=${petId}`);
    } else {
      navigate(`/pets?highlight=${petId}`);
    }
  };

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
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => {
          const clientPets = pets.filter((pet: any) => pet.client_id === client.id);
          const isSelected = selectedClientId === client.id;
          return (
            <Card
              key={client.id}
              id={`client-${client.id}`}
              role={onViewClient ? 'button' : undefined}
              tabIndex={onViewClient ? 0 : undefined}
              className={`shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''} ${onViewClient ? 'cursor-pointer' : ''}`}
              onClick={onViewClient ? () => onViewClient(client) : undefined}
              onKeyDown={onViewClient ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewClient(client); } } : undefined}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-lg">{client.first_name} {client.last_name}</h3>
                  {onViewClient && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); onViewClient(client); }}
                      className="h-8 w-8"
                      aria-label="View client details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
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
                  {client.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{client.address}</span>
                    </div>
                  )}
                </div>
                {clientPets.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Dog className="w-4 h-4 text-primary" />
                      <span>{clientPets.length} {clientPets.length === 1 ? t('pets.pet') : t('pets.pets')}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {clientPets.map((pet) => (
                        <button
                          key={pet.id}
                          id={`pet-${pet.id}`}
                          onClick={() => handlePetClick(pet.id)}
                          className="px-2 py-1 bg-accent text-accent-foreground text-xs rounded-md hover:bg-accent/80 transition-colors cursor-pointer"
                        >
                          {pet.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
