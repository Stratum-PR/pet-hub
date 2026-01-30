import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Pet, Employee, TimeEntry, Appointment, Service } from '@/types';
import { useBusinessId } from './useBusinessId';
import { useAuth } from '@/contexts/AuthContext';

export interface Breed {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
}

export function useBreeds() {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBreeds = async () => {
    try {
      const { data, error } = await supabase
        .from('breeds')
        .select('*')
        .order('species', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('[useBreeds] Error fetching breeds:', error);
        setBreeds([]);
      } else if (data) {
        console.log('[useBreeds] Fetched', data.length, 'breeds');
        setBreeds(data as Breed[]);
      } else {
        setBreeds([]);
      }
    } catch (err: any) {
      console.error('[useBreeds] Exception:', err);
      setBreeds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreeds();
  }, []);

  return { breeds, loading, refetch: fetchBreeds };
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();
  const { profile } = useAuth();

  const fetchClients = async () => {
    if (!businessId) {
      console.warn('[useClients] No businessId, skipping fetch.', {
        profile: profile ? { email: profile.email, business_id: profile.business_id } : null,
        location: window.location.pathname,
      });
      setLoading(false);
      setClients([]);
      return;
    }

    // CRITICAL: Verify session exists before querying (RLS requires auth.uid())
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[useClients] Session error:', sessionError);
    }
    if (!session && !sessionError) {
      console.warn('[useClients] No active session - RLS may block query. This is OK for demo mode.');
    }

    console.log('[useClients] Fetching clients for businessId:', businessId, 'Type:', typeof businessId, 'Has session:', !!session);
    
    try {
      // CRITICAL: Query clients table directly (customers was merged into clients)
      // Supabase client automatically includes session token in headers
      const { data, error, count } = await supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('business_id', businessId)
        .neq('email', 'orphaned-pets@system.local') // Exclude orphaned pets placeholder
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[useClients] Error fetching clients:', error);
        console.error('[useClients] Error details:', JSON.stringify(error, null, 2));
        setClients([]);
      } else {
        console.log('[useClients] Query successful.', {
          count,
          dataLength: data?.length || 0,
          businessId,
          sampleClient: data?.[0] ? {
            id: data[0].id,
            name: `${data[0].first_name} ${data[0].last_name}`,
            email: data[0].email,
            business_id: data[0].business_id,
          } : null,
        });
        // Convert clients to Client format (combine first_name + last_name into name)
        const convertedClients = (data || []).map((c: any) => ({
          id: c.id,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Sin nombre',
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          notes: c.notes || null,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
        console.log('[useClients] Converted clients:', convertedClients.length, 'clients');
        setClients(convertedClients);
      }
    } catch (err: any) {
      console.error('[useClients] Exception:', err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [businessId, profile?.business_id]); // Also depend on profile.business_id to refetch if it changes

  const addClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;

    // Split name into first_name and last_name
    const nameParts = clientData.name.split(' ');
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    // CRITICAL: Insert into clients table (not customers)
    const { data, error } = await supabase
      .from('clients')
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
    if (!businessId) return null;

    // Convert client data to customer format
    const nameParts = clientData.name?.split(' ') || [];
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    // CRITICAL: Update clients table (not customers)
    const { data, error } = await supabase
      .from('clients')
      .update({
        first_name,
        last_name,
        email: clientData.email,
        phone: clientData.phone,
        address: clientData.address,
        notes: clientData.notes,
      })
      .eq('id', id)
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
      setClients(clients.map(c => c.id === id ? converted : c));
      return converted;
    }
    return null;
  };

  const deleteClient = async (id: string) => {
    // CRITICAL: Delete from clients table (not customers)
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

    // CRITICAL: JOIN with clients table and breeds table to get owner and canonical breed information
    // Supabase PostgREST syntax: 
    // - clients:client_id(...) means join clients table via client_id foreign key
    // - breeds:breed_id(...) means join breeds table via breed_id foreign key
    const { data, error } = await supabase
      .from('pets')
      .select(`
        *,
        clients:client_id(
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        breeds:breed_id(
          id,
          name,
          species
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[usePets] Error fetching pets:', error);
      console.error('[usePets] Error details:', JSON.stringify(error, null, 2));
      setPets([]);
    } else if (data) {
      console.log('[usePets] Fetched', data.length, 'pets with client data');
      // Log sample data to verify joins are working
      if (data.length > 0) {
        console.log('[usePets] Sample pet with client and breed:', {
          petId: data[0].id,
          petName: data[0].name,
          clientId: data[0].client_id,
          clientData: data[0].clients,
          breedId: data[0].breed_id,
          breedData: data[0].breeds,
          legacyBreed: data[0].breed, // Keep for backward compatibility
        });
      }
      // Data is already properly structured with clients join
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
    if (!businessId) return null;

    const { data, error } = await supabase
      .from('pets')
      .insert({ ...petData, business_id: businessId })
      .select(`
        *,
        clients:client_id(
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        breeds:breed_id(
          id,
          name,
          species
        )
      `)
      .single();
    
    if (!error && data) {
      // Refetch all pets to ensure consistency
      await fetchPets();
      return data;
    }
    return null;
  };

  const updatePet = async (id: string, petData: Partial<Pet>) => {
    if (!businessId) return null;

    const { data, error } = await supabase
      .from('pets')
      .update(petData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select(`
        *,
        clients:client_id(
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        breeds:breed_id(
          id,
          name,
          species
        )
      `)
      .single();
    
    if (!error && data) {
      // Refetch all pets to ensure consistency
      await fetchPets();
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

    let query = supabase
      .from('appointments')
      .select('*');
    
    // Try with business_id first, fallback if column doesn't exist
    try {
      query = query.eq('business_id', businessId);
    } catch (err) {
      console.warn('[useAppointments] business_id filter failed, trying without it');
    }
    
    const { data, error } = await query
      .order('appointment_date', { ascending: true, nullsFirst: false })
      .order('start_time', { ascending: true, nullsFirst: false });
    
    if (error) {
      console.error('[useAppointments] Error fetching appointments:', error);
      // If business_id column doesn't exist, try without it (fallback for schema drift)
      if (error.code === '42703' || error.message?.includes('business_id')) {
        console.warn('[useAppointments] business_id column not found, trying without filter');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('appointments')
          .select('*')
          .order('appointment_date', { ascending: true, nullsFirst: false })
          .order('start_time', { ascending: true, nullsFirst: false });
        
        if (!fallbackError && fallbackData) {
          const convertedAppointments = fallbackData.map((apt: any) => ({
            ...apt,
            scheduled_date: apt.appointment_date 
              ? `${apt.appointment_date}T${apt.start_time || '00:00:00'}` 
              : apt.scheduled_date || new Date().toISOString(),
          }));
          setAppointments(convertedAppointments as Appointment[]);
          setLoading(false);
          return;
        }
      }
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
      // If business_id column doesn't exist, try without it (fallback for schema drift)
      if (error.code === '42703' || error.message?.includes('business_id')) {
        console.warn('[useServices] business_id column not found, trying without filter');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('services')
          .select('*')
          .order('name', { ascending: true });
        
        if (!fallbackError && fallbackData) {
          setServices(fallbackData as Service[]);
          setLoading(false);
          return;
        }
      }
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
      business_id: businessId,
      name: serviceData.name,
      description: (serviceData as any).description || null,
      price: serviceData.price,
      duration_minutes: serviceData.duration_minutes,
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
