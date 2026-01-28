import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Pet, Employee, TimeEntry, Appointment, Service } from '@/types';
import { useBusinessId } from './useBusinessId';
import { useAuth } from '@/contexts/AuthContext';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();
  const { profile } = useAuth();

  const fetchClients = async () => {
    if (!businessId) {
      console.warn('[useClients] No businessId, skipping fetch. Profile:', profile);
      setLoading(false);
      setClients([]);
      return;
    }

    console.log('[useClients] Fetching clients for businessId:', businessId, 'Type:', typeof businessId);
    
    try {
      // Use customers table with business_id filter
      const { data, error, count } = await supabase
        .from('customers' as any)
        .select('*', { count: 'exact' })
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[useClients] Error fetching clients:', error);
        console.error('[useClients] Error details:', JSON.stringify(error, null, 2));
        setClients([]);
      } else {
        console.log('[useClients] Query successful. Count:', count, 'Data length:', data?.length || 0);
        if (data && data.length > 0) {
          console.log('[useClients] Sample customer:', data[0]);
        }
        // Convert customers to clients format for compatibility
        const convertedClients = (data || []).map((c: any) => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          notes: c.notes || null,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
        setClients(convertedClients);
      }
    } catch (err: any) {
      console.error('[useClients] Exception:', err);
      setClients([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [businessId]);

  const addClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;

    // Split name into first_name and last_name
    const nameParts = clientData.name.split(' ');
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    const { data, error } = await supabase
      .from('customers' as any)
      .insert({
        business_id: businessId,
        first_name,
        last_name,
        email: clientData.email,
        phone: clientData.phone,
        address: clientData.address,
        notes: clientData.notes,
      })
      .select()
      .single();
    
    if (!error && data) {
      const converted = {
        id: data.id,
        name: `${data.first_name} ${data.last_name}`,
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        notes: data.notes || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setClients([converted, ...clients]);
      return converted;
    }
    return null;
  };

  const updateClient = async (id: string, clientData: Partial<Client>) => {
    const { data, error } = await supabase
      .from('clients')
      .update(clientData)
      .eq('id', id)
      .select()
      .single();
    
    if (!error && data) {
      setClients(clients.map(c => c.id === id ? data : c));
      return data;
    }
    return null;
  };

  const deleteClient = async (id: string) => {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setClients(clients.filter(c => c.id !== id));
      return true;
    }
    return false;
  };

  return { clients, loading, addClient, updateClient, deleteClient, refetch: fetchClients };
}

export function usePets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();

  const fetchPets = async () => {
    if (!businessId) {
      console.warn('[usePets] No businessId, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('[usePets] Fetching pets for businessId:', businessId);

    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[usePets] Error fetching pets:', error);
      setPets([]);
    } else if (data) {
      console.log('[usePets] Fetched', data.length, 'pets');
      setPets(data as Pet[]);
    } else {
      console.warn('[usePets] No data returned');
      setPets([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPets();
  }, [businessId]);

  const addPet = async (petData: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('pets')
      .insert(petData)
      .select()
      .single();
    
    if (!error && data) {
      setPets([data as Pet, ...pets]);
      return data;
    }
    return null;
  };

  const updatePet = async (id: string, petData: Partial<Pet>) => {
    const { data, error } = await supabase
      .from('pets')
      .update(petData)
      .eq('id', id)
      .select()
      .single();
    
    if (!error && data) {
      setPets(pets.map(p => p.id === id ? data as Pet : p));
      return data;
    }
    return null;
  };

  const deletePet = async (id: string) => {
    const { error } = await supabase
      .from('pets')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setPets(pets.filter(p => p.id !== id));
      return true;
    }
    return false;
  };

  return { pets, loading, addPet, updatePet, deletePet, refetch: fetchPets };
}

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();

  const fetchEmployees = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setEmployees(data as Employee[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, [businessId]);

  const addEmployee = async (employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('employees')
      .insert(employeeData)
      .select()
      .single();
    
    if (!error && data) {
      setEmployees([data as Employee, ...employees]);
      return data;
    }
    return null;
  };

  const updateEmployee = async (id: string, employeeData: Partial<Employee>) => {
    const { data, error } = await supabase
      .from('employees')
      .update(employeeData)
      .eq('id', id)
      .select()
      .single();
    
    if (!error && data) {
      setEmployees(employees.map(e => e.id === id ? data as Employee : e));
      return data;
    }
    return null;
  };

  const deleteEmployee = async (id: string) => {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setEmployees(employees.filter(e => e.id !== id));
      return true;
    }
    return false;
  };

  const verifyPin = async (pin: string) => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('pin', pin)
      .eq('status', 'active')
      .maybeSingle();
    
    if (!error && data) {
      return data as Employee;
    }
    return null;
  };

  return { employees, loading, addEmployee, updateEmployee, deleteEmployee, verifyPin, refetch: fetchEmployees };
}

