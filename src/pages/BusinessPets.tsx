import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetForm } from '@/components/PetForm';
import { PetList } from '@/components/PetList';
import { SearchFilter } from '@/components/SearchFilter';
import { usePets, useCustomers, useAppointments, Pet, Customer } from '@/hooks/useBusinessData';
import { t } from '@/lib/translations';
import { useToast } from '@/hooks/use-toast';

export function BusinessPets() {
  const { pets, addPet, updatePet, deletePet } = usePets();
  const { customers } = useCustomers();
  const { appointments } = useAppointments();
  const location = useLocation();
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('all');

  // Handle location state for selected pet
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlight');
    if (highlightId) {
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
        const owner = customers.find(c => c.id === pet.customer_id);
        return (
          pet.name.toLowerCase().includes(term) ||
          pet.breed?.toLowerCase().includes(term) ||
          owner?.first_name.toLowerCase().includes(term) ||
          owner?.last_name.toLowerCase().includes(term)
        );
      });
    }
    
    if (speciesFilter !== 'all') {
      filtered = filtered.filter(pet => pet.species === speciesFilter);
    }
    
    return filtered;
  }, [pets, customers, searchTerm, speciesFilter]);

  const handleSubmit = async (petData: Omit<Pet, 'id' | 'created_at' | 'updated_at' | 'business_id'>) => {
    try {
      if (editingPet) {
        const result = await updatePet(editingPet.id, petData);
        if (result) {
          toast({
            title: '¡Éxito!',
            description: `¡Mascota actualizada exitosamente!${petData.name ? ` - ${petData.name}` : ''}`,
          });
          setEditingPet(null);
        } else {
          throw new Error('Error al actualizar la mascota');
        }
      } else {
        const result = await addPet(petData as Omit<Pet, 'id' | 'created_at' | 'updated_at'>);
        if (result) {
          toast({
            title: '¡Éxito!',
            description: `¡Mascota guardada exitosamente!${petData.name ? ` - ${petData.name}` : ''}`,
          });
        } else {
          throw new Error('Error al guardar la mascota');
        }
      }
      setShowForm(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al guardar la mascota. Por favor intenta de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (pet: Pet) => {
    setEditingPet(pet);
    setShowForm(true);
    // Scroll to the pet form when editing, after it renders
    setTimeout(() => {
      const el = document.getElementById('pet-form');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Add highlight animation
        el.classList.add('ring-4', 'ring-primary', 'ring-offset-4', 'transition-all', 'duration-300');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-primary', 'ring-offset-4');
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
          disabled={customers.length === 0}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? t('common.cancel') : t('pets.addPet')}
        </Button>
      </div>

      {customers.length === 0 && (
        <div className="p-4 bg-accent rounded-lg">
          <p className="text-sm text-accent-foreground">{t('pets.addClientFirst')}</p>
        </div>
      )}

      {showForm && customers.length > 0 && (
        <div id="pet-form" ref={formRef}>
          <PetForm 
            customers={customers}
            onSubmit={handleSubmit} 
            onCancel={handleCancel}
            initialData={editingPet}
            isEditing={!!editingPet}
          />
        </div>
      )}

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder={t('pets.searchPlaceholder')}
        filterValue={speciesFilter}
        onFilterChange={setSpeciesFilter}
        filterOptions={[
          { value: 'all', label: t('pets.all') },
          { value: 'dog', label: t('pets.dogs') },
          { value: 'cat', label: t('pets.cats') },
          { value: 'other', label: t('pets.other') },
        ]}
        filterLabel={t('pets.species')}
      />

      <PetList 
        pets={filteredPets} 
        customers={customers}
        appointments={appointments}
        onDelete={deletePet}
        onEdit={handleEdit}
      />
    </div>
  );
}
