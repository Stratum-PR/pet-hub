import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Calendar as CalendarIcon, Clock, Copy, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Appointment, Pet, BusinessClient, Service } from '@/hooks/useBusinessData';
import { format, isSameDay, startOfDay, addDays, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { BookingFormDialog } from '@/components/BookingFormDialog';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppointments, usePets, useClients, useServices } from '@/hooks/useBusinessData';
import { t } from '@/lib/translations';

export function BusinessAppointments() {
  const navigate = useNavigate();
  const { appointments, loading: appointmentsLoading, error: appointmentsError, refetch: refetchAppointments, addAppointment, updateAppointment, deleteAppointment, pushAppointment } = useAppointments();
  const { pets, error: petsError, refetch: refetchPets } = usePets();
  const { clients, error: clientsError, refetch: refetchClients } = useClients();
  const { services, error: servicesError, refetch: refetchServices } = useServices();
  const error = appointmentsError ?? petsError ?? clientsError ?? servicesError;
  const refetchAll = () => { refetchAppointments(); refetchPets(); refetchClients(); refetchServices(); };
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [showBookingLink, setShowBookingLink] = useState(false);
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const bookingLink = `${window.location.origin}/book-appointment`;

  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    appointments.forEach(apt => {
      const dateKey = apt.appointment_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(apt);
    });
    return grouped;
  }, [appointments]);

  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return appointmentsByDate[dateKey] || [];
  }, [selectedDate, appointmentsByDate]);

  const weekAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const weekStart = startOfWeek(selectedDate);
    const weekEnd = endOfWeek(selectedDate);
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    return weekDays.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: day,
        appointments: appointmentsByDate[dateKey] || [],
      };
    });
  }, [selectedDate, appointmentsByDate]);

  const handleCopyBookingLink = () => {
    navigator.clipboard.writeText(bookingLink);
    setBookingLinkCopied(true);
    toast.success(t('appointments.linkCopied'));
    setTimeout(() => setBookingLinkCopied(false), 2000);
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setAppointmentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (appointmentToDelete) {
      deleteAppointment(appointmentToDelete);
      setAppointmentToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleAddAppointment = async (appointmentData: any) => {
    // BookingFormDialog already inserted the appointment into the DB.
    // Just refetch to get the latest data — do NOT insert again (causes 23505 conflict).
    if (appointmentData?.id) {
      await refetchAppointments();
      setBookingDialogOpen(false);
      return;
    }
    // Fallback: if no id, the caller expects us to insert
    const newAppointment = {
      client_id: appointmentData.client_id,
      pet_id: appointmentData.pet_id,
      service_id: appointmentData.service_id,
      appointment_date: appointmentData.appointment_date ? format(new Date(appointmentData.appointment_date), 'yyyy-MM-dd') : undefined,
      start_time: appointmentData.start_time,
      end_time: appointmentData.end_time,
      status: appointmentData.status || 'scheduled',
      total_price: appointmentData.total_price || null,
      notes: appointmentData.notes || null,
    };
    
    await addAppointment(newAppointment as any);
    setBookingDialogOpen(false);
  };

  const handleUpdateAppointment = async (id: string, appointmentData: any) => {
    // Convert to new schema format
    const updateData: any = {};
    
    if (appointmentData.appointment_date) {
      updateData.appointment_date = format(appointmentData.appointment_date, 'yyyy-MM-dd');
    }
    if (appointmentData.start_time) updateData.start_time = appointmentData.start_time;
    if (appointmentData.end_time) updateData.end_time = appointmentData.end_time;
    if (appointmentData.client_id) updateData.client_id = appointmentData.client_id;
    if (appointmentData.pet_id) updateData.pet_id = appointmentData.pet_id;
    if (appointmentData.service_id) updateData.service_id = appointmentData.service_id;
    if (appointmentData.status) updateData.status = appointmentData.status;
    if (appointmentData.total_price !== undefined) updateData.total_price = appointmentData.total_price;
    if (appointmentData.notes !== undefined) updateData.notes = appointmentData.notes;
    
    await updateAppointment(id, updateData);
    setEditDialogOpen(false);
    setEditingAppointment(null);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'confirmed':
        return 'secondary';
      case 'canceled':
      case 'no_show':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatTime12H = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (appointmentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-destructive">Failed to load appointments.</p>
            <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
          </div>
          <Button variant="outline" onClick={() => refetchAll()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBookingLink(!showBookingLink)}
            className="flex items-center gap-2"
          >
            <LinkIcon className="w-4 h-4" />
            {t('appointments.bookingLink')}
          </Button>
          <Button
            onClick={() => setBookingDialogOpen(true)}
            className="shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('appointments.newAppointment')}
          </Button>
        </div>
      </div>

      {showBookingLink && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">{t('appointments.bookingLink')}</p>
                <p className="text-xs text-muted-foreground font-mono break-all">{bookingLink}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyBookingLink}
                className="ml-4"
              >
                {bookingLinkCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('appointments.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    {t('appointments.copy')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {t('appointments.calendar')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              modifiers={{
                hasAppointments: (date) => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  return !!appointmentsByDate[dateKey]?.length;
                },
              }}
              modifiersClassNames={{
                hasAppointments: 'bg-primary/10 text-primary font-semibold',
              }}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('appointments.weekView')}</CardTitle>
            <CardDescription>
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weekAppointments.map(({ date, appointments: dayAppointments }) => (
                <div key={format(date, 'yyyy-MM-dd')} className="border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className={cn(
                      "font-semibold",
                      isSameDay(date, new Date()) && "text-primary"
                    )}>
                      {format(date, 'EEEE, MMM d')}
                    </h3>
                    {isSameDay(date, new Date()) && (
                      <Badge variant="secondary" className="text-xs">Today</Badge>
                    )}
                  </div>
                  {dayAppointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No appointments</p>
                  ) : (
                    <div className="space-y-2">
                      {dayAppointments.map((appointment) => {
                        const pet = pets.find(p => p.id === appointment.pet_id);
                        const client = clients.find(c => c.id === (appointment as any).client_id);
                        const service = services.find(s => s.id === appointment.service_id);
                        
                        return (
                          <div
                            key={appointment.id}
                            className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{pet?.name || t('common.unknownPet')}</span>
                                <Badge variant={getStatusBadgeVariant(appointment.status)}>
                                  {appointment.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatTime12H(appointment.start_time)} •{' '}
                                {client ? `${client.first_name} ${client.last_name}` : t('common.unknownClient')}
                              </p>
                              {service && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {service.name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                ${appointment.total_price?.toFixed(2) || '0.00'}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(appointment)}
                                className="h-8 w-8"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(appointment.id)}
                                className="h-8 w-8 text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <BookingFormDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        clients={clients}
        pets={pets}
        services={services}
        appointments={appointments}
        onSuccess={(newAppointment?: any) => {
          console.log('[BusinessAppointments] onSuccess fired, appointment:', newAppointment?.id);
          // Immediately add to local state so the UI updates right away
          if (newAppointment?.id) {
            pushAppointment(newAppointment);
          }
          // Also refetch in the background for full consistency
          refetchAppointments();
        }}
        onAddAppointment={handleAddAppointment}
      />

      <EditAppointmentDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        appointment={editingAppointment}
        clients={clients}
        pets={pets}
        services={services}
        employees={[]} // TODO: Add employees hook
        appointments={appointments}
        onUpdate={handleUpdateAppointment}
        onSuccess={() => setEditDialogOpen(false)}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={t('appointments.deleteAppointmentTitle')}
        description={t('appointments.deleteAppointmentDescription')}
      />
    </div>
  );
}
