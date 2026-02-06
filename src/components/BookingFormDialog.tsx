import { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Dog, CheckCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { format, startOfDay, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { DOG_BREEDS } from '@/lib/dogBreeds';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { BusinessClient, Pet, Service } from '@/hooks/useBusinessData';
import { useBusinessId } from '@/hooks/useBusinessId';
import { t } from '@/lib/translations';

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

const BREED_OPTIONS = [...DOG_BREEDS, ...CAT_BREEDS.filter(b => !DOG_BREEDS.includes(b as any))];

// Time slots in 24-hour format for internal use
const TIME_SLOTS_24H = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30'
];

// Convert 24-hour time to 12-hour AM/PM format
const formatTime12H = (time24: string): string => {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Convert 12-hour AM/PM format back to 24-hour
const parseTime12H = (time12: string): string => {
  const [time, ampm] = time12.split(' ');
  const [hours, minutes] = time.split(':');
  let hour = parseInt(hours);
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
};

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients?: BusinessClient[];
  pets: Pet[];
  services: Service[];
  appointments: any[];
  onSuccess: (newAppointment?: any) => void;
  onAddAppointment?: (appointment: any) => void;
}

export function BookingFormDialog({
  open,
  onOpenChange,
  clients,
  pets,
  services,
  appointments,
  onSuccess,
  onAddAppointment,
}: BookingFormDialogProps) {
  const businessId = useBusinessId();
  // Defensive defaults: during demo/public mode or while data hooks are loading,
  // these can be temporarily undefined. Avoid runtime crashes.
  const safeClients: BusinessClient[] = Array.isArray(clients) ? clients : [];
  const safePets = Array.isArray(pets) ? pets : [];
  const safeServices = Array.isArray(services) ? services : [];
  const safeAppointments = Array.isArray(appointments) ? appointments : [];

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    petId: '',
    petName: '',
    petBreed: '',
    petSpecies: 'dog' as 'dog' | 'cat' | 'other',
    petAge: 0,
    petWeight: 0,
    services: [] as string[],
    notes: '',
    createNewClient: false,
    createNewPet: false,
  });
  const [loading, setLoading] = useState(false);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        clientId: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        petId: '',
        petName: '',
        petBreed: '',
        petSpecies: 'dog',
        petAge: 0,
        petWeight: 0,
        services: [],
        notes: '',
        createNewClient: false,
        createNewPet: false,
      });
      setSelectedDate(new Date());
      setSelectedTime('');
    }
  }, [open]);

  // Fetch existing appointments for the selected date
  useEffect(() => {
    if (selectedDate && open) {
      const fetchAppointments = async () => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const { data } = await supabase
          .from('appointments')
          .select('scheduled_date')
          .gte('scheduled_date', `${dateStr}T00:00:00`)
          .lt('scheduled_date', `${dateStr}T23:59:59`);
        
        if (data) {
          setExistingAppointments(data);
        }
      };
      fetchAppointments();
    }
  }, [selectedDate, open]);

  const getBookedTimes = useMemo(() => {
    if (!selectedDate || existingAppointments.length === 0) return [];
    return existingAppointments.map(apt => {
      const date = new Date(apt.scheduled_date);
      return format(date, 'HH:mm');
    });
  }, [selectedDate, existingAppointments]);

  const availableTimeSlots = useMemo(() => {
    return TIME_SLOTS_24H.filter(time => !getBookedTimes.includes(time));
  }, [getBookedTimes]);

  const clientPets = useMemo(() => {
    if (!formData.clientId) return [];
    return safePets.filter((p: any) => p.client_id === formData.clientId);
  }, [formData.clientId, safePets]);

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleClientChange = (clientId: string) => {
    const client = safeClients.find(c => c.id === clientId);
    if (client) {
      setFormData(prev => ({
        ...prev,
        clientId,
        clientName: `${client.first_name} ${client.last_name}`,
        clientEmail: client.email || '',
        clientPhone: formatPhoneNumber(client.phone),
        createNewClient: false,
        petId: '',
        petName: '',
      }));
    }
  };

  const handlePetChange = (petId: string) => {
    const pet = safePets.find(p => p.id === petId);
    if (pet) {
      setFormData(prev => ({
        ...prev,
        petId,
        petName: pet.name,
        petBreed: pet.breed,
        petSpecies: pet.species,
        createNewPet: false,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime || !formData.clientName || (!formData.petId && !formData.petName) || formData.services.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      let clientId = formData.clientId;
      
      // Create client if new
      if (!clientId || formData.createNewClient) {
        const phoneDigits = unformatPhoneNumber(formData.clientPhone);
        // Split name into first and last
        const nameParts = formData.clientName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            first_name: firstName,
            last_name: lastName,
            email: formData.clientEmail || null,
            phone: phoneDigits,
            address: null,
          })
          .select()
          .single();
        
        if (newClient) {
          clientId = newClient.id;
        }
      }

      // Create or use pet
      let petId = formData.petId;
      if (!petId || formData.createNewPet) {
        const { data: newPet } = await supabase
          .from('pets')
          .insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            client_id: clientId,
            name: formData.petName,
            species: formData.petSpecies || 'other',
            breed: formData.petBreed || 'Unknown',
            age: formData.petAge || 0,
            weight: formData.petWeight || 0,
          })
          .select()
          .single();
        
        if (newPet) {
          petId = newPet.id;
        }
      }

      // Create appointment
      if (petId && selectedDate) {
        const [hours, minutes] = selectedTime.split(':');
        const appointmentDate = setMinutes(setHours(selectedDate, parseInt(hours)), parseInt(minutes));
        
        const serviceType = formData.services.join(', ');
        const estimatedPrice = formData.services.reduce((total, serviceName) => {
          const service = services.find(s => s.name === serviceName);
          return total + (service?.price || 0);
        }, 0);

        // Find the primary service ID
        const primaryService = safeServices.find(s => formData.services.includes(s.name));

        const { data: newAppointment, error } = await supabase
          .from('appointments')
          .insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            client_id: clientId,
            pet_id: petId,
            service_id: primaryService?.id || null,
            appointment_date: format(selectedDate, 'yyyy-MM-dd'),
            start_time: selectedTime,
            scheduled_date: appointmentDate.toISOString(),
            service_type: serviceType,
            status: 'scheduled',
            total_price: estimatedPrice,
            price: estimatedPrice,
            notes: formData.notes || `Client: ${formData.clientName}\nPet: ${formData.petName}\nServices: ${serviceType}`,
          })
          .select()
          .single();

        if (error) {
          console.error('[BookingFormDialog] Appointment insert error:', error.message, error.code);
          alert('Error creating appointment. Please try again.');
        } else {
          console.log('[BookingFormDialog] Appointment created successfully:', newAppointment?.id);
          // Reset form first, then notify parent
          setFormData({
            clientId: '',
            clientName: '',
            clientEmail: '',
            clientPhone: '',
            petId: '',
            petName: '',
            petBreed: '',
            petSpecies: 'dog',
            petAge: 0,
            petWeight: 0,
            services: [],
            notes: '',
            createNewClient: false,
            createNewPet: false,
          });
          setSelectedDate(new Date());
          setSelectedTime('');
          onSuccess(newAppointment);
          onOpenChange(false);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error creating appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Book New Appointment</DialogTitle>
          <DialogDescription>
            Schedule a grooming appointment for a client
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Select Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < startOfDay(new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">Select Time *</Label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {availableTimeSlots.length > 0 ? (
                  availableTimeSlots.map((time) => (
                    <Button
                      key={time}
                      type="button"
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => setSelectedTime(time)}
                      className="h-10"
                    >
                      {time}
                    </Button>
                  ))
                ) : (
                  <p className="col-span-full text-center text-muted-foreground py-4">
                    No available time slots for this date. Please select another date.
                  </p>
                )}
              </div>
              {getBookedTimes.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {getBookedTimes.length} time slot(s) already booked
                </p>
              )}
            </div>
          )}

          {/* Client Information */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              {t('form.clientInformation')}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('form.selectClientOrCreate')}</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.createNewClient ? '__new__' : formData.clientId}
                    onValueChange={(value) => {
                      if (value === '__new__') {
                        setFormData(prev => ({ ...prev, createNewClient: true, clientId: '', clientName: '', clientEmail: '', clientPhone: '' }));
                      } else {
                        handleClientChange(value);
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t('form.selectExistingClient')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__new__">
                        <Plus className="w-4 h-4 inline mr-2" />
                        {t('form.createNewClient')}
                      </SelectItem>
                      {safeClients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name} - {formatPhoneNumber(c.phone)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('form.clientName')} *</Label>
                  <Input
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Phone *</Label>
                  <Input
                    type="tel"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: formatPhoneNumber(e.target.value) })}
                    required
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pet Information */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Dog className="w-5 h-5" />
              {t('form.petInformation')}
            </h3>
            {formData.clientId && clientPets.length > 0 && !formData.createNewPet ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('form.selectPetOrCreate')}</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.createNewPet ? '__new__' : formData.petId}
                      onValueChange={(value) => {
                        if (value === '__new__') {
                          setFormData(prev => ({ ...prev, createNewPet: true, petId: '', petName: '', petBreed: '' }));
                        } else {
                          handlePetChange(value);
                        }
                      }}
                    >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t('form.selectExistingPet')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__new__">
                        <Plus className="w-4 h-4 inline mr-2" />
                        {t('form.addNewPet')}
                      </SelectItem>
                        {clientPets.map(pet => (
                          <SelectItem key={pet.id} value={pet.id}>
                            {pet.name} {pet.breed ? `(${pet.breed})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('form.petName')} *</Label>
                  <Input
                    value={formData.petName}
                    onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                    required
                    placeholder="Buddy"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pet Species *</Label>
                  <Select
                    value={formData.petSpecies}
                    onValueChange={(value: 'dog' | 'cat' | 'other') => setFormData({ ...formData, petSpecies: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dog">Dog</SelectItem>
                      <SelectItem value="cat">Cat</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('form.breed')} *</Label>
                  <Select
                    value={formData.petBreed}
                    onValueChange={(value) => setFormData({ ...formData, petBreed: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select breed" />
                    </SelectTrigger>
                    <SelectContent>
                      {BREED_OPTIONS.map(breed => (
                        <SelectItem key={breed} value={breed}>
                          {breed}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Age (years)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.petAge}
                    onChange={(e) => setFormData({ ...formData, petAge: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weight (lbs)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.petWeight}
                    onChange={(e) => setFormData({ ...formData, petWeight: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Services */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Services Needed *
            </h3>
            {safeServices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {safeServices.map(service => (
                  <Button
                    key={service.id}
                    type="button"
                    variant={formData.services.includes(service.name) ? "default" : "outline"}
                    onClick={() => handleServiceToggle(service.name)}
                    className="justify-start h-auto py-3"
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border mr-2 flex items-center justify-center",
                      formData.services.includes(service.name) ? "bg-primary border-primary" : "border-border"
                    )}>
                      {formData.services.includes(service.name) && (
                        <CheckCircle className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{service.name}</div>
                      {typeof (service as any).price === 'number' && (service as any).price > 0 && (
                        <div className="text-xs text-muted-foreground">${(service as any).price.toFixed(2)}</div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No services available. Please add services first.</p>
            )}
            {formData.services.length === 0 && (
              <p className="text-sm text-muted-foreground">Please select at least one service</p>
            )}
          </div>

          {/* Additional Notes */}
          <div className="space-y-2 border-t pt-4">
            <Label>Additional Notes (Optional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any special instructions or requests..."
              className="min-h-[100px]"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1"
              size="lg"
              disabled={loading || !selectedDate || !selectedTime || !formData.clientName || (!formData.petId && !formData.petName) || formData.services.length === 0}
            >
              {loading ? 'Creating...' : 'Create Appointment'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
