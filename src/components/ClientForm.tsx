import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Dog, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Client, Pet } from '@/types';
import { formatPhoneNumber } from '@/lib/phoneFormat';
import { CreditCard } from 'lucide-react';
import { t } from '@/lib/translations';
import { Badge } from '@/components/ui/badge';

interface ClientFormProps {
  onSubmit: (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel?: () => void;
  initialData?: Client | null;
  isEditing?: boolean;
  pets?: Pet[];
  onUpdatePet?: (id: string, pet: Partial<Pet>) => void;
}

export function ClientForm({ onSubmit, onCancel, initialData, isEditing, pets = [], onUpdatePet }: ClientFormProps) {
  const [petSearch, setPetSearch] = useState('');
  const [petOpen, setPetOpen] = useState(false);
  
  // Get pets assigned to this client
  const clientPets = useMemo(() => {
    if (!initialData || !isEditing) return [];
    return pets.filter(p => String(p.client_id) === String(initialData.id));
  }, [pets, initialData, isEditing]);
  
  // Get pets without owners (null client_id)
  const unassignedPets = useMemo(() => {
    return pets.filter(p => !p.client_id || p.client_id === null || p.client_id === '');
  }, [pets]);
  
  const handleAssignPet = (petId: string) => {
    if (onUpdatePet && initialData) {
      onUpdatePet(petId, { client_id: initialData.id });
      setPetOpen(false);
      setPetSearch('');
    }
  };
  
  const handleUnassignPet = (petId: string) => {
    if (onUpdatePet) {
      onUpdatePet(petId, { client_id: null });
    }
  };
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    card_number: '',
    card_name: '',
    card_expiry: '',
    card_cvv: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        email: initialData.email,
        phone: formatPhoneNumber(initialData.phone),
        address: initialData.address || '',
        notes: initialData.notes || '',
        card_number: initialData.card_number || '',
        card_name: initialData.card_name || '',
        card_expiry: initialData.card_expiry || '',
        card_cvv: initialData.card_cvv || '',
      });
    }
  }, [initialData]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setFormData({ ...formData, card_number: formatted });
  };

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiry(e.target.value);
    setFormData({ ...formData, card_expiry: formatted });
  };

  const handleCardCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 4);
    setFormData({ ...formData, card_cvv: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    if (!isEditing) {
      setFormData({ 
        name: '', 
        email: '', 
        phone: '', 
        address: '', 
        notes: '',
        card_number: '',
        card_name: '',
        card_expiry: '',
        card_cvv: '',
      });
    }
  };

  return (
    <Card id="client-form" className="shadow-sm animate-fade-in">
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Client' : 'Add New Client'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('form.fullName')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('form.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('form.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={handlePhoneChange}
                required
                placeholder="(787) 349-3444"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t('form.addressOptional')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{t('form.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes about this client..."
              rows={2}
            />
          </div>

          {/* Pets Section - Show existing pets and allow adding unassigned pets */}
          {isEditing && initialData && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dog className="w-5 h-5 text-muted-foreground" />
                  <Label className="text-base font-semibold">Mascotas</Label>
                </div>
                <Popover open={petOpen} onOpenChange={setPetOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Añadir Mascota
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="end">
                    <Command>
                      <CommandInput 
                        placeholder="Buscar mascota sin dueño por nombre o raza..." 
                        value={petSearch}
                        onValueChange={setPetSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No se encontraron mascotas sin dueño.</CommandEmpty>
                        <CommandGroup>
                          {unassignedPets
                            .filter((pet) => {
                              if (!petSearch) return true;
                              const search = petSearch.toLowerCase();
                              const petName = (pet.name || '').toLowerCase();
                              const breedName = ((pet as any).breeds?.name || pet.breed || '').toLowerCase();
                              return petName.includes(search) || breedName.includes(search);
                            })
                            .map((pet) => {
                              const breedName = (pet as any).breeds?.name || pet.breed || 'Sin raza';
                              return (
                                <CommandItem
                                  key={pet.id}
                                  value={pet.id}
                                  onSelect={() => handleAssignPet(pet.id)}
                                >
                                  <div className="flex flex-col flex-1">
                                    <span className="font-medium">{pet.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {breedName} • {pet.species}
                                    </span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Display assigned pets */}
              <div className="space-y-2">
                {clientPets.length > 0 ? (
                  <div className="space-y-2">
                    {clientPets.map((pet) => {
                      const breedName = (pet as any).breeds?.name || pet.breed || 'Sin raza';
                      return (
                        <div
                          key={pet.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-card"
                        >
                          <div className="flex flex-col flex-1">
                            <span className="font-medium">{pet.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {breedName} • {pet.species}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnassignPet(pet.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Este cliente no tiene mascotas registradas.</p>
                )}
              </div>
            </div>
          )}

          {/* Payment Details Section */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <Label className="text-base font-semibold">{t('form.paymentDetails')}</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('form.paymentDetailsDesc')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="card_number">{t('form.cardNumber')}</Label>
                <Input
                  id="card_number"
                  value={formData.card_number}
                  onChange={handleCardNumberChange}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card_name">{t('form.cardName')}</Label>
                <Input
                  id="card_name"
                  value={formData.card_name}
                  onChange={(e) => setFormData({ ...formData, card_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card_expiry">{t('form.cardExpiry')}</Label>
                <Input
                  id="card_expiry"
                  value={formData.card_expiry}
                  onChange={handleCardExpiryChange}
                  placeholder="MM/YY"
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card_cvv">{t('form.cardCvv')}</Label>
                <Input
                  id="card_cvv"
                  type="password"
                  value={formData.card_cvv}
                  onChange={handleCardCvvChange}
                  placeholder="123"
                  maxLength={4}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="shadow-sm">
              {isEditing ? t('common.edit') + ' ' + t('clients.title') : t('clients.addClient')}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
