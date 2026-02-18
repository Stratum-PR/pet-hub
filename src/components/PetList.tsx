import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Dog, Cat, Rabbit, User, Calendar, Scale, Shield, Clock } from 'lucide-react';
import { Pet, BusinessClient, Appointment } from '@/hooks/useBusinessData';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { t } from '@/lib/translations';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatAgeFromBirth, formatVaccinationStatusSpanish, getVaccinationStatusColor } from '@/lib/petHelpers';
import { isDemoMode } from '@/lib/authRouting';
import { format } from 'date-fns';

interface PetListProps {
  pets: Pet[] | any[];
  /** New multi-tenant clients */
  clients?: BusinessClient[] | any[];
  /** Legacy /app clients (clients table) */
  clients?: any[];
  /** Appointments for visit history */
  appointments?: Appointment[] | any[];
  onDelete: (id: string) => void;
  onEdit: (pet: any) => void;
}

const speciesIcons: Record<string, React.ElementType> = {
  dog: Dog,
  cat: Cat,
  rabbit: Rabbit,
};

const vaccinationColors: Record<string, string> = {
  'up_to_date': 'bg-green-100 text-green-800',
  'up-to-date': 'bg-green-100 text-green-800',
  'due-soon': 'bg-yellow-100 text-yellow-800',
  'out_of_date': 'bg-red-100 text-red-800',
  'overdue': 'bg-red-100 text-red-800',
  'unknown': 'bg-gray-100 text-gray-800',
};

