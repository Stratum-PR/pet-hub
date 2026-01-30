import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Calendar as CalendarIcon, Clock, User, Dog, Copy, Link as LinkIcon, ShoppingCart, ChevronLeft, ChevronRight, ArrowUpDown, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Appointment, Pet, Employee, Client, Service } from '@/types';
import { format, isSameDay, startOfDay, addDays, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { BookingFormDialog } from '@/components/BookingFormDialog';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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

type SortField = 'date' | 'pet' | 'cost' | 'service';
type SortDirection = 'asc' | 'desc';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'calendar' | 'history'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [showBookingLink, setShowBookingLink] = useState(false);
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  
  // History filters
  const [historyPetFilter, setHistoryPetFilter] = useState<string | null>(null);
  const [historyClientFilter, setHistoryClientFilter] = useState<string | null>(null);
  const [historySortField, setHistorySortField] = useState<SortField>('date');
  const [historySortDirection, setHistorySortDirection] = useState<SortDirection>('desc');

  const bookingLink = `${window.location.origin}/book-appointment`;

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    appointments.forEach(apt => {
      const dateKey = format(new Date(apt.scheduled_date || apt.appointment_date || ''), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(apt);
    });
    return grouped;
  }, [appointments]);

  // Handle pet filter from query params
  useEffect(() => {
    const petId = searchParams.get('pet');
    if (petId) {
      setHistoryPetFilter(petId);
      setActiveTab('history');
    }
  }, [searchParams]);

  // Calendar: Get appointments for selected date
  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return appointmentsByDate[dateKey] || [];
  }, [selectedDate, appointmentsByDate]);

  // Calendar: Week view appointments
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

  // Calendar: Month view appointments
  const monthAppointments = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    return monthDays.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: day,
        appointments: appointmentsByDate[dateKey] || [],
      };
    });
  }, [currentMonth, appointmentsByDate]);

  // History: Filtered and sorted appointments
  const filteredHistoryAppointments = useMemo(() => {
    let filtered = [...appointments];

    // Filter by pet
    if (historyPetFilter) {
      filtered = filtered.filter(apt => apt.pet_id === historyPetFilter);
    }

    // Filter by client
    if (historyClientFilter) {
      filtered = filtered.filter(apt => {
        const pet = pets.find(p => p.id === apt.pet_id);
        return pet?.client_id === historyClientFilter;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (historySortField) {
        case 'date':
          aValue = new Date(a.scheduled_date || a.appointment_date || '').getTime();
          bValue = new Date(b.scheduled_date || b.appointment_date || '').getTime();
          break;
        case 'pet':
          aValue = getPetName(a.pet_id).toLowerCase();
          bValue = getPetName(b.pet_id).toLowerCase();
          break;
        case 'cost':
          aValue = typeof a.price === 'number' ? a.price : 0;
          bValue = typeof b.price === 'number' ? b.price : 0;
          break;
        case 'service':
          aValue = (a.service_type || '').toLowerCase();
          bValue = (b.service_type || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return historySortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return historySortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [appointments, historyPetFilter, historyClientFilter, historySortField, historySortDirection, pets]);

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
      onDeleteAppointment(appointmentToDelete);
      toast.success(t('appointments.appointmentDeleted'));
      setAppointmentToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingLink);
    setBookingLinkCopied(true);
    toast.success(t('appointments.linkCopied'));
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

  const getPetName = (petId?: string) => {
    if (!petId) return t('appointments.unknownPet');
    const pet = pets.find(p => p.id === petId);
    return pet ? pet.name : t('appointments.unknownPet');
  };

  const getClientName = (petId?: string) => {
    if (!petId) return t('appointments.unknownClient');
    const pet = pets.find(p => p.id === petId);
    if (!pet?.client_id) return t('appointments.unknownClient');
    const client = clients.find(c => c.id === pet.client_id);
    return client ? client.name : t('appointments.unknownClient');
  };

  const getEmployeeName = (employeeId?: string) => {
    if (!employeeId) return t('appointments.unassigned');
    const employee = employees.find(e => e.id === employeeId);
    return employee ? employee.name : t('appointments.unassigned');
  };

  const getServiceName = (serviceId?: string, serviceType?: string) => {
    if (serviceId) {
      const service = services.find(s => s.id === serviceId);
      if (service) return service.name;
    }
    return serviceType || t('appointments.noService');
  };

  const toggleSort = (field: SortField) => {
    if (historySortField === field) {
      setHistorySortDirection(historySortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setHistorySortField(field);
      setHistorySortDirection('asc');
    }
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'calendar' | 'history')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Calendario de citas
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial de citas
          </TabsTrigger>
        </TabsList>

        {/* CALENDAR TAB */}
        <TabsContent value="calendar" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left side - Large Calendar (2/3) */}
            <div className="lg:col-span-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-primary" />
                        {viewMode === 'week' ? t('appointments.weekView') : t('appointments.monthView')}
                      </CardTitle>
                      {viewMode === 'week' && selectedDate && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(startOfWeek(selectedDate), 'MMMM d')} - {format(endOfWeek(selectedDate), 'MMMM d, yyyy')}
                        </p>
                      )}
                      {viewMode === 'month' && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(currentMonth, 'MMMM yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (viewMode === 'week') {
                            setSelectedDate(addDays(selectedDate || new Date(), -7));
                          } else {
                            setCurrentMonth(subMonths(currentMonth, 1));
                          }
                        }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (viewMode === 'week') {
                            setSelectedDate(addDays(selectedDate || new Date(), 7));
                          } else {
                            setCurrentMonth(addMonths(currentMonth, 1));
                          }
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'week' | 'month')}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">Semana</SelectItem>
                          <SelectItem value="month">Mes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {viewMode === 'week' ? (
                    <div className="space-y-4">
                      {/* Week View - Large calendar showing current week */}
                      <div className="grid grid-cols-7 gap-2 mb-4">
                        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                          <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
                            {day}
                          </div>
                        ))}
                        {weekAppointments.map(({ date, appointments: dayAppointments }) => {
                          const dateKey = format(date, 'yyyy-MM-dd');
                          const isToday = isSameDay(date, new Date());
                          const isSelected = isSameDay(date, selectedDate || new Date());
                          return (
                            <div
                              key={dateKey}
                              className={cn(
                                "min-h-[180px] p-3 border-2 rounded-lg cursor-pointer transition-all hover:border-primary/50",
                                isSelected && "border-primary bg-primary/5 shadow-md",
                                isToday && !isSelected && "border-primary/30 bg-primary/5"
                              )}
                              onClick={() => setSelectedDate(date)}
                            >
                              <div className={cn(
                                "font-semibold mb-2",
                                isToday && "text-primary"
                              )}>
                                <div>{format(date, 'd')}</div>
                                <div className="text-xs font-normal text-muted-foreground mt-0.5">
                                  {format(date, 'MMM')}
                                </div>
                              </div>
                              {dayAppointments.length > 0 ? (
                                <div className="space-y-1.5">
                                  {dayAppointments.slice(0, 4).map(apt => {
                                    const employee = apt.employee_id ? employees.find(e => e.id === apt.employee_id) : null;
                                    return (
                                      <div 
                                        key={apt.id} 
                                        className="bg-primary/10 text-primary rounded px-2 py-1.5 text-xs"
                                        title={`${format(new Date(apt.scheduled_date || apt.appointment_date || ''), 'h:mm a')} - ${getPetName(apt.pet_id)}${employee ? ` - ${employee.name}` : ''}`}
                                      >
                                        <div className="font-medium">
                                          {format(new Date(apt.scheduled_date || apt.appointment_date || ''), 'h:mm')} - {getPetName(apt.pet_id)}
                                        </div>
                                        {employee && (
                                          <div className="text-[10px] text-primary/70 mt-0.5 truncate">
                                            {employee.name}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {dayAppointments.length > 4 && (
                                    <div className="text-muted-foreground text-xs font-medium pt-1">
                                      +{dayAppointments.length - 4} más
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">Sin citas</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Selected Day's Appointments Below Calendar */}
                      {selectedDate && (
                        <div className="mt-6 pt-6 border-t">
                          <h3 className="font-semibold text-lg mb-4">
                            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                          </h3>
                          {selectedDateAppointments.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                              {t('appointments.noAppointmentsScheduled')}
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {selectedDateAppointments.map(appointment => {
                                const appointmentDate = appointment.scheduled_date || appointment.appointment_date;
                                const appointmentTime = appointment.start_time || '';
                                return (
                                  <Card key={appointment.id} className="border-l-4 border-l-primary">
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{appointmentTime || format(new Date(appointmentDate || ''), 'h:mm a')}</span>
                                          </div>
                                          <div className="flex items-center gap-2 mb-1">
                                            <Dog className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{getPetName(appointment.pet_id)}</span>
                                          </div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">{getClientName(appointment.pet_id)}</span>
                                          </div>
                                          <div className="text-sm mb-1">
                                            <span className="font-medium">Servicio:</span> {getServiceName(appointment.service_id as any, appointment.service_type)}
                                          </div>
                                          <div className="text-sm mb-1">
                                            <span className="font-medium">Costo:</span> ${typeof appointment.price === 'number' ? appointment.price.toFixed(2) : '0.00'}
                                          </div>
                                          {appointment.employee_id && (
                                            <div className="text-sm">
                                              <span className="font-medium">Empleado:</span> {getEmployeeName(appointment.employee_id)}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          <Badge className={getStatusColor(appointment.status)}>
                                            {appointment.status || 'scheduled'}
                                          </Badge>
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
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Month View - Large calendar grid */}
                      <div className="grid grid-cols-7 gap-2">
                        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                          <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
                            {day}
                          </div>
                        ))}
                        {monthAppointments.map(({ date, appointments: dayAppointments }) => {
                          const dateKey = format(date, 'yyyy-MM-dd');
                          const isToday = isSameDay(date, new Date());
                          const isSelected = isSameDay(date, selectedDate || new Date());
                          return (
                            <div
                              key={dateKey}
                              className={cn(
                                "min-h-[120px] p-2 border rounded-lg cursor-pointer transition-all hover:border-primary/50",
                                !isSameMonth(date, currentMonth) && "opacity-30",
                                isSelected && "border-primary bg-primary/5 shadow-md",
                                isToday && !isSelected && "border-primary/30 bg-primary/5"
                              )}
                              onClick={() => setSelectedDate(date)}
                            >
                              <div className={cn(
                                "font-semibold mb-1 text-sm",
                                isToday && "text-primary"
                              )}>
                                {format(date, 'd')}
                              </div>
                              {dayAppointments.length > 0 && (
                                <div className="text-xs font-medium text-primary">
                                  {dayAppointments.length} {dayAppointments.length === 1 ? 'cita' : 'citas'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Selected Day's Appointments Below Calendar */}
                      {selectedDate && (
                        <div className="mt-6 pt-6 border-t">
                          <h3 className="font-semibold text-lg mb-4">
                            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                          </h3>
                          {selectedDateAppointments.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                              {t('appointments.noAppointmentsScheduled')}
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {selectedDateAppointments.map(appointment => {
                                const appointmentDate = appointment.scheduled_date || appointment.appointment_date;
                                const appointmentTime = appointment.start_time || '';
                                return (
                                  <Card key={appointment.id} className="border-l-4 border-l-primary">
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{appointmentTime || format(new Date(appointmentDate || ''), 'h:mm a')}</span>
                                          </div>
                                          <div className="flex items-center gap-2 mb-1">
                                            <Dog className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{getPetName(appointment.pet_id)}</span>
                                          </div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">{getClientName(appointment.pet_id)}</span>
                                          </div>
                                          <div className="text-sm mb-1">
                                            <span className="font-medium">Servicio:</span> {getServiceName(appointment.service_id as any, appointment.service_type)}
                                          </div>
                                          <div className="text-sm mb-1">
                                            <span className="font-medium">Costo:</span> ${typeof appointment.price === 'number' ? appointment.price.toFixed(2) : '0.00'}
                                          </div>
                                          {appointment.employee_id && (
                                            <div className="text-sm">
                                              <span className="font-medium">Empleado:</span> {getEmployeeName(appointment.employee_id)}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          <Badge className={getStatusColor(appointment.status)}>
                                            {appointment.status || 'scheduled'}
                                          </Badge>
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
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right side - Today section (1/3) */}
            <div className="space-y-6">
              {/* Today Section */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    {t('appointments.today')}: {format(new Date(), 'MMMM d, yyyy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const todayKey = format(new Date(), 'yyyy-MM-dd');
                    const todayAppointments = appointmentsByDate[todayKey] || [];
                    return todayAppointments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        {t('appointments.noAppointmentsScheduled')}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {todayAppointments.map(appointment => {
                          const appointmentDate = appointment.scheduled_date || appointment.appointment_date;
                          const appointmentTime = appointment.start_time || '';
                          return (
                            <Card key={appointment.id} className="border-l-4 border-l-primary">
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Clock className="w-3 h-3 text-muted-foreground" />
                                      <span className="font-medium text-sm">{appointmentTime || format(new Date(appointmentDate || ''), 'h:mm a')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Dog className="w-3 h-3 text-muted-foreground" />
                                      <span className="font-medium text-sm">{getPetName(appointment.pet_id)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <User className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">{getClientName(appointment.pet_id)}</span>
                                    </div>
                                    <div className="text-xs mb-1">
                                      <span className="font-medium">Servicio:</span> {getServiceName(appointment.service_id as any, appointment.service_type)}
                                    </div>
                                    <div className="text-xs">
                                      <span className="font-medium">Costo:</span> ${typeof appointment.price === 'number' ? appointment.price.toFixed(2) : '0.00'}
                                    </div>
                                  </div>
                                  <Badge className={cn("text-xs", getStatusColor(appointment.status))}>
                                    {appointment.status || 'scheduled'}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Filtros y Ordenamiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filtrar por Mascota</label>
                  <Select
                    value={historyPetFilter || 'all'}
                    onValueChange={(value) => setHistoryPetFilter(value === 'all' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las mascotas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las mascotas</SelectItem>
                      {pets.map((pet) => (
                        <SelectItem key={pet.id} value={pet.id}>
                          {pet.name} {pet.breeds?.name ? `(${pet.breeds.name})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filtrar por Cliente</label>
                  <Select
                    value={historyClientFilter || 'all'}
                    onValueChange={(value) => setHistoryClientFilter(value === 'all' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ordenar por</label>
                  <Select
                    value={`${historySortField}-${historySortDirection}`}
                    onValueChange={(value) => {
                      const [field, direction] = value.split('-') as [SortField, SortDirection];
                      setHistorySortField(field);
                      setHistorySortDirection(direction);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Fecha (más reciente primero)</SelectItem>
                      <SelectItem value="date-asc">Fecha (más antiguo primero)</SelectItem>
                      <SelectItem value="pet-asc">Mascota (A-Z)</SelectItem>
                      <SelectItem value="pet-desc">Mascota (Z-A)</SelectItem>
                      <SelectItem value="cost-desc">Costo (mayor a menor)</SelectItem>
                      <SelectItem value="cost-asc">Costo (menor a mayor)</SelectItem>
                      <SelectItem value="service-asc">Servicio (A-Z)</SelectItem>
                      <SelectItem value="service-desc">Servicio (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de Citas ({filteredHistoryAppointments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredHistoryAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay citas que coincidan con los filtros seleccionados.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('date')}>
                          <div className="flex items-center gap-2">
                            Fecha/Hora
                            <ArrowUpDown className="w-4 h-4" />
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('pet')}>
                          <div className="flex items-center gap-2">
                            Mascota
                            <ArrowUpDown className="w-4 h-4" />
                          </div>
                        </TableHead>
                        <TableHead>Dueño</TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('service')}>
                          <div className="flex items-center gap-2">
                            Servicio
                            <ArrowUpDown className="w-4 h-4" />
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('cost')}>
                          <div className="flex items-center gap-2">
                            Costo
                            <ArrowUpDown className="w-4 h-4" />
                          </div>
                        </TableHead>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistoryAppointments.map((appointment) => {
                        const appointmentDate = appointment.scheduled_date || appointment.appointment_date;
                        const appointmentTime = appointment.start_time || '';
                        return (
                          <TableRow key={appointment.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {appointmentDate ? format(new Date(appointmentDate), 'MMM d, yyyy') : 'N/A'}
                                </span>
                                {appointmentTime && (
                                  <span className="text-xs text-muted-foreground">{appointmentTime}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{getPetName(appointment.pet_id)}</TableCell>
                            <TableCell>{getClientName(appointment.pet_id)}</TableCell>
                            <TableCell>{getServiceName(appointment.service_id as any, appointment.service_type)}</TableCell>
                            <TableCell>${typeof appointment.price === 'number' ? appointment.price.toFixed(2) : '0.00'}</TableCell>
                            <TableCell>{getEmployeeName(appointment.employee_id)}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(appointment.status)}>
                                {appointment.status || 'scheduled'}
                              </Badge>
                            </TableCell>
                            <TableCell>
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
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={t('appointments.deleteAppointmentTitle')}
        description={t('appointments.deleteAppointmentDescription')}
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

      {editingAppointment && (
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
      )}
    </div>
  );
}
