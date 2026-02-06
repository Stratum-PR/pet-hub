import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Mail, Phone, MapPin, Dog } from 'lucide-react';
import { Client, Pet } from '@/types';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { t } from '@/lib/translations';

interface ClientListProps {
  clients: Client[];
  pets: Pet[];
  onDelete: (id: string) => void;
  onEdit: (client: Client) => void;
  selectedClientId?: string | null;
}

export function ClientList({ clients, pets, onDelete, onEdit, selectedClientId }: ClientListProps) {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

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


  const handleDeleteClick = (id: string) => {
    setClientToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (clientToDelete) {
      onDelete(clientToDelete);
      setClientToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

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
              className={`shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-lg">{client.first_name} {client.last_name}</h3>
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
                      onClick={() => handleDeleteClick(client.id)}
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
                  {client.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{client.address}</span>
                    </div>
                  )}
                </div>
                {clientPets.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
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

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Client?"
        description="This will permanently delete this client. This action cannot be undone."
      />
    </>
  );
}