export function PetList({ pets, clients, appointments, onDelete, onEdit }: PetListProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const highlightId = searchParams.get('highlight');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [petToDelete, setPetToDelete] = useState<string | null>(null);

  // Defensive: avoid runtime crashes if props are temporarily undefined during load/migration.
  const safePets = Array.isArray(pets) ? pets : [];
  const safeClients2 = Array.isArray(clients) ? clients : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeAppointments = Array.isArray(appointments) ? appointments : [];
  
  // Debug: Log appointments data for troubleshooting
  useEffect(() => {
    if (safeAppointments.length > 0) {
      console.log('[PetList] Appointments loaded:', {
        total: safeAppointments.length,
        samplePetIds: safeAppointments.slice(0, 5).map((a: any) => ({ 
          pet_id: a.pet_id, 
          appointment_date: a.appointment_date,
          id: a.id 
        })),
      });
    } else {
      console.warn('[PetList] No appointments provided to PetList component');
    }
  }, [safeAppointments.length]);

  const handleOwnerClick = (clientId: string) => {
    // Use highlight parameter for consistent navigation pattern
    if (businessSlug) {
      navigate(`/${businessSlug}/clients?highlight=${clientId}`);
    } else {
      navigate(`/clients?highlight=${clientId}`);
    }
  };

  const handleVisitHistoryClick = (petId: string) => {
    // Navigate to appointments filtered by pet
    if (businessSlug) {
      navigate(`/${businessSlug}/appointments?pet=${petId}`);
    } else {
      navigate(`/appointments?pet=${petId}`);
    }
  };

  const getRecentVisit = (petId: string) => {
    const petAppointments = safeAppointments
      .filter((apt: any) => apt.pet_id === petId)
      .sort((a: any, b: any) => {
        const dateA = a.appointment_date || a.scheduled_date;
        const dateB = b.appointment_date || b.scheduled_date;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    
    return petAppointments[0] || null;
  };

  const getAllPetAppointments = (petId: string) => {
    if (!petId) return [];
    
    // CRITICAL: Filter appointments by pet_id
    // Handle both TEXT and UUID types by converting to strings and trimming
    // Also handle null/undefined pet_id values
    const petAppointments = safeAppointments.filter((apt: any) => {
      if (!apt.pet_id) return false;
      
      // Convert both to strings and normalize (trim whitespace)
      const aptPetId = String(apt.pet_id).trim();
      const targetPetId = String(petId).trim();
      
      // Exact string match
      if (aptPetId === targetPetId) return true;
      
      // Debug: log mismatches for troubleshooting
      if (aptPetId && targetPetId && aptPetId !== targetPetId) {
        console.debug('[PetList] Pet ID mismatch:', {
          appointmentPetId: aptPetId,
          targetPetId: targetPetId,
          appointmentId: apt.id,
        });
      }
      
      return false;
    });
    
    // Sort by date (most recent first), handling null dates
    return petAppointments.sort((a: any, b: any) => {
      const dateA = a.appointment_date || a.scheduled_date;
      const dateB = b.appointment_date || b.scheduled_date;
      
      // Handle null dates - put them at the end
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // a has no date, put it after b
      if (!dateB) return -1; // b has no date, put it after a
      
      // Both have dates, compare them
      const timeA = new Date(dateA).getTime();
      const timeB = new Date(dateB).getTime();
      
      // If dates are equal, compare by time
      if (timeA === timeB) {
        const timeA_str = a.start_time || '';
        const timeB_str = b.start_time || '';
        return timeB_str.localeCompare(timeA_str); // Descending
      }
      
      return timeB - timeA; // Descending (most recent first)
    });
  };

  useEffect(() => {
    if (highlightId) {
      const element = document.getElementById(`pet-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 3000);
      }
    }
  }, [highlightId]);

  const handleDeleteClick = (id: string) => {
    setPetToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (petToDelete) {
      onDelete(petToDelete);
      setPetToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  if (safePets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">{t('pets.noPetsFound')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {safePets.map((pet) => {
          // CRITICAL: Get owner data from Supabase JOIN
          // The usePets hook now returns pets with clients:client_id(...) join
          // This means pet.clients will be an object (not array) with client data
          const ownerFromJoin = (pet as any).clients;
          
          // Fallback: Try to find owner from passed arrays (for backward compatibility)
          const ownerFromClients = safeClients.find((c: any) => c.id === (pet as any).client_id);
          const ownerFromArray = ownerFromClients || safeClients2.find((c: any) => c.id === (pet as any).client_id);
          
          // Prefer JOIN data, fallback to array lookup
          const owner = ownerFromJoin || ownerFromArray;
          const SpeciesIcon = speciesIcons[pet.species] || Rabbit;
          
          // Get owner name from Supabase data
          // JOIN returns: { id, first_name, last_name, email, phone }
          const ownerName = owner 
            ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || null
            : null;
          
          // Get owner ID - prefer from JOIN, fallback to pet.client_id
          const ownerId = owner?.id || (pet as any).client_id;
          
          // CRITICAL: Get canonical breed name from breeds table join (breeds.name)
          // Fallback to legacy breed TEXT field for backward compatibility
          const breedName = (pet as any).breeds?.name || (pet as any).breed || null;
          
          // Handle demo mode photos from localStorage
          const demoMode = isDemoMode();
          let petPhotoUrl = (pet as any).photo_url;
          if (demoMode && pet.id) {
            const storageKey = `demo-pet-photo-${pet.id}`;
            const demoPhoto = localStorage.getItem(storageKey);
            if (demoPhoto) {
              petPhotoUrl = demoPhoto;
            }
          }
          
          const birthMonth = (pet as any).birth_month;
          const birthYear = (pet as any).birth_year;
          const ageDisplay = formatAgeFromBirth(birthMonth, birthYear);
          const vaccinationStatus = (pet as any).vaccination_status || 'unknown';
          const vaccinationStatusText = formatVaccinationStatusSpanish(vaccinationStatus);
          const vaccinationStatusColor = getVaccinationStatusColor(vaccinationStatus);
          
          return (
            <Card 
              key={pet.id} 
              id={`pet-${pet.id}`}
              className="shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="relative">
                      {petPhotoUrl ? (
                        <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-border flex-shrink-0 relative">
                          <img
                            src={petPhotoUrl}
                            alt={pet.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-accent flex items-center justify-center rounded-lg flex-shrink-0 relative">
                          <SpeciesIcon className="w-10 h-10 text-accent-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{pet.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {breedName || <span className="text-muted-foreground italic">Sin raza</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(pet)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Editar información de la mascota</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(pet.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Eliminar mascota permanentemente</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {ownerName && ownerId ? (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div 
                        onClick={() => handleOwnerClick(ownerId)}
                        className="px-2 py-1 bg-accent rounded-md hover:bg-accent/80 transition-colors cursor-pointer font-medium text-sm inline-block"
                        title={t('pets.clickToViewOwner')}
                      >
                        {ownerName}
                      </div>
                    </div>
                  ) : (
                    // Only show "Sin dueño asignado" if client_id is actually null/empty in Supabase
                    (pet as any).client_id ? (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <User className="w-4 h-4" />
                        <span className="text-xs">Cliente no encontrado (ID: {(pet as any).client_id.substring(0, 8)}...)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span className="text-muted-foreground">{t('pets.notAssigned')}</span>
                      </div>
                    )
                  )}
                  {(birthMonth || birthYear) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{ageDisplay}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Scale className="w-4 h-4" />
                    <span>{pet.weight || 0} {t('pets.lbs')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className={`px-2 py-0.5 rounded text-xs ${vaccinationStatusColor}`}>
                      {vaccinationStatusText}
                    </span>
                  </div>
                </div>
                
                {/* Past Appointments Button */}
                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleVisitHistoryClick(pet.id)}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Past Appointments
                  </Button>
                </div>
                
                {pet.notes && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground line-clamp-2">{pet.notes}</p>
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
        title={t('pets.deletePetTitle')}
        description={t('pets.deletePetDescription')}
      />
    </>
  );
}
