import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetForm } from '@/components/PetForm';
import { PetList } from '@/components/PetList';
import { SearchFilter } from '@/components/SearchFilter';
import { Client, Pet } from '@/types';

interface PetsProps {
  clients: Client[];
  pets: Pet[];
  onAddPet: (pet: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdatePet: (id: string, pet: Partial<Pet>) => void;
  onDeletePet: (id: string) => void;
}

export function Pets({ clients, pets, onAddPet, onUpdatePet, onDeletePet }: PetsProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('all');

  const filteredPets = useMemo(() => {
    let filtered = pets;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(pet => {
        const owner = clients.find(c => c.id === pet.client_id);
        return (
          pet.name.toLowerCase().includes(term) ||
          pet.breed.toLowerCase().includes(term) ||
          owner?.name.toLowerCase().includes(term)
        );
      });
    }
    
    if (speciesFilter !== 'all') {
      filtered = filtered.filter(pet => pet.species === speciesFilter);
    }
    
    return filtered;
  }, [pets, clients, searchTerm, speciesFilter]);

  const handleSubmit = (petData: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingPet) {
      onUpdatePet(editingPet.id, petData);
      setEditingPet(null);
    } else {
      onAddPet(petData);
    }
    setShowForm(false);
  };

  const handleEdit = (pet: Pet) => {
    setEditingPet(pet);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingPet(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pets</h1>
          <p className="text-muted-foreground mt-1">
            Manage all the furry friends in your care
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingPet(null);
            setShowForm(!showForm);
          }}
          className="shadow-sm flex items-center gap-2"
          disabled={clients.length === 0}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Pet'}
        </Button>
      </div>

      {clients.length === 0 && (
        <div className="p-4 bg-accent rounded-lg">
          <p className="text-sm text-accent-foreground">Add a client first before adding pets.</p>
        </div>
      )}

      {showForm && clients.length > 0 && (
        <PetForm 
          clients={clients} 
          onSubmit={handleSubmit} 
          onCancel={handleCancel}
          initialData={editingPet}
          isEditing={!!editingPet}
        />
      )}

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search pets by name, breed, or owner..."
        filterValue={speciesFilter}
        onFilterChange={setSpeciesFilter}
        filterOptions={[
          { value: 'dog', label: 'Dogs' },
          { value: 'cat', label: 'Cats' },
          { value: 'other', label: 'Other' },
        ]}
        filterLabel="Species"
      />

      <PetList 
        pets={filteredPets} 
        clients={clients} 
        onDelete={onDeletePet}
        onEdit={handleEdit}
      />
    </div>
  );
}