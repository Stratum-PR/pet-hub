import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetForm } from '@/components/PetForm';
import { PetList } from '@/components/PetList';
import { Client, Pet } from '@/types';

interface PetsProps {
  clients: Client[];
  pets: Pet[];
  onAddPet: (pet: Omit<Pet, 'id' | 'createdAt'>) => void;
  onDeletePet: (id: string) => void;
}

export function Pets({ clients, pets, onAddPet, onDeletePet }: PetsProps) {
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (pet: Omit<Pet, 'id' | 'createdAt'>) => {
    onAddPet(pet);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pets</h1>
          <p className="text-muted-foreground mt-1">
            Manage all the furry friends in your care
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="shadow-xs hover:shadow-sm transition-shadow flex items-center gap-2"
          disabled={clients.length === 0}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Pet'}
        </Button>
      </div>

      {clients.length === 0 && (
        <div className="p-4 bg-accent border-2 border-border">
          <p className="text-sm">Add a client first before adding pets.</p>
        </div>
      )}

      {showForm && clients.length > 0 && (
        <PetForm clients={clients} onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
      )}

      <PetList pets={pets} clients={clients} onDelete={onDeletePet} />
    </div>
  );
}
