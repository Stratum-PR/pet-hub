import { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Dog, CheckCircle } from 'lucide-react';
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
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { BusinessClient, Pet, Service, Appointment } from '@/hooks/useBusinessData';
import { Employee } from '@/types';
import { t } from '@/lib/translations';

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

interface EditAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  clients: BusinessClient[];
  pets: Pet[];
  services: Service[];
  employees: Employee[];
  appointments: Appointment[];
  onUpdate: (id: string, appointment: Partial<Appointment>) => void;
  onSuccess: () => void;
}

export function EditAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  clients,
  pets,
  services,
  employees,
  appointments,
  onUpdate,
  onSuccess,
}: EditAppointmentDialogProps) {
  const normalizedClients: BusinessClient[] = Array.isArray(clients) ? clients : [];

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
    employeeId: '',
    services: [] as string[],
    status: 'scheduled' as 'scheduled' | 'in-progress' | 'completed' | 'cancelled',
    price: 0,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);

  // Initialize form data when appointment changes
  useEffect(() => {
    if (appointment && open && appointment.pet_id) {
      try {
        const pet = pets.find(p => p.id === appointment.pet_id);
        const matchedClient = pet ? normalizedClients.find(c => c.id === pet.client_id) : null;
        
        // Safely parse date
        let appointmentDate: Date;
        let timeStr = '';
        try {
          appointmentDate = appointment.scheduled_date ? new Date(appointment.scheduled_date) : new Date();
          if (isNaN(appointmentDate.getTime())) {
            appointmentDate = new Date();
          }
          timeStr = format(appointmentDate, 'HH:mm');
        } catch (e) {
          appointmentDate = new Date();
          timeStr = '09:00';
        }
        
        // Parse services from service_type string - handle null/undefined
        let serviceNames: string[] = [];
        try {
          if (appointment.service_type) {
            serviceNames = appointment.service_type.split(',').map(s => s.trim()).filter(s => s.length > 0);
          }
        } catch (e) {
          console.error('Error parsing services:', e);
        }
        
        setFormData({
          clientId: matchedClient?.id || '',
          clientName: matchedClient ? `${matchedClient.first_name} ${matchedClient.last_name}` : '',
          clientEmail: matchedClient?.email || '',
          clientPhone: matchedClient && matchedClient.phone ? formatPhoneNumber(matchedClient.phone) : '',
          petId: appointment.pet_id || '',
          petName: pet?.name || '',
          petBreed: pet?.breed || '',
          employeeId: appointment.employee_id || '',
          services: serviceNames,
          status: (appointment.status as any) || 'scheduled',
          price: appointment.price || 0,
          notes: appointment.notes || '',
        });
        setSelectedDate(appointmentDate);
        setSelectedTime(timeStr);
      } catch (error) {
        console.error('Error initializing edit form:', error);
        // Set default values on error
        setFormData({
          clientId: '',
          clientName: '',
          clientEmail: '',
          clientPhone: '',
          petId: '',
          petName: '',
          petBreed: '',
          employeeId: '',
          services: [],
          status: 'scheduled',
          price: 0,
          notes: '',
        });
        setSelectedDate(new Date());
        setSelectedTime('09:00');
      }
    }
  }, [appointment, open, pets, clients]);

  // Fetch existing appointments for the selected date (excluding current appointment)
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
          // Exclude current appointment from booked times
          const filtered = data.filter(apt => {
            if (!appointment) return true;
            const aptDate = new Date(apt.scheduled_date);
            const currentDate = new Date(appointment.scheduled_date);
            return aptDate.getTime() !== currentDate.getTime();
          });
          setExistingAppointments(filtered);
        }
      };
      fetchAppointments();
    }
  }, [selectedDate, open, appointment]);

  const getBookedTimes = useMemo(() => {
    if (!selectedDate || existingAppointments.length === 0) return [];
    return existingAppointments.map(apt => {
      const date = new Date(apt.scheduled_date);
      return format(date, 'HH:mm');
    });
  }, [selectedDate, existingAppointments]);

  const availableTimeSlots = useMemo(() => {
    // If editing and time hasn't changed, include current time slot
    const currentTime = appointment ? format(new Date(appointment.scheduled_date), 'HH:mm') : '';
    const slots = TIME_SLOTS_24H.filter(time => !getBookedTimes.includes(time));
    if (currentTime && !slots.includes(currentTime)) {
      return [currentTime, ...slots].sort();
    }
    return slots;
  }, [getBookedTimes, appointment]);

  const clientPets = useMemo(() => {
    if (!formData.clientId) return [];
    return pets.filter(p => p.client_id === formData.clientId);
  }, [formData.clientId, pets]);

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleClientChange = (clientId: string) => {
    const selectedClient = normalizedClients.find(c => c.id === clientId);
    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        clientId,
        clientName: `${selectedClient.first_name} ${selectedClient.last_name}`,
        clientEmail: selectedClient.email || '',
        clientPhone: formatPhoneNumber(selectedClient.phone),
        petId: '',
        petName: '',
      }));
    }
  };

  const handlePetChange = (petId: string) => {
    const pet = pets.find(p => p.id === petId);
    if (pet) {
      setFormData(prev => ({
        ...prev,
        petId,
        petName: pet.name,
        petBreed: pet.breed,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment || !selectedDate || !selectedTime || !formData.clientName || !formData.petId || formData.services.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      // Update client if info changed
      if (formData.clientId) {
        const existingClient = normalizedClients.find(c => c.id === formData.clientId);
        if (existingClient) {
          const nameParts = formData.clientName.trim().split(' ');
          const firstName = nameParts[0] || existingClient.first_name;
          const lastName = nameParts.slice(1).join(' ') || existingClient.last_name;
          
          if (existingClient.first_name !== firstName || existingClient.last_name !== lastName || 
              existingClient.email !== formData.clientEmail || existingClient.phone !== unformatPhoneNumber(formData.clientPhone)) {
            await supabase
              .from('clients')
              .update({
                first_name: firstName,
                last_name: lastName,
                email: formData.clientEmail || existingClient.email || null,
                phone: unformatPhoneNumber(formData.clientPhone) || existingClient.phone,
              })
              .eq('id', existingClient.id);
          }
        }
      }

      // Update pet if info changed
      if (formData.petId) {
        const pet = pets.find(p => p.id === formData.petId);
        if (pet && (pet.name !== formData.petName || pet.breed !== formData.petBreed)) {
          await supabase
            .from('pets')
            .update({
              name: formData.petName,
              breed: formData.petBreed || pet.breed,
            })
            .eq('id', pet.id);
        }
      }

      // Update appointment
      if (!selectedDate) {
        alert('Please select a date');
        return;
      }
      const [hours, minutes] = selectedTime.split(':');
      const appointmentDate = setMinutes(setHours(selectedDate, parseInt(hours)), parseInt(minutes));
      
      const serviceType = formData.services.join(', ');
      const estimatedPrice = formData.services.reduce((total, serviceName) => {
        const service = services.find(s => s.name === serviceName);
        return total + (service?.price || 0);
      }, 0);

      onUpdate(appointment.id, {
        pet_id: formData.petId,
        employee_id: formData.employeeId && formData.employeeId !== '__unassigned__' ? formData.employeeId : null,
        scheduled_date: appointmentDate.toISOString(),
        service_type: serviceType,
        status: formData.status,
        price: estimatedPrice,
        notes: formData.notes,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error:', error);
      alert('Error updating appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Don't render if no appointment or dialog is closed
  if (!appointment) {
    return null;
  }

  // Safety check - if appointment data is invalid, show error
  if (!appointment.pet_id) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Invalid appointment data. Please try again.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Edit Appointment</DialogTitle>
          <DialogDescription>
            Update appointment details, client information, and pet information
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
                  selected={selectedDate || new Date()}
                  onSelect={(date) => date && setSelectedDate(date)}
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
                  // Allow selecting current appointment's time even if it appears booked
                  const isCurrentAppointmentTime = appointment && format(new Date(appointment.scheduled_date), 'HH:mm') === time24;
                  const canSelect = !isBooked || isCurrentAppointmentTime;
                  
                  return (
                    <Button
                      key={time24}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => canSelect && setSelectedTime(time24)}
                      disabled={!canSelect && !isSelected}
                      className={cn(
                        "h-10",
                        !canSelect && !isSelected && "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
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
              {t('form.clientInformation')}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('form.selectClient')}</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={handleClientChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.selectClient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {normalizedClients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} - {formatPhoneNumber(c.phone)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              Pet Information
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('form.selectPet')} *</Label>
                <Select
                  value={formData.petId}
                  onValueChange={handlePetChange}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.selectPet')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientPets.length > 0 ? clientPets : pets.filter(p => p.id === formData.petId)).map(pet => (
                      <SelectItem key={pet.id} value={pet.id}>
                        {pet.name} - {pet.breed}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <Label>{t('form.breed')}</Label>
                  <Input
                    value={formData.petBreed}
                    onChange={(e) => setFormData({ ...formData, petBreed: e.target.value })}
                    placeholder="Golden Retriever"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Employee Assignment */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Assign Employee (Optional)</Label>
              <Select
                value={formData.employeeId || '__unassigned__'}
                onValueChange={(value) => setFormData({ ...formData, employeeId: value === '__unassigned__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {employees.filter(e => e.status === 'active').map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Services *
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
              <p className="text-sm text-muted-foreground">No services available.</p>
            )}
            {formData.services.length === 0 && (
              <p className="text-sm text-muted-foreground">Please select at least one service</p>
            )}
          </div>

          {/* Status and Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'scheduled' | 'in-progress' | 'completed' | 'cancelled') => 
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Price ($) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                required
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2 border-t pt-4">
            <Label>Additional Notes</Label>
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
              disabled={loading || !selectedDate || !selectedTime || !formData.clientName || !formData.petId || formData.services.length === 0}
            >
              {loading ? 'Updating...' : 'Update Appointment'}
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
