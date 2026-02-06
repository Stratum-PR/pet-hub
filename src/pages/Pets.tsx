import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetForm } from '@/components/PetForm';
import { PetList } from '@/components/PetList';
import { SearchFilter } from '@/components/SearchFilter';
import { Client, Pet } from '@/types';
import { t } from '@/lib/translations';
import { toast } from 'sonner';

interface PetsProps {
  clients: Client[];
  pets: Pet[];
  appointments?: any[];
  onAddPet: (pet: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => Promise<Pet | null>;
  onUpdatePet: (id: string, pet: Partial<Pet>) => Promise<Pet | null>;
  onDeletePet: (id: string) => Promise<boolean>;
}

export function Pets({ clients, pets, appointments = [], onAddPet, onUpdatePet, onDeletePet }: PetsProps) {
  const location = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('all');

  // Handle location state for selected pet
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlight');
    if (highlightId) {
      // The PetList component will handle the highlighting via the highlight prop
      // This effect ensures the page scrolls to the pet when navigated to
      setTimeout(() => {
        const element = document.getElementById(`pet-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [location]);

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

  const handleSubmit = async (petData: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingPet) {
      const result = await onUpdatePet(editingPet.id, petData);
      if (result) {
        toast.success(t('pets.updateSuccess') || 'Mascota actualizada exitosamente.');
        setEditingPet(null);
        setShowForm(false);
      } else {
        toast.error(t('pets.saveError') || 'Error al guardar la mascota.');
      }
      return;
    }

    const result = await onAddPet(petData);
    if (result) {
      toast.success(t('pets.saveSuccess') || 'Mascota guardada exitosamente.');
      setShowForm(false);
    } else {
      toast.error(t('pets.saveError') || 'Error al guardar la mascota.');
    }
  };

  const handleEdit = (pet: Pet) => {
    setEditingPet(pet);
    setShowForm(true);
    
    // Scroll to edit form and highlight it
    setTimeout(() => {
      const formElement = document.getElementById('pet-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Add highlight class
        formElement.classList.add('edit-highlight');
        
        // Remove highlight after animation
        setTimeout(() => {
          formElement.classList.remove('edit-highlight');
        }, 2000);
      }
    }, 100);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingPet(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('pets.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('pets.description')}
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
          {showForm ? t('common.cancel') : t('pets.addPet')}
        </Button>
      </div>

      {clients.length === 0 && (
        <div className="p-4 bg-accent rounded-lg">
          <p className="text-sm text-accent-foreground">{t('pets.addClientFirst')}</p>
        </div>
      )}

      {showForm && clients.length > 0 && (
        <PetForm 
          clients={clients as any} 
          onSubmit={handleSubmit} 
          onCancel={handleCancel}
          initialData={editingPet}
          isEditing={!!editingPet}
        />
      )}

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder={t('pets.searchPlaceholder')}
        filterValue={speciesFilter}
        onFilterChange={setSpeciesFilter}
        filterOptions={[
          { value: 'dog', label: t('pets.dogs') },
          { value: 'cat', label: t('pets.cats') },
          { value: 'other', label: t('pets.other') },
        ]}
        filterLabel={t('pets.species')}
      />

      <PetList 
        pets={filteredPets as any} 
        clients={clients as any}
        clients={clients as any}
        appointments={appointments}
        onDelete={onDeletePet}
        onEdit={handleEdit}
      />
    </div>
  );
}