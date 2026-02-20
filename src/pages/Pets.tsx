import { useState, useMemo, useEffect } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, X, LayoutGrid, List, Dog, Cat, ArrowLeft, Edit, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetForm } from '@/components/PetForm';
import { PetList } from '@/components/PetList';
import { SearchFilter } from '@/components/SearchFilter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { Client, Pet } from '@/types';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { usePageLoadRef } from '@/hooks/usePageLoad';
import { format, parseISO, isWithinInterval, subDays, differenceInDays } from 'date-fns';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromClient = searchParams.get('fromClient');
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [petDetailOpen, setPetDetailOpen] = useState<Pet | null>(null);
  const [petDeleteConfirmOpen, setPetDeleteConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastAppointmentFilter, setLastAppointmentFilter] = useState<string>('all');
  type SortKey = 'name' | 'owner' | 'breed' | 'lastAppointment' | 'upcoming';
  const [sortKey, setSortKey] = useState<SortKey>('lastAppointment');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // false = descending (newest first for dates)
  const PET_VIEW_KEY = 'pet-hub-pets-view';
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window === 'undefined') return 'cards';
    return window.localStorage.getItem(PET_VIEW_KEY) === 'list' ? 'list' : 'cards';
  });
  const pageLoadRef = usePageLoadRef();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PET_VIEW_KEY, viewMode);
  }, [viewMode]);

  // Scroll to and highlight pet when navigated from client page (?highlight=petId)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlight');
    if (!highlightId) return;
    let highlightClear: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      const element = document.getElementById(`pet-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        highlightClear = setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 3000);
      }
    }, viewMode === 'list' ? 150 : 300);
    return () => {
      clearTimeout(timer);
      if (highlightClear) clearTimeout(highlightClear);
    };
  }, [location.search, viewMode]);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const lastAppointmentByPet = useMemo(() => {
    const map: Record<string, string> = {};
    const safe = Array.isArray(appointments) ? appointments : [];
    safe
      .filter((a: any) => a.pet_id)
      .forEach((a: any) => {
        const dateStr = a.appointment_date || a.scheduled_date;
        if (!dateStr) return;
        const normalized = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
        const existing = map[a.pet_id];
        if (!existing || new Date(normalized) > new Date(existing)) {
          map[a.pet_id] = normalized;
        }
      });
    return map;
  }, [appointments]);

  const upcomingAppointmentsByPet = useMemo(() => {
    const map: Record<string, string[]> = {};
    const safe = Array.isArray(appointments) ? appointments : [];
    safe
      .filter((a: any) => a.pet_id)
      .forEach((a: any) => {
        const dateStr = a.appointment_date || a.scheduled_date;
        if (!dateStr) return;
        const normalized = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
        if (normalized < today) return;
        if (!map[a.pet_id]) map[a.pet_id] = [];
        if (!map[a.pet_id].includes(normalized)) map[a.pet_id].push(normalized);
      });
    Object.keys(map).forEach((id) => map[id].sort());
    return map;
  }, [appointments, today]);

  const filteredPets = useMemo(() => {
    let filtered = pets;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(pet => {
        const owner = clients.find(c => c.id === pet.client_id);
        const ownerName = owner ? `${(owner as any).first_name || ''} ${(owner as any).last_name || ''}`.trim() : '';
        return (
          pet.name.toLowerCase().includes(term) ||
          (pet.breed && pet.breed.toLowerCase().includes(term)) ||
          ownerName.toLowerCase().includes(term)
        );
      });
    }

    if (lastAppointmentFilter !== 'all') {
      const now = new Date();
      if (lastAppointmentFilter === 'none') {
        filtered = filtered.filter(pet => !lastAppointmentByPet[pet.id]);
      } else {
        const days = parseInt(lastAppointmentFilter, 10);
        const from = subDays(now, days);
        filtered = filtered.filter(pet => {
          const last = lastAppointmentByPet[pet.id];
          if (!last) return false;
          try {
            const d = last.includes('T') ? parseISO(last) : parseISO(last + 'T00:00:00');
            return isWithinInterval(d, { start: from, end: now });
          } catch {
            return false;
          }
        });
      }
    }

    const ownerName = (pet: Pet) => {
      const owner = clients.find(c => c.id === pet.client_id);
      return owner ? `${(owner as any).first_name || ''} ${(owner as any).last_name || ''}`.trim() : '';
    };
    const breedName = (pet: Pet) => (pet as any).breeds?.name ?? (pet as any).breed ?? '';
    const nextUpcoming = (petId: string) => {
      const arr = upcomingAppointmentsByPet[petId];
      return arr && arr[0] ? arr[0] : null;
    };

    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === 'owner') {
        cmp = ownerName(a).localeCompare(ownerName(b));
      } else if (sortKey === 'breed') {
        cmp = breedName(a).localeCompare(breedName(b));
      } else if (sortKey === 'lastAppointment') {
        const lastA = lastAppointmentByPet[a.id];
        const lastB = lastAppointmentByPet[b.id];
        if (!lastA && !lastB) cmp = 0;
        else if (!lastA) cmp = 1;
        else if (!lastB) cmp = -1;
        else {
          const dA = lastA.includes('T') ? parseISO(lastA) : parseISO(lastA + 'T00:00:00');
          const dB = lastB.includes('T') ? parseISO(lastB) : parseISO(lastB + 'T00:00:00');
          cmp = dA.getTime() - dB.getTime();
        }
      } else {
        const uA = nextUpcoming(a.id);
        const uB = nextUpcoming(b.id);
        if (!uA && !uB) cmp = 0;
        else if (!uA) cmp = 1;
        else if (!uB) cmp = -1;
        else cmp = uA.localeCompare(uB);
      }
      return sortAsc ? cmp : -cmp;
    });

    return filtered;
  }, [pets, clients, searchTerm, lastAppointmentFilter, lastAppointmentByPet, upcomingAppointmentsByPet, sortKey, sortAsc]);

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
    <div ref={pageLoadRef} className="space-y-6 animate-fade-in" data-transition-root>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap" data-page-toolbar data-page-search>
        <SearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder={t('pets.searchPlaceholder')}
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Last appointment:</span>
          <select
            value={lastAppointmentFilter}
            onChange={(e) => setLastAppointmentFilter(e.target.value)}
            className="h-10 rounded-xl border border-input bg-background/80 backdrop-blur-sm px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="none">No appointment</option>
          </select>
        </div>
        <div className="inline-flex rounded-xl border border-input bg-background/80 backdrop-blur-sm p-0.5">
          <button
            type="button"
            className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
              viewMode === 'cards' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
            onClick={() => setViewMode('cards')}
            aria-label="Card view"
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
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
          className="shadow-sm flex items-center gap-2 shrink-0"
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

      {fromClient && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (businessSlug) navigate(`/${businessSlug}/clients?highlight=${fromClient}`);
              else navigate(`/clients?highlight=${fromClient}`);
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Return to client
          </Button>
        </div>
      )}

      {viewMode === 'cards' ? (
        <div data-page-content>
          <PetList
            pets={filteredPets as any}
            clients={clients as any}
            appointments={appointments}
            onViewPet={setPetDetailOpen}
            onDelete={onDeletePet}
            onEdit={handleEdit}
          />
        </div>
      ) : (
        <div data-page-content>
          <div className="overflow-x-auto rounded-lg border-0 bg-card" data-table-load>
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-14">{t('pets.listPhoto')}</th>
                <th
                  className="text-left px-3 py-2 font-medium cursor-pointer select-none hover:bg-muted/80"
                  onClick={() => { setSortKey('name'); setSortAsc((prev) => (sortKey === 'name' ? !prev : true)); }}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('pets.listName')}
                    {sortKey === 'name' ? (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-40" />}
                  </span>
                </th>
                <th
                  className="text-left px-3 py-2 font-medium cursor-pointer select-none hover:bg-muted/80"
                  onClick={() => { setSortKey('owner'); setSortAsc((prev) => (sortKey === 'owner' ? !prev : true)); }}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('pets.listOwner')}
                    {sortKey === 'owner' ? (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-40" />}
                  </span>
                </th>
                <th
                  className="text-left px-3 py-2 font-medium cursor-pointer select-none hover:bg-muted/80"
                  onClick={() => { setSortKey('breed'); setSortAsc((prev) => (sortKey === 'breed' ? !prev : true)); }}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('pets.listBreed')}
                    {sortKey === 'breed' ? (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-40" />}
                  </span>
                </th>
                <th
                  className="text-left px-3 py-2 font-medium cursor-pointer select-none hover:bg-muted/80"
                  onClick={() => { setSortKey('lastAppointment'); setSortAsc((prev) => (sortKey === 'lastAppointment' ? !prev : false)); }}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('pets.listLastAppointment')}
                    {sortKey === 'lastAppointment' ? (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-40" />}
                  </span>
                </th>
                <th
                  className="text-left px-3 py-2 font-medium cursor-pointer select-none hover:bg-muted/80"
                  onClick={() => { setSortKey('upcoming'); setSortAsc((prev) => (sortKey === 'upcoming' ? !prev : true)); }}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('pets.listNextAppointment')}
                    {sortKey === 'upcoming' ? (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-40" />}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPets.map((pet) => {
                const owner = clients.find(c => c.id === pet.client_id);
                const ownerName = owner
                  ? `${(owner as any).first_name || ''} ${(owner as any).last_name || ''}`.trim() || (owner as any).email
                  : t('pets.notAssigned') || '—';
                const photoUrl = (pet as any).photo_url;
                const breedName = (pet as any).breeds?.name ?? (pet as any).breed ?? '—';
                const lastAppt = lastAppointmentByPet[pet.id];
                let lastApptFormatted = '—';
                let daysAgo: number | null = null;
                if (lastAppt) {
                  try {
                    const d = lastAppt.includes('T') ? parseISO(lastAppt) : parseISO(lastAppt + 'T00:00:00');
                    lastApptFormatted = format(d, 'MMM d, yyyy');
                    daysAgo = differenceInDays(new Date(), d);
                  } catch {
                    lastApptFormatted = lastAppt;
                  }
                }
                const upcoming = upcomingAppointmentsByPet[pet.id];
                const nextAppointmentDisplay = upcoming && upcoming.length
                  ? format(parseISO(upcoming[0] + 'T00:00:00'), 'MMM d, yyyy')
                  : '—';
                return (
                  <tr
                    key={pet.id}
                    id={`pet-${pet.id}`}
                    role="button"
                    tabIndex={0}
                    className="border-t hover:bg-muted/40 cursor-pointer"
                    onClick={() => setPetDetailOpen(pet)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPetDetailOpen(pet); } }}
                  >
                    <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                      {photoUrl ? (
                        <img src={photoUrl} alt={pet.name} className="w-10 h-10 rounded object-cover border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center border border-border">
                          {pet.species === 'cat' ? <Cat className="w-5 h-5 text-muted-foreground" /> : <Dog className="w-5 h-5 text-muted-foreground" />}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{pet.name}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {owner ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
                          onClick={() => {
                            if (businessSlug) navigate(`/${businessSlug}/clients?highlight=${owner.id}`);
                            else navigate(`/clients?highlight=${owner.id}`);
                          }}
                        >
                          {ownerName}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{ownerName}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{breedName}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {lastApptFormatted}
                      {daysAgo !== null && (
                        <span className="text-muted-foreground/80"> ({daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{nextAppointmentDisplay}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Dialog open={!!petDetailOpen} onOpenChange={(open) => !open && setPetDetailOpen(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {petDetailOpen && (
            <>
              <DialogHeader>
                <DialogTitle>{petDetailOpen.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Species:</span> {petDetailOpen.species || '—'}</p>
                <p><span className="text-muted-foreground">Breed:</span> {(petDetailOpen as any).breeds?.name ?? (petDetailOpen as any).breed ?? '—'}</p>
                <p><span className="text-muted-foreground">Weight:</span> {petDetailOpen.weight ?? '—'} {t('pets.lbs')}</p>
                {(() => {
                  const owner = clients.find(c => c.id === petDetailOpen.client_id);
                  return owner ? (
                    <p>
                      <span className="text-muted-foreground">Owner:</span>{' '}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary font-medium hover:bg-primary/20"
                        onClick={() => {
                          setPetDetailOpen(null);
                          if (businessSlug) navigate(`/${businessSlug}/clients?highlight=${owner.id}`);
                          else navigate(`/clients?highlight=${owner.id}`);
                        }}
                      >
                        {owner.first_name} {owner.last_name}
                      </button>
                    </p>
                  ) : null;
                })()}
                {(petDetailOpen as any).notes && (
                  <p><span className="text-muted-foreground">Notes:</span> {(petDetailOpen as any).notes}</p>
                )}
                {/* Appointment history for this pet */}
                <div className="pt-2 border-t border-border">
                  <h4 className="font-medium text-foreground mb-2">Appointment history</h4>
                  {(() => {
                    const petAppointments = (appointments as any[])
                      .filter((a: any) => a.pet_id === petDetailOpen.id)
                      .map((a: any) => ({
                        ...a,
                        dateStr: a.appointment_date || a.scheduled_date,
                      }))
                      .filter((a: any) => a.dateStr)
                      .sort((a: any, b: any) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());
                    if (petAppointments.length === 0) {
                      return <p className="text-muted-foreground">No appointments yet.</p>;
                    }
                    return (
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                        {petAppointments.map((apt: any) => {
                          const d = apt.dateStr.includes('T') ? apt.dateStr : apt.dateStr + 'T00:00:00';
                          const service = apt.service_type || apt.service_name || 'Appointment';
                          const status = apt.status || '—';
                          return (
                            <li key={apt.id} className="flex justify-between items-baseline gap-2 text-muted-foreground">
                              <span>{format(parseISO(d), 'MMM d, yyyy')}</span>
                              <span className="truncate">{service}</span>
                              <span className="text-xs capitalize">{status}</span>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setPetDetailOpen(null); handleEdit(petDetailOpen); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit pet
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setPetDeleteConfirmOpen(true);
                  }}
                >
                  Delete pet
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={petDeleteConfirmOpen}
        onOpenChange={setPetDeleteConfirmOpen}
        onConfirm={async () => {
          if (petDetailOpen) {
            await onDeletePet(petDetailOpen.id);
            setPetDetailOpen(null);
            setPetDeleteConfirmOpen(false);
          }
        }}
        title={t('pets.deletePetTitle')}
        description={t('pets.deletePetDescription')}
      />
    </div>
  );
}