export function useTimeEntries() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();

  const fetchTimeEntries = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    // Get time entries for employees in this business
    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('business_id', businessId);

    if (!employees || employees.length === 0) {
      setLoading(false);
      return;
    }

    const employeeIds = employees.map(e => e.id);
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .in('employee_id', employeeIds)
      .order('clock_in', { ascending: false });
    
    if (!error && data) {
      setTimeEntries(data as TimeEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTimeEntries();
  }, [businessId]);

  const clockIn = async (employeeId: string) => {
    const { data, error } = await supabase
      .from('time_entries')
      .insert({ employee_id: employeeId })
      .select()
      .single();
    
    if (!error && data) {
      setTimeEntries([data as TimeEntry, ...timeEntries]);
      return data;
    }
    return null;
  };

  const clockOut = async (entryId: string) => {
    const { data, error } = await supabase
      .from('time_entries')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', entryId)
      .select()
      .single();
    
    if (!error && data) {
      setTimeEntries(timeEntries.map(t => t.id === entryId ? data as TimeEntry : t));
      return data;
    }
    return null;
  };

  const getActiveEntry = (employeeId: string) => {
    return timeEntries.find(t => t.employee_id === employeeId && !t.clock_out);
  };

  const updateTimeEntry = async (id: string, entryData: Partial<TimeEntry>) => {
    const { data, error } = await supabase
      .from('time_entries')
      .update(entryData)
      .eq('id', id)
      .select()
      .single();
    
    if (!error && data) {
      setTimeEntries(timeEntries.map(t => t.id === id ? data as TimeEntry : t));
      return data;
    }
    return null;
  };

  const addTimeEntry = async (employeeId: string, clockIn: string, clockOut?: string) => {
    const entryData: any = {
      employee_id: employeeId,
      clock_in: clockIn,
    };
    if (clockOut) {
      entryData.clock_out = clockOut;
    }
    
    const { data, error } = await supabase
      .from('time_entries')
      .insert(entryData)
      .select()
      .single();
    
    if (!error && data) {
      setTimeEntries([data as TimeEntry, ...timeEntries]);
      return data;
    }
    return null;
  };

  return { timeEntries, loading, clockIn, clockOut, getActiveEntry, updateTimeEntry, addTimeEntry, refetch: fetchTimeEntries };
}

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();

  const fetchAppointments = async () => {
    if (!businessId) {
      console.warn('[useAppointments] No businessId, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('[useAppointments] Fetching appointments for businessId:', businessId);

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', businessId)
      .order('appointment_date', { ascending: true, nullsFirst: false })
      .order('start_time', { ascending: true, nullsFirst: false });
    
    if (error) {
      console.error('[useAppointments] Error fetching appointments:', error);
      setAppointments([]);
    } else if (data) {
      console.log('[useAppointments] Fetched', data.length, 'appointments');
      // Convert new schema to old schema format for compatibility
      const convertedAppointments = data.map((apt: any) => ({
        ...apt,
        scheduled_date: apt.appointment_date 
          ? `${apt.appointment_date}T${apt.start_time || '00:00:00'}` 
          : apt.scheduled_date || new Date().toISOString(),
      }));
      setAppointments(convertedAppointments as Appointment[]);
    } else {
      console.warn('[useAppointments] No data returned');
      setAppointments([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, [businessId]);

  const addAppointment = async (appointmentData: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single();
    
    if (!error && data) {
      setAppointments([...appointments, data as Appointment].sort((a, b) => 
        new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      ));
      return data;
    }
    return null;
  };

  const updateAppointment = async (id: string, appointmentData: Partial<Appointment>) => {
    const { data, error } = await supabase
      .from('appointments')
      .update(appointmentData)
      .eq('id', id)
      .select()
      .single();
    
    if (!error && data) {
      setAppointments(appointments.map(a => a.id === id ? data as Appointment : a));
      return data;
    }
    return null;
  };

  const deleteAppointment = async (id: string) => {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setAppointments(appointments.filter(a => a.id !== id));
      return true;
    }
    return false;
  };

  return { appointments, loading, addAppointment, updateAppointment, deleteAppointment, refetch: fetchAppointments };
}

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();

  const fetchServices = async () => {
    if (!businessId) {
      console.warn('[useServices] No businessId, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('[useServices] Fetching services for businessId:', businessId);

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('[useServices] Error fetching services:', error);
      setServices([]);
    } else if (data) {
      console.log('[useServices] Fetched', data.length, 'services');
      setServices(data as Service[]);
    } else {
      console.warn('[useServices] No data returned');
      setServices([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServices();
  }, [businessId]);

  const addService = async (serviceData: Omit<Service, 'id' | 'created_at'>) => {
    // NOTE: `public.services` (in this project) does NOT have `category` or `cost` columns.
    // Sending unknown columns causes PostgREST 400 and makes the UI look empty.
    const cleanData: any = {
      ...serviceData,
      description: (serviceData as any).description || null,
    };
    delete cleanData.category;
    delete cleanData.cost;
    
    const { data, error } = await supabase
      .from('services')
      .insert(cleanData)
      .select()
      .single();
    
    if (!error && data) {
      setServices([...services, data as Service].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    }
    if (error) {
      console.error('Error adding service:', error);
    }
    return null;
  };

  const updateService = async (id: string, serviceData: Partial<Service>) => {
    const { data, error } = await supabase
      .from('services')
      .update(serviceData)
      .eq('id', id)
      .select()
      .single();
    
    if (!error && data) {
      setServices(services.map(s => s.id === id ? data as Service : s));
      return data;
    }
    return null;
  };

  const deleteService = async (id: string) => {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setServices(services.filter(s => s.id !== id));
      return true;
    }
    return false;
  };

  return { services, loading, addService, updateService, deleteService, refetch: fetchServices };
}

export interface Settings {
  business_name: string;
  business_hours: string;
  primary_color: string;
  secondary_color: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    business_name: 'Stratum Hub',
    business_hours: '9:00 AM - 6:00 PM',
    primary_color: '168 60% 45%',
    secondary_color: '200 55% 55%',
  });
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();

  const fetchSettings = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    // Get business info for business_name
    const { data: business, error: businessError } = await (supabase
      .from('businesses' as any)
      .select('name')
      .eq('id', businessId)
      .maybeSingle() as any);

    // Try to get settings filtered by business_id (if column exists)
    // If that fails, get all settings (for backward compatibility)
    let settingsData: any[] = [];
    let settingsError: any = null;
    
    try {
      const result = await supabase
        .from('settings')
        .select('*')
        .eq('business_id', businessId);
      settingsData = result.data || [];
      settingsError = result.error;
    } catch (err) {
      // business_id column might not exist, try without filter
      const result = await supabase
        .from('settings')
        .select('*');
      settingsData = result.data || [];
      settingsError = result.error;
    }
    
    if (!settingsError && settingsData) {
      const settingsMap: Record<string, string> = {};
      settingsData.forEach((item: { key: string; value: string }) => {
        settingsMap[item.key] = item.value;
      });
      setSettings({
        business_name: business?.name || settingsMap.business_name || 'Stratum Hub',
        business_hours: settingsMap.business_hours || '9:00 AM - 6:00 PM',
        primary_color: settingsMap.primary_color || '168 60% 45%',
        secondary_color: settingsMap.secondary_color || '200 55% 55%',
      });
    } else if (!businessError && business) {
      // If no settings but business exists, use business name
      setSettings({
        business_name: business.name || 'Stratum Hub',
        business_hours: '9:00 AM - 6:00 PM',
        primary_color: '168 60% 45%',
        secondary_color: '200 55% 55%',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, [businessId]);

  const updateSetting = async (key: string, value: string) => {
    if (!businessId) return false;

    // Try with business_id first, fallback to without if column doesn't exist
    let existingData: any = null;
    try {
      const result = await supabase
        .from('settings')
        .select('*')
        .eq('key', key)
        .eq('business_id', businessId)
        .maybeSingle();
      existingData = result.data;
    } catch (err) {
      // business_id column might not exist, try without
      const result = await supabase
        .from('settings')
        .select('*')
        .eq('key', key)
        .maybeSingle();
      existingData = result.data;
    }

    if (existingData) {
      // Try update with business_id, fallback to without
      let error: any = null;
      try {
        const result = await supabase
          .from('settings')
          .update({ value })
          .eq('key', key)
          .eq('business_id', businessId);
        error = result.error;
      } catch (err) {
        const result = await supabase
          .from('settings')
          .update({ value })
          .eq('key', key);
        error = result.error;
      }
      
      if (error) return false;
    } else {
      // Try insert with business_id, fallback to without
      let error: any = null;
      try {
        const result = await supabase
          .from('settings')
          .insert({ key, value, business_id: businessId });
        error = result.error;
      } catch (err) {
        const result = await supabase
          .from('settings')
          .insert({ key, value });
        error = result.error;
      }
      
      if (error) return false;
    }

    setSettings(prev => ({ ...prev, [key]: value }));
    return true;
  };

  const saveAllSettings = async (newSettings: Settings) => {
    if (!businessId) return false;

    const updates = [
      updateSetting('business_name', newSettings.business_name),
      updateSetting('business_hours', newSettings.business_hours),
      updateSetting('primary_color', newSettings.primary_color),
      updateSetting('secondary_color', newSettings.secondary_color),
    ];
    
    const results = await Promise.all(updates);
    return results.every(r => r);
  };

  return { settings, loading, updateSetting, saveAllSettings, refetch: fetchSettings };
}
