import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, X, Edit, Trash2, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetForm } from '@/components/PetForm';
import { PetList } from '@/components/PetList';
import { SearchFilter } from '@/components/SearchFilter';
import { usePets, useClients, useAppointments, Pet, BusinessClient } from '@/hooks/useBusinessData';
import { t } from '@/lib/translations';
import { useToast } from '@/hooks/use-toast';

export function BusinessPets() {
  const { pets, loading: petsLoading, error: petsError, refetch: refetchPets, addPet, updatePet, deletePet } = usePets();
  const { clients, error: clientsError, refetch: refetchClients } = useClients();
  const { appointments, error: appointmentsError, refetch: refetchAppointments } = useAppointments();
  const error = petsError ?? clientsError ?? appointmentsError;
  const refetchAll = () => { refetchPets(); refetchClients(); refetchAppointments(); };
  const location = useLocation();
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const PET_VIEW_KEY = 'pet-hub-pets-view';
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window === 'undefined') return 'cards';
    const stored = window.localStorage.getItem(PET_VIEW_KEY);
    return stored === 'list' ? 'list' : 'cards';
  });

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PET_VIEW_KEY, viewMode);
  }, [PET_VIEW_KEY, viewMode]);

  const filteredPets = useMemo(() => {
    let filtered = pets;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(pet => {
        const owner = clients.find(c => c.id === pet.client_id);
        return (
          pet.name.toLowerCase().includes(term) ||
          pet.breed?.toLowerCase().includes(term) ||
          owner?.first_name.toLowerCase().includes(term) ||
          owner?.last_name.toLowerCase().includes(term)
        );
      });
    }
    
    return filtered;
  }, [pets, clients, searchTerm]);

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
        description: t('common.genericError') || t('pets.saveError'),
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

  if (petsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-destructive">Failed to load data.</p>
            <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
          </div>
          <Button variant="outline" onClick={() => refetchAll()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-md border bg-muted p-0.5">
            <button
              type="button"
              className={`inline-flex items-center justify-center h-8 w-8 rounded-sm ${
                viewMode === 'cards' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setViewMode('cards')}
              aria-label="Card view"
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
            </button>
            <button
              type="button"
              className={`inline-flex items-center justify-center h-8 w-8 rounded-sm ${
                viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="w-4 h-4 shrink-0" />
            </button>
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
      </div>

      {clients.length === 0 && (
        <div className="p-4 bg-accent rounded-lg">
          <p className="text-sm text-accent-foreground">{t('pets.addClientFirst')}</p>
        </div>
      )}

      {showForm && clients.length > 0 && (
        <div id="pet-form" ref={formRef}>
          <PetForm 
            clients={clients}
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
      />

      {viewMode === 'cards' ? (
        <PetList 
          pets={filteredPets} 
          clients={clients}
          appointments={appointments}
          onDelete={deletePet}
          onEdit={handleEdit}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border-0 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-3 py-2 font-medium">{t('pets.title')}</th>
                <th className="text-left px-3 py-2 font-medium">{t('pets.owner') || 'Owner'}</th>
                <th className="text-left px-3 py-2 font-medium">{t('pets.species')}</th>
                <th className="text-left px-3 py-2 font-medium w-[120px]">{t('common.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPets.map((pet) => {
                const owner = clients.find((c: BusinessClient) => c.id === (pet as any).client_id);
                const ownerName = owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email : t('pets.notAssigned');
                return (
                  <tr
                    key={pet.id}
                    id={`pet-${pet.id}`}
                    className="border-t hover:bg-muted/40"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{pet.name}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{ownerName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{pet.species || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(pet)}
                          className="h-8 w-8"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePet(pet.id)}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
