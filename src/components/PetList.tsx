import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Dog, Cat, Rabbit, User, Calendar, Scale, Shield } from 'lucide-react';
import { Pet, Customer } from '@/hooks/useBusinessData';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

interface PetListProps {
  pets: Pet[];
  customers: Customer[];
  onDelete: (id: string) => void;
  onEdit: (pet: Pet) => void;
}

const speciesIcons: Record<string, React.ElementType> = {
  dog: Dog,
  cat: Cat,
  rabbit: Rabbit,
};

const vaccinationColors: Record<string, string> = {
  'up-to-date': 'bg-green-100 text-green-800',
  'due-soon': 'bg-yellow-100 text-yellow-800',
  'overdue': 'bg-red-100 text-red-800',
  'unknown': 'bg-muted text-muted-foreground',
};

export function PetList({ pets, customers, onDelete, onEdit }: PetListProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const highlightId = searchParams.get('highlight');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [petToDelete, setPetToDelete] = useState<string | null>(null);

  // Defensive: avoid runtime crashes if props are temporarily undefined during load/migration.
  const safePets = Array.isArray(pets) ? pets : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];

  const handleOwnerClick = (customerId: string) => {
    const target = businessSlug ? `/${businessSlug}/clients` : '/clients';
    navigate(target, { state: { selectedCustomerId: customerId } });
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
          <p className="text-muted-foreground">No pets found. Add your first pet above!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {safePets.map((pet) => {
          const owner = safeCustomers.find((c) => c.id === pet.customer_id);
          const SpeciesIcon = speciesIcons[pet.species] || Rabbit;
          const vaccinationStatus = (pet as any).vaccination_status || 'unknown';
          return (
            <Card 
              key={pet.id} 
              id={`pet-${pet.id}`}
              className="shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent flex items-center justify-center rounded-lg">
                      <SpeciesIcon className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{pet.name}</h3>
                      <p className="text-sm text-muted-foreground">{pet.breed}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(pet)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(pet.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {owner && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span 
                        onClick={() => handleOwnerClick(owner.id)}
                        className="hover:text-primary transition-colors cursor-pointer"
                      >
                        {owner.first_name} {owner.last_name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{pet.age || 0} year{(pet.age || 0) !== 1 ? 's' : ''} old</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Scale className="w-4 h-4" />
                    <span>{pet.weight || 0} lbs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className={`px-2 py-0.5 rounded text-xs capitalize ${vaccinationColors[vaccinationStatus]}`}>
                      {vaccinationStatus.replace('-', ' ')}
                    </span>
                  </div>
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
        title="Delete Pet?"
        description="This will permanently delete this pet. This action cannot be undone."
      />
    </>
  );
}
