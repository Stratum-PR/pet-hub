import { Pet, Client } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Dog, Cat, Rabbit, User, Scale, Calendar } from 'lucide-react';

interface PetListProps {
  pets: Pet[];
  clients: Client[];
  onDelete: (id: string) => void;
}

const speciesIcons = {
  dog: Dog,
  cat: Cat,
  other: Rabbit,
};

export function PetList({ pets, clients, onDelete }: PetListProps) {
  if (pets.length === 0) {
    return (
      <Card className="border-2 border-dashed border-border">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No pets yet. Add your first pet above!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {pets.map((pet) => {
        const owner = clients.find((c) => c.id === pet.clientId);
        const SpeciesIcon = speciesIcons[pet.species] || Rabbit;
        return (
          <Card key={pet.id} className="border-2 border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent flex items-center justify-center border-2 border-border">
                    <SpeciesIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{pet.name}</h3>
                    <p className="text-sm text-muted-foreground">{pet.breed}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(pet.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
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
              </div>
              {pet.notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">{pet.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
