import { Pet, Client } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Dog, Cat, Rabbit, User, Scale, Calendar, Edit, Shield } from 'lucide-react';

interface PetListProps {
  pets: Pet[];
  clients: Client[];
  onDelete: (id: string) => void;
  onEdit: (pet: Pet) => void;
}

const speciesIcons = {
  dog: Dog,
  cat: Cat,
  other: Rabbit,
};

const vaccinationColors: Record<string, string> = {
  'up-to-date': 'bg-success/10 text-success',
  'overdue': 'bg-destructive/10 text-destructive',
  'pending': 'bg-warning/10 text-warning-foreground',
  'unknown': 'bg-muted text-muted-foreground',
};

export function PetList({ pets, clients, onDelete, onEdit }: PetListProps) {
  if (pets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No pets found. Add your first pet above!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {pets.map((pet) => {
        const owner = clients.find((c) => c.id === pet.client_id);
        const SpeciesIcon = speciesIcons[pet.species] || Rabbit;
        const vaccinationStatus = pet.vaccination_status || 'unknown';
        return (
          <Card key={pet.id} className="shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in">
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
                    onClick={() => onDelete(pet.id)}
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
                    <span>{owner.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{pet.age} year{pet.age !== 1 ? 's' : ''} old</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Scale className="w-4 h-4" />
                  <span>{pet.weight} lbs</span>
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
  );
}