import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Edit, Trash2, Calendar as CalendarIcon, Clock, User, Dog, Copy, Link as LinkIcon, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Appointment, Pet, Employee, Client, Service } from '@/types';
import { format, isSameDay, startOfDay, addDays, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { BookingFormDialog } from '@/components/BookingFormDialog';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatPhoneNumber } from '@/lib/phoneFormat';
import { t } from '@/lib/translations';

interface AppointmentsProps {
  appointments: Appointment[];
  pets: Pet[];
  clients: Client[];
  employees: Employee[];
  services: Service[];
  onAddAppointment: (appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateAppointment: (id: string, appointment: Partial<Appointment>) => void;
  onDeleteAppointment: (id: string) => void;
}

export function Appointments({ 
  appointments, 
  pets, 
  clients, 
  employees,
  services,
  onAddAppointment, 
  onUpdateAppointment, 
  onDeleteAppointment 
}: AppointmentsProps) {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [showBookingLink, setShowBookingLink] = useState(false);
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    pet_id: '',
    employee_id: '',
    scheduled_date: new Date(),
    service_type: '',
    status: 'scheduled' as const,
    price: 0,
    notes: '',
    // Client and pet editing fields
    client_name: '',
    client_email: '',
    client_phone: '',
    pet_name: '',
    pet_breed: '',
  });

  const bookingLink = `${window.location.origin}/book-appointment`;

  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    appointments.forEach(apt => {
      const dateKey = format(new Date(apt.scheduled_date), 'yyyy-MM-dd');
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

  const resetForm = () => {
    setFormData({
      pet_id: '',
      employee_id: '',
      scheduled_date: new Date(),
      service_type: '',
      status: 'scheduled',
      price: 0,
      notes: '',
      client_name: '',
      client_email: '',
      client_phone: '',
      pet_name: '',
      pet_breed: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Update client if editing and client info changed
    if (editingAppointment && formData.client_name) {
      const pet = pets.find(p => p.id === editingAppointment.pet_id);
      if (pet) {
        const client = clients.find(c => c.id === (pet.customer_id || pet.client_id));
        if (client && (client.name !== formData.client_name || client.email !== formData.client_email || client.phone !== formData.client_phone)) {
          // Convert name to first_name/last_name for customers table
          const nameParts = formData.client_name.split(' ');
          const first_name = nameParts[0] || '';
          const last_name = nameParts.slice(1).join(' ') || '';
          
          await supabase
            .from('customers' as any)
            .update({
              first_name,
              last_name,
              email: formData.client_email || client.email,
              phone: formData.client_phone || client.phone,
            })
            .eq('id', client.id);
        }
      }
    }
    
    // Update pet if editing and pet info changed
    if (editingAppointment && formData.pet_name) {
      const pet = pets.find(p => p.id === editingAppointment.pet_id);
      if (pet && (pet.name !== formData.pet_name || pet.breed !== formData.pet_breed)) {
        await supabase
          .from('pets')
          .update({
            name: formData.pet_name,
            breed: formData.pet_breed || pet.breed,
          })
          .eq('id', pet.id);
      }
    }
    
    if (editingAppointment) {
      onUpdateAppointment(editingAppointment.id, {
        pet_id: formData.pet_id,
        employee_id: formData.employee_id || null,
        scheduled_date: formData.scheduled_date.toISOString(),
        service_type: formData.service_type,
        status: formData.status,
        price: formData.price,
        notes: formData.notes,
      });
      setEditingAppointment(null);
      toast.success('Appointment updated successfully!');
    } else {
      onAddAppointment({
        ...formData,
        scheduled_date: formData.scheduled_date.toISOString(),
      });
    }
    resetForm();
    setShowForm(false);
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setEditDialogOpen(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAppointment(null);
    resetForm();
  };

  const handleDeleteClick = (id: string) => {
    setAppointmentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (appointmentToDelete) {
      onDeleteAppointment(appointmentToDelete);
      setAppointmentToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingLink);
    setBookingLinkCopied(true);
    toast.success('Booking link copied to clipboard!');
    setTimeout(() => setBookingLinkCopied(false), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPetName = (petId: string) => {
    const pet = pets.find(p => p.id === petId);
    return pet ? pet.name : t('appointments.unknownPet');
  };

  const getClientName = (petId: string) => {
    const pet = pets.find(p => p.id === petId);
    if (!pet) return t('appointments.unknownClient');
    const client = clients.find(c => c.id === pet.client_id);
    return client ? client.name : t('appointments.unknownClient');
  };

  const getEmployeeName = (employeeId?: string) => {
    if (!employeeId) return t('appointments.unassigned');
    const employee = employees.find(e => e.id === employeeId);
    return employee ? employee.name : t('appointments.unknownClient');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('appointments.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('appointments.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBookingLink(!showBookingLink)}
            className="flex items-center gap-2"
          >
            <LinkIcon className="w-4 h-4" />
            Booking Link
          </Button>
          <Button
            onClick={() => setBookingDialogOpen(true)}
            className="shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </Button>
        </div>
      </div>

      {showBookingLink && (
        <Card className="shadow-sm animate-fade-in border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-primary" />
              {t('appointments.shareableBookingLink')}
            </CardTitle>
            <CardDescription>
              {t('appointments.shareLinkDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={bookingLink} readOnly className="font-mono text-sm" />
              <Button onClick={handleCopyLink} className="flex items-center gap-2">
                <Copy className="w-4 h-4" />
                {bookingLinkCopied ? t('common.copied') : t('common.copy')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm">
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
                    return appointmentsByDate[dateKey]?.length > 0;
                  },
                }}
                modifiersClassNames={{
                  hasAppointments: 'bg-primary/10 text-primary font-semibold',
                }}
              />
              <div className="mt-4 pt-4 border-t">
                <h3 className="font-semibold mb-2">{t('appointments.weekView')}</h3>
                <div className="space-y-2">
                  {weekAppointments.map(({ date, appointments: dayAppointments }) => (
                    <div
                      key={format(date, 'yyyy-MM-dd')}
                      className={cn(
                        "p-2 rounded border text-sm",
                        isSameDay(date, selectedDate || new Date()) && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="font-medium mb-1">
                        {format(date, 'EEE, MMM d')}
                      </div>
                      {dayAppointments.length > 0 ? (
                        <div className="space-y-1">
                          {dayAppointments.slice(0, 2).map(apt => (
                            <div key={apt.id} className="text-xs text-muted-foreground">
                              {format(new Date(apt.scheduled_date), 'h:mm a')} - {getPetName(apt.pet_id)}
                            </div>
                          ))}
                          {dayAppointments.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayAppointments.length - 2} {t('appointments.more')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">{t('appointments.noAppointments')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Date Appointments */}
        <div>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : t('appointments.selectDate')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('appointments.noAppointmentsScheduled')}</p>
              ) : (
                <div className="space-y-3">
                  {selectedDateAppointments
                    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
                    .map(appointment => (
                      <Card key={appointment.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="font-semibold">
                                  {format(new Date(appointment.scheduled_date), 'h:mm a')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mb-1">
                                <Dog className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{getPetName(appointment.pet_id)}</span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">{getClientName(appointment.pet_id)}</span>
                              </div>
                              <div className="text-sm mb-2">
                                <span className="font-medium">{t('appointments.serviceType')}:</span> {appointment.service_type}
                              </div>
                              <div className="text-sm mb-2">
                                <span className="font-medium">{t('appointments.estimatedPrice')}:</span>{' '}
                                $
                                {typeof appointment.price === 'number'
                                  ? appointment.price.toFixed(2)
                                  : '0.00'}
                              </div>
                              {appointment.employee_id && (
                                <div className="text-sm mb-2">
                                  <span className="font-medium">{t('nav.employees')}:</span> {getEmployeeName(appointment.employee_id)}
                                </div>
                              )}
                              {appointment.notes && (
                                <div className="text-sm text-muted-foreground mt-2">
                                  {appointment.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <Badge className={getStatusColor(appointment.status)}>
                                {appointment.status}
                              </Badge>
                              <div className="flex flex-col gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate('/checkout', { state: { appointmentId: appointment.id } })}
                                  className="flex items-center gap-2"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                  {t('appointments.checkout')}
                                </Button>
                                <div className="flex gap-1">
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
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={t('common.delete') + ' ' + t('appointments.title') + '?'}
        description={t('appointments.deleteConfirm')}
      />

      <BookingFormDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        clients={clients}
        pets={pets}
        services={services}
        appointments={appointments}
        onAddAppointment={onAddAppointment}
        onSuccess={() => {
          toast.success('Appointment created successfully!');
        }}
      />

      <EditAppointmentDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingAppointment(null);
          }
        }}
        appointment={editingAppointment}
        clients={clients}
        pets={pets}
        services={services}
        employees={employees}
        appointments={appointments}
        onUpdate={onUpdateAppointment}
        onSuccess={() => {
          toast.success('Appointment updated successfully!');
          setEditingAppointment(null);
        }}
      />
    </div>
  );
}
