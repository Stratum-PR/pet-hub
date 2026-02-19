import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from './useBusinessId';
import {
  validateClientPayload,
  validatePetPayload,
  validateServicePayload,
  validateAppointmentPayload,
} from '@/lib/businessValidation';

function uuidv4(): string {
  if (typeof crypto !== 'undefined') {
    const anyCrypto = crypto as unknown as { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array };
    if (typeof anyCrypto.randomUUID === 'function') return anyCrypto.randomUUID();
    if (typeof anyCrypto.getRandomValues === 'function') {
      const buf = new Uint8Array(16);
      anyCrypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      const b = Array.from(buf, (x) => x.toString(16).padStart(2, '0'));
      return `${b[0]}${b[1]}${b[2]}${b[3]}-${b[4]}${b[5]}-${b[6]}${b[7]}-${b[8]}${b[9]}-${b[10]}${b[11]}${b[12]}${b[13]}${b[14]}${b[15]}`;
    }
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-4${s4().slice(1)}-${((8 + Math.random() * 4) | 0).toString(16)}${s4().slice(1)}-${s4()}${s4()}${s4()}`;
}

// Types matching clients table schema
export interface BusinessClient {
  id: string;
  business_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}


export interface Pet {
  id: string;
  business_id: string;
  client_id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string | null;
  birth_month: number | null;
  birth_year: number | null;
  weight: number | null;
  color: string | null;
  notes: string | null;
  special_instructions: string | null;
  vaccination_status: 'up_to_date' | 'out_of_date' | 'unknown' | null;
  last_vaccination_date: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  // Client data from JOIN (optional, populated when fetched with JOIN)
  clients?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  // Legacy field for backward compatibility
  age?: number | null;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  category?: string | null;
  color?: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  client_id: string;
  pet_id: string;
  service_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'canceled' | 'no_show';
  notes: string | null;
  total_price: number | null;
  created_at: string;
  updated_at: string;
}

// Clients hook (uses the `clients` table exclusively)
export function useClients() {
  const businessId = useBusinessId();
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: err } = await supabase
      .from('clients')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message ?? 'Failed to load clients');
    } else if (data) {
      setError(null);
      setClients(data as BusinessClient[]);
    }
    setLoading(false);
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchClients();
  };

  useEffect(() => {
    fetchClients();
  }, [businessId]);

  const addClient = async (clientData: Omit<BusinessClient, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;
    const validation = validateClientPayload(clientData);
    if (!validation.valid) {
      if (import.meta.env.DEV) console.warn('[useClients] addClient validation:', validation.error);
      return null;
    }
    const { data, error } = await supabase
      .from('clients')
      .insert({ id: uuidv4(), ...clientData, business_id: businessId } as any)
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error('[useClients] addClient error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      const newClient = data as BusinessClient;
      setClients([newClient, ...clients]);
      return newClient;
    }
    return null;
  };

  const updateClient = async (id: string, clientData: Partial<BusinessClient>) => {
    if (!businessId) return null;

    const { data, error } = await supabase
      .from('clients')
      .update(clientData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error('[useClients] updateClient error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      const updated = data as BusinessClient;
      setClients(clients.map(c => c.id === id ? updated : c));
      return updated;
    }
    return null;
  };

  const deleteClient = async (id: string) => {
    if (!businessId) return false;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) {
      if (import.meta.env.DEV) console.error('[useClients] deleteClient error:', error.message, error.code, error.details);
      return false;
    }
    setClients(clients.filter(c => c.id !== id));
    return true;
  };

  return { clients, loading, error, refetch, addClient, updateClient, deleteClient };
}

// Pets hook
export function usePets() {
  const businessId = useBusinessId();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPets = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: err } = await supabase
      .from('pets')
      .select(`
        *,
        clients:client_id(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message ?? 'Failed to load pets');
    } else if (data) {
      setError(null);
      if (import.meta.env.DEV) console.log('[usePets] Fetched pets with client data:', data.length);
      setPets(data as any);
    }
    setLoading(false);
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchPets();
  };

  useEffect(() => {
    fetchPets();
  }, [businessId]);

  const addPet = async (petData: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;
    const validation = validatePetPayload(petData);
    if (!validation.valid) {
      if (import.meta.env.DEV) console.warn('[usePets] addPet validation:', validation.error);
      return null;
    }
    const { data, error } = await supabase
      .from('pets')
      .insert({ id: uuidv4(), ...petData, business_id: businessId })
      .select(`
        *,
        clients:client_id(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single();
    
    if (error) {
      if (import.meta.env.DEV) console.error('[usePets] addPet error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      // Refetch all pets with JOIN to ensure consistency
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
          email
        )
      `)
      .single();
    
    if (error) {
      if (import.meta.env.DEV) console.error('[usePets] updatePet error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      // Refetch all pets with JOIN to ensure consistency
      await fetchPets();
      return data;
    }
    return null;
  };

  const deletePet = async (id: string) => {
    if (!businessId) return false;

    const { error } = await supabase
      .from('pets')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);
    
    if (error) {
      if (import.meta.env.DEV) console.error('[usePets] deletePet error:', error.message, error.code, error.details);
      return false;
    }
    // Refetch all pets with JOIN to ensure consistency
    await fetchPets();
    return true;
  };

  return { pets, loading, error, refetch, addPet, updatePet, deletePet };
}

