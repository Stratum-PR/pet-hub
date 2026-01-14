import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pet, Client } from '@/types';

interface PetFormProps {
  clients: Client[];
  onSubmit: (pet: Omit<Pet, 'id' | 'createdAt'>) => void;
  onCancel?: () => void;
}

export function PetForm({ clients, onSubmit, onCancel }: PetFormProps) {
  const [formData, setFormData] = useState({
    clientId: '',
    name: '',
    species: '' as 'dog' | 'cat' | 'other',
    breed: '',
    age: 0,
    weight: 0,
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      clientId: '',
      name: '',
      species: '' as 'dog' | 'cat' | 'other',
      breed: '',
      age: 0,
      weight: 0,
      notes: '',
    });
  };

  return (
    <Card className="border-2 border-border shadow-sm">
      <CardHeader>
        <CardTitle>Add New Pet</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Owner</Label>
              <Select
                value={formData.clientId}
                onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                required
              >
                <SelectTrigger className="border-2">
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
                className="border-2"
                placeholder="Buddy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="species">Species</Label>
              <Select
                value={formData.species}
                onValueChange={(value: 'dog' | 'cat' | 'other') => setFormData({ ...formData, species: value })}
                required
              >
                <SelectTrigger className="border-2">
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
              <Input
                id="breed"
                value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                required
                className="border-2"
                placeholder="Golden Retriever"
              />
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
                className="border-2"
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
                className="border-2"
                placeholder="45"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="border-2"
              placeholder="Any special grooming requirements, allergies, or behavioral notes..."
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="shadow-xs hover:shadow-sm transition-shadow">
              Add Pet
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="border-2">
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
