import { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, User, Dog, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { format, startOfDay, setHours, setMinutes, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { BusinessClient, Pet, Service, Appointment } from '@/hooks/useBusinessData';
import { Employee } from '@/types';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useSettings } from '@/hooks/useSupabaseData';
import { ensureAppointmentServiceIds } from '@/lib/appointmentServiceResolution';
import { staffOffersSelectedServices } from '@/lib/staffOfferedServices';
import { normalizeAppointmentStatus } from '@/lib/appointmentStatus';
import { t } from '@/lib/translations';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { useAuth } from '@/contexts/AuthContext';
import { isPastCalendarDay, isSlotStartInPast } from '@/lib/bookingPastSlots';
import { devConsole } from '@/lib/clientDebug';
import {
  parseBusinessHours,
  dateToDayKey,
  appointmentTimeSlotsForDay,
  findFirstOpenDayWithSlotsFrom,
  isBusinessClosedOnDate,
} from '@/lib/businessHours';
import { PastBookingConfirmDialog } from '@/components/PastBookingConfirmDialog';

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
  onUpdate: (id: string, appointment: Partial<Appointment>) => void | Promise<void>;
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
  const businessId = useBusinessId();
  const { settings } = useSettings();
  const { role } = useAuth();
  const employeeMayBookPast = role === 'employee';
  const normalizedClients: BusinessClient[] = Array.isArray(clients) ? clients : [];

  const hoursPerDay = useMemo(
    () => parseBusinessHours(settings?.business_hours),
    [settings?.business_hours],
  );

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
    staffId: '',
    services: [] as string[],
    status: 'scheduled' as
      | 'scheduled'
      | 'confirmed'
      | 'in-progress'
      | 'completed'
      | 'cancelled'
      | 'no_show',
    price: 0,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [pastConfirm, setPastConfirm] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const resolvedDurationMin = useMemo(() => {
    let sum = 0;
    for (const name of formData.services) {
      const s = services.find((x) => x.name === name);
      sum += s?.duration_minutes ?? 60;
    }
    return Math.max(30, sum);
  }, [formData.services, services]);

  const dayHoursEdit = selectedDate ? hoursPerDay[dateToDayKey(selectedDate)] : null;

  const editableTimeSlots = useMemo(() => {
    if (!dayHoursEdit || dayHoursEdit.closed) return [];
    const allowed = new Set(appointmentTimeSlotsForDay(dayHoursEdit));
    return TIME_SLOTS_24H.filter((t) => allowed.has(t));
  }, [dayHoursEdit]);

  const editAutoJumpRef = useRef(0);

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
        
        // Parse services: prefer catalog id, then service_type labels
        const serviceNames: string[] = [];
        try {
          const sid = (appointment as { service_id?: string | null }).service_id;
          if (sid) {
            const svc = services.find((s) => s.id === sid);
            if (svc) serviceNames.push(svc.name);
          }
          if (appointment.service_type) {
            for (const part of appointment.service_type.split(',').map((s) => s.trim()).filter(Boolean)) {
              if (!serviceNames.includes(part)) serviceNames.push(part);
            }
          }
        } catch (e) {
          devConsole.error('Error parsing services:', e);
        }
        
        setFormData({
          clientId: matchedClient?.id || '',
          clientName: matchedClient ? `${matchedClient.first_name} ${matchedClient.last_name}` : '',
          clientEmail: matchedClient?.email || '',
          clientPhone: matchedClient && matchedClient.phone ? formatPhoneNumber(matchedClient.phone) : '',
          petId: appointment.pet_id || '',
          petName: pet?.name || '',
          petBreed: pet?.breed || '',
          staffId: appointment.staff_id || '',
          services: serviceNames,
          status: (() => {
            const n = normalizeAppointmentStatus(appointment.status);
            if (n === 'in-progress' || n === 'in_progress') return 'in-progress' as const;
            if (n === 'canceled') return 'cancelled' as const;
            if (n === 'confirmed') return 'confirmed' as const;
            if (n === 'no-show' || n === 'no_show') return 'no_show' as const;
            if (n === 'completed') return 'completed' as const;
            if (n === 'cancelled') return 'cancelled' as const;
            return 'scheduled' as const;
          })(),
          price: appointment.price || 0,
          notes: appointment.notes || '',
        });
        setSelectedDate(appointmentDate);
        setSelectedTime(timeStr);
      } catch (error) {
        devConsole.error('Error initializing edit form:', error);
        // Set default values on error
        setFormData({
          clientId: '',
          clientName: '',
          clientEmail: '',
          clientPhone: '',
          petId: '',
          petName: '',
          petBreed: '',
          staffId: '',
          services: [],
          status: 'scheduled',
          price: 0,
          notes: '',
        });
        setSelectedDate(new Date());
        setSelectedTime('09:00');
      }
    }
  }, [appointment, open, pets, clients, services]);

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

  useEffect(() => {
    if (!open) editAutoJumpRef.current = 0;
  }, [open]);

  useEffect(() => {
    if (!open || !appointment) return;
    if (resolvedDurationMin <= 0) return;
    if (!selectedDate) return;
    if (editAutoJumpRef.current > 90) return;

    const closed = Boolean(dayHoursEdit?.closed);
    const hasGrid = editableTimeSlots.length > 0;
    const hasSelectable = editableTimeSlots.some((time24) => {
      const isBooked = getBookedTimes.includes(time24);
      const isCurrentAppointmentTime =
        appointment && format(new Date(appointment.scheduled_date), 'HH:mm') === time24;
      const isPast = selectedDate ? isSlotStartInPast(selectedDate, time24) : false;
      return (!isBooked || isCurrentAppointmentTime) && (!isPast || employeeMayBookPast);
    });

    if (!closed && hasGrid && hasSelectable) return;

    const next =
      closed || !hasGrid
        ? findFirstOpenDayWithSlotsFrom(startOfDay(selectedDate), hoursPerDay, resolvedDurationMin)
        : findFirstOpenDayWithSlotsFrom(
            addDays(startOfDay(selectedDate), 1),
            hoursPerDay,
            resolvedDurationMin,
          );

    if (!next) {
      editAutoJumpRef.current = 100;
      return;
    }
    if (!isSameDay(startOfDay(next), startOfDay(selectedDate))) {
      editAutoJumpRef.current += 1;
      setSelectedDate(next);
    }
  }, [
    open,
    appointment,
    selectedDate,
    dayHoursEdit?.closed,
    editableTimeSlots,
    getBookedTimes,
    resolvedDurationMin,
    hoursPerDay,
    employeeMayBookPast,
  ]);

  useEffect(() => {
    if (!open || !selectedTime || editableTimeSlots.length === 0) return;
    if (editableTimeSlots.includes(selectedTime)) return;
    const first = editableTimeSlots.find((time24) => {
      const isBooked = getBookedTimes.includes(time24);
      const isCurrentAppointmentTime =
        appointment && format(new Date(appointment.scheduled_date), 'HH:mm') === time24;
      const isPast = selectedDate ? isSlotStartInPast(selectedDate, time24) : false;
      return (!isBooked || isCurrentAppointmentTime) && (!isPast || employeeMayBookPast);
    });
    if (first) setSelectedTime(first);
  }, [
    editableTimeSlots,
    selectedTime,
    getBookedTimes,
    appointment,
    selectedDate,
    employeeMayBookPast,
    open,
  ]);

  useEffect(() => {
    if (!open) return;
    const tFirst = editableTimeSlots.find((time24) => {
      const isBooked = getBookedTimes.includes(time24);
      const isCurrentAppointmentTime =
        appointment && format(new Date(appointment.scheduled_date), 'HH:mm') === time24;
      const isPast = selectedDate ? isSlotStartInPast(selectedDate, time24) : false;
      return (!isBooked || isCurrentAppointmentTime) && (!isPast || employeeMayBookPast);
    });
    if (!tFirst) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .getElementById(`edit-appt-slot-${tFirst.replace(':', '-')}`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
  }, [open, selectedDate, editableTimeSlots, getBookedTimes, appointment, employeeMayBookPast]);

  const clientPets = useMemo(() => {
    if (!formData.clientId) return [];
    return pets.filter(p => p.client_id === formData.clientId);
  }, [formData.clientId, pets]);

  const selectedServiceIds = useMemo(() => {
    const ids: string[] = [];
    for (const name of formData.services) {
      const svc = services.find((s) => s.name === name);
      if (svc?.id) ids.push(svc.id);
    }
    return ids;
  }, [formData.services, services]);

  const assignableEmployees = useMemo(
    () => employees.filter((e) => staffOffersSelectedServices(e, selectedServiceIds)),
    [employees, selectedServiceIds]
  );

  useEffect(() => {
    if (!employees.length) return;
    setFormData((prev) => {
      if (!prev.staffId) return prev;
      const emp = employees.find((e) => e.id === prev.staffId);
      if (emp && staffOffersSelectedServices(emp, selectedServiceIds)) return prev;
      return { ...prev, staffId: '' };
    });
  }, [selectedServiceIds, employees]);

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

    const runUpdate = async () => {
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
      
      const biz = businessId ?? (appointment as { business_id?: string }).business_id;
      if (!biz) {
        alert('Business not loaded. Please refresh and try again.');
        setLoading(false);
        return;
      }

      const svcRes = await ensureAppointmentServiceIds(
        biz,
        formData.services,
        services.map((s) => ({ id: s.id, name: s.name, price: s.price }))
      );
      if (!svcRes.ok) {
        alert(svcRes.error);
        setLoading(false);
        return;
      }

      const statusForDb =
        formData.status === 'in-progress' ? 'in_progress' : formData.status;

      await onUpdate(appointment.id, {
        pet_id: formData.petId,
        staff_id: formData.staffId && formData.staffId !== '__unassigned__' ? formData.staffId : null,
        scheduled_date: appointmentDate.toISOString(),
        service_id: svcRes.primaryServiceId,
        service_type: svcRes.serviceType,
        status: statusForDb as any,
        price: formData.price,
        notes: formData.notes,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      devConsole.error('Error:', error);
      alert('Error updating appointment. Please try again.');
    } finally {
      setLoading(false);
    }
    };

    if (employeeMayBookPast && isSlotStartInPast(selectedDate, selectedTime)) {
      setPastConfirm({
        open: true,
        title: t('booking.pastConfirmTitle'),
        description: t('booking.pastTimeConfirm'),
        onConfirm: () => {
          void runUpdate();
        },
      });
      return;
    }

    await runUpdate();
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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl min-h-0 flex-col gap-0 overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-12">
        <DialogHeader className="pr-10 sm:pr-12">
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
                  disabled={(date) => {
                    if (isBusinessClosedOnDate(date, hoursPerDay)) return true;
                    if (employeeMayBookPast) return false;
                    return date < startOfDay(new Date());
                  }}
                  modifiers={{
                    ...(employeeMayBookPast
                      ? { pastDay: (d: Date) => isPastCalendarDay(d) }
                      : {}),
                    closedDay: (d: Date) => isBusinessClosedOnDate(d, hoursPerDay),
                  }}
                  modifiersClassNames={{
                    ...(employeeMayBookPast
                      ? {
                          pastDay:
                            'opacity-50 text-muted-foreground aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:opacity-100',
                        }
                      : {}),
                    closedDay:
                      'opacity-45 text-muted-foreground line-through decoration-muted-foreground/50',
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">Select Time *</Label>
              {editableTimeSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {dayHoursEdit?.closed
                    ? t('booking.closedThisDay')
                    : t('booking.noTimesInBusinessHours')}
                </p>
              ) : (
                <div className="max-h-[min(280px,45vh)] overflow-y-auto rounded-md border border-border p-2">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {editableTimeSlots.map((time24) => {
                      const isBooked = getBookedTimes.includes(time24);
                      const isSelected = selectedTime === time24;
                      const time12H = formatTime12H(time24);
                      const isCurrentAppointmentTime =
                        appointment && format(new Date(appointment.scheduled_date), 'HH:mm') === time24;
                      const isPast = selectedDate ? isSlotStartInPast(selectedDate, time24) : false;
                      const slotSelectable =
                        (!isBooked || isCurrentAppointmentTime) && (!isPast || employeeMayBookPast);

                      return (
                        <Button
                          key={time24}
                          type="button"
                          id={`edit-appt-slot-${time24.replace(':', '-')}`}
                          variant={isSelected ? 'default' : 'outline'}
                          onClick={() => slotSelectable && setSelectedTime(time24)}
                          disabled={!slotSelectable && !isSelected}
                          title={
                            isPast && employeeMayBookPast && (slotSelectable || isSelected)
                              ? t('booking.pastTimeHoverHint')
                              : undefined
                          }
                          className={cn(
                            'h-10',
                            (isPast || (!slotSelectable && !isSelected)) &&
                              'opacity-50 bg-muted text-muted-foreground',
                            slotSelectable && isPast && !isSelected && 'cursor-pointer',
                          )}
                        >
                          {time12H}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
              {getBookedTimes.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {getBookedTimes.length} time slot(s) already booked (greyed out)
                </p>
              ) : null}
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

          {/* Staff assignment */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Assign staff (optional)</Label>
              <Select
                value={formData.staffId || '__unassigned__'}
                onValueChange={(value) => setFormData({ ...formData, staffId: value === '__unassigned__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {assignableEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {formatStaffNameAggregated(employee.name)}
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
                onValueChange={(value: typeof formData.status) => 
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No-Show</SelectItem>
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
        </div>
      </DialogContent>
    </Dialog>
    <PastBookingConfirmDialog
      open={pastConfirm.open}
      onOpenChange={(o) => setPastConfirm((p) => ({ ...p, open: o }))}
      title={pastConfirm.title}
      description={pastConfirm.description}
      onConfirm={pastConfirm.onConfirm}
    />
    </>
  );
}