// Services hook
export function useServices() {
  const businessId = useBusinessId();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: err } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });
    if (err) {
      setError(err.message ?? 'Failed to load services');
    } else if (data) {
      setError(null);
      setServices(data);
    }
    setLoading(false);
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchServices();
  };

  useEffect(() => {
    fetchServices();
  }, [businessId]);

  const addService = async (serviceData: Omit<Service, 'id' | 'created_at'>) => {
    if (!businessId) return null;
    const validation = validateServicePayload(serviceData);
    if (!validation.valid) {
      if (import.meta.env.DEV) console.warn('[useServices] addService validation:', validation.error);
      return null;
    }
    const { data, error } = await supabase
      .from('services')
      .insert({ id: uuidv4(), ...serviceData, business_id: businessId })
      .select()
      .single();
    
    if (error) {
      if (import.meta.env.DEV) console.error('[useServices] addService error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      setServices([...services, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    }
    return null;
  };

  const updateService = async (id: string, serviceData: Partial<Service>) => {
    if (!businessId) return null;

    const { data, error } = await supabase
      .from('services')
      .update(serviceData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    
    if (error) {
      if (import.meta.env.DEV) console.error('[useServices] updateService error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      setServices(services.map(s => s.id === id ? data : s));
      return data;
    }
    return null;
  };

  const deleteService = async (id: string) => {
    if (!businessId) return false;

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);
    
    if (error) {
      if (import.meta.env.DEV) console.error('[useServices] deleteService error:', error.message, error.code, error.details);
      return false;
    }
    setServices(services.filter(s => s.id !== id));
    return true;
  };

  return { services, loading, error, refetch, addService, updateService, deleteService };
}

// Appointments hook
export function useAppointments() {
  const businessId = useBusinessId();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: err } = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', businessId)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });
    if (err) {
      setError(err.message ?? 'Failed to load appointments');
    } else if (data) {
      setError(null);
      if (import.meta.env.DEV) console.log('[useAppointments] Fetched', data.length, 'appointments');
      setAppointments(data as any);
    }
    setLoading(false);
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchAppointments();
  };

  useEffect(() => {
    fetchAppointments();
  }, [businessId]);

  const addAppointment = async (appointmentData: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;
    const validation = validateAppointmentPayload(appointmentData);
    if (!validation.valid) {
      if (import.meta.env.DEV) console.warn('[useAppointments] addAppointment validation:', validation.error);
      return null;
    }
    const { data, error } = await supabase
      .from('appointments')
      .insert({ id: uuidv4(), ...appointmentData, business_id: businessId })
      .select()
      .single();
    
    if (!error && data) {
      setAppointments([...appointments, data]);
      return data;
    }
    return null;
  };

  const updateAppointment = async (id: string, appointmentData: Partial<Appointment>) => {
    if (!businessId) return null;

    const { data, error } = await supabase
      .from('appointments')
      .update(appointmentData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    
    if (!error && data) {
      setAppointments(appointments.map(a => a.id === id ? data : a));
      return data;
    }
    return null;
  };

  const deleteAppointment = async (id: string) => {
    if (!businessId) return false;

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);
    
    if (!error) {
      setAppointments(appointments.filter(a => a.id !== id));
      return true;
    }
    return false;
  };

  // Push an already-inserted appointment into local state (avoids re-insert)
  const pushAppointment = (appointment: Appointment) => {
    setAppointments(prev => {
      if (prev.some(a => a.id === appointment.id)) return prev;
      return [...prev, appointment];
    });
  };

  return { appointments, loading, error, refetch, addAppointment, updateAppointment, deleteAppointment, pushAppointment };
}
