import { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Dog, CheckCircle, Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { format, addDays, startOfDay, isSameDay, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { DOG_BREEDS } from '@/lib/dogBreeds';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { useBusinessId } from '@/hooks/useBusinessId';

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

// Combine all breed options (dogs and cats)
const BREED_OPTIONS = [...DOG_BREEDS, ...CAT_BREEDS.filter(b => !DOG_BREEDS.includes(b as any))];

const SERVICE_OPTIONS = [
  'Full Grooming',
  'Bath & Brush',
  'Nail Trim',
  'Ear Cleaning',
  'Teeth Cleaning',
  'Haircut',
  'De-shedding Treatment',
  'Flea & Tick Treatment',
  'Consultation',
  'Other'
];

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

export function BookAppointment() {
  const businessId = useBusinessId();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [formData, setFormData] = useState({
    clientName: '',
    petName: '',
    petId: '',
    petBreed: '',
    petSpecies: 'dog' as 'dog' | 'cat' | 'other',
    petAge: 0,
    petWeight: 0,
    services: [] as string[],
    notes: '',
    email: '',
    phone: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [phoneStep, setPhoneStep] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [matchingClient, setMatchingClient] = useState<any>(null);
  const [matchingPets, setMatchingPets] = useState<any[]>([]);
  const [phoneMatching, setPhoneMatching] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [showAddPetForm, setShowAddPetForm] = useState(false);

  // Fetch services from database
  useEffect(() => {
    const fetchServices = async () => {
      if (!businessId) return;
      
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', businessId)
        .order('name', { ascending: true });
      
      if (data) {
        setServices(data);
      }
    };
    fetchServices();
  }, [businessId]);

  // Fetch existing appointments for the selected date
  useEffect(() => {
    if (selectedDate && businessId) {
      const fetchAppointments = async () => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        // Try both appointment_date and scheduled_date for compatibility
        const { data } = await supabase
          .from('appointments')
          .select('appointment_date, start_time, scheduled_date')
          .eq('business_id', businessId)
          .or(`appointment_date.eq.${dateStr},scheduled_date.gte.${dateStr}T00:00:00`);
        
        if (data) {
          // Filter to only the selected date
          const filtered = data.filter(apt => {
            if (apt.appointment_date) {
              return apt.appointment_date === dateStr;
            }
            if (apt.scheduled_date) {
              const aptDate = new Date(apt.scheduled_date);
              return format(aptDate, 'yyyy-MM-dd') === dateStr;
            }
            return false;
          });
          setExistingAppointments(filtered);
        }
      };
      fetchAppointments();
    }
  }, [selectedDate, businessId]);

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

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handlePhoneLookup = async () => {
    if (!phoneInput) {
      alert('Please enter a phone number');
      return;
    }

    setPhoneMatching(true);
    try {
      const phoneDigits = unformatPhoneNumber(phoneInput);
      
      // Search for existing client by phone - fetch all and filter to handle different formats
      if (!businessId) {
        alert('Business ID not available. Please refresh the page.');
        return;
      }
      
      const { data: allClients } = await supabase
        .from('clients' as any)
        .select('*')
        .eq('business_id', businessId);
      
      // Find client with matching phone (normalize both for comparison)
      const matchingClientData = allClients?.find(c => {
        const cPhoneDigits = unformatPhoneNumber(c.phone);
        return cPhoneDigits === phoneDigits;
      });
      
      if (matchingClientData) {
        const clientData = {
          id: matchingClientData.id,
          first_name: matchingClientData.first_name || '',
          last_name: matchingClientData.last_name || '',
          email: matchingClientData.email || '',
          phone: matchingClientData.phone,
        };
        setMatchingClient(clientData);
        
        // Get pets for this client
        const { data: pets } = await supabase
          .from('pets')
          .select('*')
          .eq('client_id', matchingClientData.id)
          .eq('business_id', businessId);
        
        setMatchingPets(pets || []);
        setFormData(prev => ({
          ...prev,
          phone: formatPhoneNumber(matchingClientData.phone),
          email: matchingClientData.email || '',
          clientName: `${matchingClientData.first_name} ${matchingClientData.last_name}`,
        }));
      } else {
        setMatchingClient(null);
        setMatchingPets([]);
        setFormData(prev => ({
          ...prev,
          phone: formatPhoneNumber(phoneInput),
        }));
      }
      
      setPhoneStep(false);
    } catch (error) {
      console.error('Error looking up phone:', error);
      alert('Error looking up phone number. Please try again.');
    } finally {
      setPhoneMatching(false);
    }
  };

  const handleUseExistingClient = () => {
    if (matchingClient) {
      setFormData(prev => ({
        ...prev,
        clientName: `${matchingClient.first_name} ${matchingClient.last_name}`.trim(),
        email: matchingClient.email || '',
        phone: formatPhoneNumber(matchingClient.phone),
      }));
    }
  };

  const handleCreateNewClient = () => {
    // Clear client name so they can enter it fresh
    setFormData(prev => ({
      ...prev,
      clientName: '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime || !formData.clientName || (!formData.petId && !formData.petName) || !formData.phone || formData.services.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const phoneDigits = unformatPhoneNumber(formData.phone);
      let clientId: string | null = null;
      
      // Check if we have a matching client from phone lookup
      if (matchingClient) {
        // Verify name or pet name matches
        const fullName = `${matchingClient.first_name} ${matchingClient.last_name}`.trim().toLowerCase();
        const nameMatches = fullName.includes(formData.clientName.toLowerCase()) ||
                          formData.clientName.toLowerCase().includes(fullName);
        const petMatches = formData.petId || matchingPets.some(pet => 
          pet.name.toLowerCase() === formData.petName.toLowerCase()
        );
        
        if (nameMatches || petMatches) {
          // Use existing client
          clientId = matchingClient.id;
        } else {
          // Name/pet doesn't match, create new client
          if (!businessId) {
            alert('Business ID not available. Please refresh the page.');
            setLoading(false);
            return;
          }
          
          const nameParts = formData.clientName.split(' ');
          const first_name = nameParts[0] || '';
          const last_name = nameParts.slice(1).join(' ') || '';
          
          const { data: newCustomer } = await supabase
            .from('clients' as any)
            .insert({
              id: crypto.randomUUID(),
              business_id: businessId,
              first_name,
              last_name,
              email: formData.email || '',
              phone: phoneDigits,
              address: '',
            })
            .select()
            .single();
          
          if (newCustomer) {
            clientId = newCustomer.id;
          }
        }
      } else {
        // No matching client found, create new one
        if (!businessId) {
          alert('Business ID not available. Please refresh the page.');
          setLoading(false);
          return;
        }
        
        const nameParts = formData.clientName.split(' ');
        const first_name = nameParts[0] || '';
        const last_name = nameParts.slice(1).join(' ') || '';
        
        const { data: newCustomer } = await supabase
          .from('clients' as any)
          .insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            first_name,
            last_name,
            email: formData.email || '',
            phone: phoneDigits,
            address: '',
          })
          .select()
          .single();
        
        if (newCustomer) {
          clientId = newCustomer.id;
        }
      }

      // Handle pet - use existing if selected, otherwise create new
      let petId: string | null = null;
      if (clientId) {
        if (formData.petId) {
          // Use existing pet
          petId = formData.petId;
        } else {
          // Create new pet
          if (!businessId) {
            alert('Business ID not available. Please refresh the page.');
            setLoading(false);
            return;
          }
          
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
      }

      // Create appointment
      if (petId && selectedDate && businessId) {
        const [hours, minutes] = selectedTime.split(':');
        const appointmentDate = setMinutes(setHours(selectedDate, parseInt(hours)), parseInt(minutes));
        
        // Get service IDs from service names
        const serviceIds: string[] = [];
        for (const serviceName of formData.services) {
          const service = services.find(s => s.name === serviceName);
          if (service?.id) {
            serviceIds.push(service.id);
          }
        }
        
        const serviceType = formData.services.join(', ');
        // Calculate price from selected services
        const estimatedPrice = formData.services.reduce((total, serviceName) => {
          const service = services.find(s => s.name === serviceName);
          return total + (service?.price || 0);
        }, 0);

        // Use the first service ID if available, otherwise use service_type as fallback
        const primaryServiceId = serviceIds[0] || null;

        const { error } = await supabase
          .from('appointments')
          .insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            client_id: clientId,
            pet_id: petId,
            service_id: primaryServiceId,
            appointment_date: format(selectedDate, 'yyyy-MM-dd'),
            start_time: selectedTime,
            scheduled_date: appointmentDate.toISOString(), // Keep for backward compatibility
            service_type: serviceType, // Keep for backward compatibility
            status: 'scheduled',
            total_price: estimatedPrice,
            price: estimatedPrice, // Keep for backward compatibility
            notes: formData.notes || `Client: ${formData.clientName}\nPet: ${formData.petName || matchingPets.find(p => p.id === formData.petId)?.name}\nBreed: ${formData.petBreed}\nServices: ${serviceType}`,
          });

        if (!error) {
          setSubmitted(true);
          // Reset form
          setFormData({
            clientName: '',
            petName: '',
            petId: '',
            petBreed: '',
            petSpecies: 'dog',
            petAge: 0,
            petWeight: 0,
            services: [],
            notes: '',
            email: '',
            phone: '',
          });
          setSelectedDate(new Date());
          setSelectedTime('');
          setPhoneStep(true);
          setPhoneInput('');
          setMatchingClient(null);
          setMatchingPets([]);
          setShowAddPetForm(false);
        } else {
          alert('Error creating appointment. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error creating appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Appointment Request Submitted!</h2>
                <p className="text-muted-foreground mt-2">
                  You will receive a confirmation email shortly with your appointment details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Phone lookup step
  if (phoneStep) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Book an Appointment</CardTitle>
              <CardDescription className="text-lg">
                Schedule a grooming appointment for your pet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 justify-center">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <Label className="text-base font-semibold">Enter Your Phone Number</Label>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    We'll use your phone number to match you with our client database.
                  </p>
                  <div className="space-y-2">
                    <Input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(formatPhoneNumber(e.target.value))}
                      placeholder="(555) 123-4567"
                      className="text-center text-lg"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handlePhoneLookup();
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={handlePhoneLookup}
                    className="w-full"
                    size="lg"
                    disabled={phoneMatching || !phoneInput}
                  >
                    {phoneMatching ? 'Looking up...' : 'Continue'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Book an Appointment</CardTitle>
            <CardDescription className="text-lg">
              Schedule a grooming appointment for your pet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Date Selection */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Select Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
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
                    {TIME_SLOTS_24H.map((time24) => {
                      const isBooked = getBookedTimes.includes(time24);
                      const isSelected = selectedTime === time24;
                      const time12H = formatTime12H(time24);
                      
                      return (
                        <Button
                          key={time24}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => !isBooked && setSelectedTime(time24)}
                          disabled={isBooked}
                          className={cn(
                            "h-10",
                            isBooked && "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                          )}
                        >
                          {time12H}
                        </Button>
                      );
                    })}
                  </div>
                  {getBookedTimes.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {getBookedTimes.length} time slot(s) already booked (greyed out)
                    </p>
                  )}
                </div>
              )}

              {/* Client Information */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Your Information
                </h3>
                {matchingClient && (
                  <div className="p-4 bg-muted rounded-lg space-y-3">
                    <p className="text-sm font-medium">We found a client with this phone number:</p>
                    <div className="space-y-1 text-sm">
                      <p><strong>Name:</strong> {matchingClient.first_name} {matchingClient.last_name}</p>
                      {matchingClient.email && <p><strong>Email:</strong> {matchingClient.email}</p>}
                      {matchingPets.length > 0 && (
                        <div>
                          <strong>Pets:</strong>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {matchingPets.map(pet => (
                              <span key={pet.id} className="px-2 py-1 bg-background rounded text-xs">
                                {pet.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleUseExistingClient}
                      >
                        Use This Client
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCreateNewClient}
                      >
                        Create New Client
                      </Button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Your Name *</Label>
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
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Phone *</Label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
                      required
                      placeholder="(555) 123-4567"
                      disabled
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhoneStep(true);
                        setPhoneInput('');
                        setMatchingClient(null);
                        setMatchingPets([]);
                      }}
                      className="text-xs"
                    >
                      Change Phone Number
                    </Button>
                  </div>
                </div>
              </div>

              {/* Pet Information */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Dog className="w-5 h-5" />
                  Pet Information
                </h3>
                {matchingClient && matchingPets.length > 0 && !showAddPetForm ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Pet *</Label>
                      <Select
                        value={formData.petId}
                        onValueChange={(value) => {
                          const selectedPet = matchingPets.find(p => p.id === value);
                          if (selectedPet) {
                            setFormData({ 
                              ...formData, 
                              petId: value,
                              petName: selectedPet.name,
                              petBreed: selectedPet.breed,
                            });
                          }
                        }}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a pet" />
                        </SelectTrigger>
                        <SelectContent>
                          {matchingPets.map(pet => (
                            <SelectItem key={pet.id} value={pet.id}>
                              {pet.name} - {pet.breed}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddPetForm(true);
                        setFormData({ ...formData, petId: '', petName: '', petBreed: '' });
                      }}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Pet
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pet Name *</Label>
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
                      <Label>Pet Breed *</Label>
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
                    {showAddPetForm && matchingClient && (
                      <div className="md:col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAddPetForm(false);
                            if (matchingPets.length > 0) {
                              setFormData({ ...formData, petId: matchingPets[0].id, petName: matchingPets[0].name, petBreed: matchingPets[0].breed });
                            }
                          }}
                        >
                          Cancel - Use Existing Pet
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Services */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Services Needed *
                </h3>
                {services.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {services.map(service => (
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
                          {service.price > 0 && (
                            <div className="text-xs text-muted-foreground">${service.price.toFixed(2)}</div>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No services available. Please contact the business.</p>
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
              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loading || !selectedDate || !selectedTime || !formData.clientName || !formData.petName || !formData.phone || formData.services.length === 0}
                >
                  {loading ? 'Submitting...' : 'Submit Appointment Request'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
