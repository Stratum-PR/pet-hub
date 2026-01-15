import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pet, Client } from '@/types';
import { DOG_BREEDS } from '@/lib/dogBreeds';

interface PetFormProps {
  clients: Client[];
  onSubmit: (pet: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel?: () => void;
  initialData?: Pet | null;
  isEditing?: boolean;
}

const CAT_BREEDS = [
  'Mixed Breed - Shorthair',
  'Mixed Breed - Longhair',
  'Abyssinian',
  'American Shorthair',
  'Bengal',
  'Birman',
  'British Shorthair',
  'Burmese',
  'Devon Rex',
  'Exotic Shorthair',
  'Himalayan',
  'Maine Coon',
  'Norwegian Forest Cat',
  'Persian',
  'Ragdoll',
  'Russian Blue',
  'Scottish Fold',
  'Siamese',
  'Siberian',
  'Sphynx',
  'Other',
];

export function PetForm({ clients, onSubmit, onCancel, initialData, isEditing }: PetFormProps) {
  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    species: '' as 'dog' | 'cat' | 'other',
    breed: '',
    age: 0,
    weight: 0,
    notes: '',
    vaccination_status: 'unknown',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        client_id: initialData.client_id,
        name: initialData.name,
        species: initialData.species,
        breed: initialData.breed,
        age: initialData.age,
        weight: initialData.weight,
        notes: initialData.notes || '',
        vaccination_status: initialData.vaccination_status || 'unknown',
      });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    if (!isEditing) {
      setFormData({
        client_id: '',
        name: '',
        species: '' as 'dog' | 'cat' | 'other',
        breed: '',
        age: 0,
        weight: 0,
        notes: '',
        vaccination_status: 'unknown',
      });
    }
  };

  const getBreedOptions = () => {
    if (formData.species === 'dog') {
      return DOG_BREEDS;
    } else if (formData.species === 'cat') {
      return CAT_BREEDS;
    }
    return ['Other'];
  };

  return (
    <Card className="shadow-sm animate-fade-in">
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Pet' : 'Add New Pet'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Owner</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Pet Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Buddy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="species">Species</Label>
              <Select
                value={formData.species}
                onValueChange={(value: 'dog' | 'cat' | 'other') => 
                  setFormData({ ...formData, species: value, breed: '' })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select species" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dog">Dog</SelectItem>
                  <SelectItem value="cat">Cat</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="breed">Breed</Label>
              <Select
                value={formData.breed}
                onValueChange={(value) => setFormData({ ...formData, breed: value })}
                required
                disabled={!formData.species}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.species ? "Select breed" : "Select species first"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {getBreedOptions().map((breed) => (
                    <SelectItem key={breed} value={breed}>
                      {breed}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age (years)</Label>
              <Input
                id="age"
                type="number"
                min="0"
                value={formData.age || ''}
                onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                required
                placeholder="3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                min="0"
                step="0.1"
                value={formData.weight || ''}
                onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                required
                placeholder="45"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vaccination">Vaccination Status</Label>
              <Select
                value={formData.vaccination_status}
                onValueChange={(value) => setFormData({ ...formData, vaccination_status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="up-to-date">Up to Date</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any special grooming requirements, allergies, or behavioral notes..."
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="shadow-sm">
              {isEditing ? 'Update Pet' : 'Add Pet'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
