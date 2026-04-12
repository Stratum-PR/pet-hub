import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from './useBusinessId';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import {
  validateClientPayload,
  validatePetPayload,
  validateServicePayload,
  validateAppointmentPayload,
} from '@/lib/businessValidation';
import { staffRecordIdFromRow } from '@/lib/staffRecordCompat';
import { devConsole } from '@/lib/clientDebug';

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
  /** NULL = account-owned (client portal); set when created by staff for a business. */
  business_id: string | null;
  client_id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  /** FK to public.breeds (preferred over legacy breed text). */
  breed_id?: string | null;
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
  const demoBrowseOnly = useDemoBrowseOnly();
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
      const scopedClients = (data as BusinessClient[]) ?? [];
      const scopedIds = new Set(scopedClients.map((c) => c.id));

      const { data: appointmentRefs } = await supabase
        .from('appointments')
        .select('client_id')
        .eq('business_id', businessId)
        .not('client_id', 'is', null);
      const appointmentClientIds = [
        ...new Set(
          ((appointmentRefs as { client_id: string | null }[] | null) ?? [])
            .map((r) => r.client_id)
            .filter((id): id is string => !!id && !scopedIds.has(id))
        ),
      ];

      let appointmentClients: BusinessClient[] = [];
      if (appointmentClientIds.length > 0) {
        const { data: linkedClients } = await supabase
          .from('clients')
          .select('*')
          .in('id', appointmentClientIds);
        appointmentClients = (linkedClients as BusinessClient[] | null) ?? [];
      }

      setError(null);
      setClients([...scopedClients, ...appointmentClients]);
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

  const addClient = async (
    clientData: Omit<BusinessClient, 'id' | 'created_at' | 'updated_at'> & { staff_notes_business?: string | null },
  ) => {
    if (!businessId) return null;
    const { staff_notes_business, ...rest } = clientData;
    const validation = validateClientPayload(rest);
    if (!validation.valid) {
      devConsole.warn('[useClients] addClient validation:', validation.error);
      return null;
    }
    if (demoBrowseOnly) {
      const now = new Date().toISOString();
      const newClient: BusinessClient = {
        id: uuidv4(),
        ...rest,
        business_id: businessId,
        created_at: now,
        updated_at: now,
      };
      setClients([newClient, ...clients]);
      return newClient;
    }
    const newId = uuidv4();
    const { data, error } = await supabase
      .from('clients')
      .insert({ id: newId, ...rest, business_id: businessId } as never)
      .select()
      .single();

    if (error) {
      devConsole.error('[useClients] addClient error:', error.message, error.code, error.details);
      return null;
    }
    if (staff_notes_business !== undefined && staff_notes_business?.trim()) {
      await supabase.from('client_business_notes').upsert(
        {
          client_id: newId,
          business_id: businessId,
          notes: staff_notes_business.trim(),
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'client_id,business_id' },
      );
    }
    if (data) {
      const newClient = data as BusinessClient;
      setClients([newClient, ...clients]);
      return newClient;
    }
    return null;
  };

  const updateClient = async (
    id: string,
    clientData: Partial<BusinessClient> & { staff_notes_business?: string | null },
  ) => {
    if (!businessId) return null;
    const { staff_notes_business, ...row } = clientData;
    if (demoBrowseOnly) {
      const prev = clients.find((c) => c.id === id);
      if (!prev) return null;
      const updated = { ...prev, ...row, id: prev.id, updated_at: new Date().toISOString() };
      setClients(clients.map((c) => (c.id === id ? updated : c)));
      return updated;
    }

    const { data, error } = await supabase.from('clients').update(row).eq('id', id).select().single();

    if (error) {
      devConsole.error('[useClients] updateClient error:', error.message, error.code, error.details);
      return null;
    }

    if (staff_notes_business !== undefined) {
      await supabase.from('client_business_notes').upsert(
        {
          client_id: id,
          business_id: businessId,
          notes: staff_notes_business?.trim() || null,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'client_id,business_id' },
      );
    }

    if (data) {
      const updated = data as BusinessClient;
      setClients(clients.map((c) => (c.id === id ? updated : c)));
      return updated;
    }
    return null;
  };

  const deleteClient = async (id: string) => {
    if (!businessId) return false;
    if (demoBrowseOnly) {
      setClients(clients.filter((c) => c.id !== id));
      return true;
    }

    const { error } = await supabase.from('clients').delete().eq('id', id);

    if (error) {
      devConsole.error('[useClients] deleteClient error:', error.message, error.code, error.details);
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
  const demoBrowseOnly = useDemoBrowseOnly();
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
      const scopedPets = (data as Pet[]) ?? [];
      const scopedIds = new Set(scopedPets.map((p) => p.id));
      const { data: appointmentRefs } = await supabase
        .from('appointments')
        .select('pet_id')
        .eq('business_id', businessId)
        .not('pet_id', 'is', null);
      const appointmentPetIds = [
        ...new Set(
          ((appointmentRefs as { pet_id: string | null }[] | null) ?? [])
            .map((r) => r.pet_id)
            .filter((id): id is string => !!id && !scopedIds.has(id))
        ),
      ];

      let appointmentPets: Pet[] = [];
      if (appointmentPetIds.length > 0) {
        const { data: linkedPets } = await supabase
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
          .in('id', appointmentPetIds);
        appointmentPets = (linkedPets as Pet[] | null) ?? [];
      }

      const mergedPets = [...scopedPets, ...appointmentPets];
      setError(null);
      devConsole.log('[usePets] Fetched pets with client data:', mergedPets.length);
      setPets(mergedPets as any);
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

  const addPet = async (petData: Omit<Pet, 'id' | 'created_at' | 'updated_at'> & { staff_notes_business?: string | null }) => {
    if (!businessId) return null;
    const { staff_notes_business, ...rest } = petData as Omit<Pet, 'id' | 'created_at' | 'updated_at'> & {
      staff_notes_business?: string | null;
    };
    const validation = validatePetPayload(rest);
    if (!validation.valid) {
      devConsole.warn('[usePets] addPet validation:', validation.error);
      return null;
    }
    if (demoBrowseOnly) {
      const now = new Date().toISOString();
      const row = { id: uuidv4(), ...rest, business_id: businessId, created_at: now, updated_at: now } as Pet;
      setPets([row, ...pets]);
      return row;
    }
    const newId = uuidv4();
    const { data, error } = await supabase
      .from('pets')
      .insert({ id: newId, ...rest, business_id: businessId })
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
      devConsole.error('[usePets] addPet error:', error.message, error.code, error.details);
      return null;
    }
    if (staff_notes_business !== undefined && staff_notes_business?.trim()) {
      await supabase.from('pet_business_notes').upsert(
        {
          pet_id: newId,
          business_id: businessId,
          notes: staff_notes_business.trim(),
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'pet_id,business_id' },
      );
    }
    if (data) {
      await fetchPets();
      return data;
    }
    return null;
  };

  const updatePet = async (id: string, petData: Partial<Pet> & { staff_notes_business?: string | null }) => {
    if (!businessId) return null;
    if (demoBrowseOnly) {
      const prev = pets.find((p) => p.id === id);
      if (!prev) return null;
      const data = { ...prev, ...petData, id: prev.id, updated_at: new Date().toISOString() } as Pet;
      setPets(pets.map((p) => (p.id === id ? data : p)));
      return data;
    }

    const { staff_notes_business, ...petRow } = petData as Partial<Pet> & {
      staff_notes_business?: string | null;
    };

    const { data, error } = await supabase
      .from('pets')
      .update(petRow)
      .eq('id', id)
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
      devConsole.error('[usePets] updatePet error:', error.message, error.code, error.details);
      return null;
    }

    if (staff_notes_business !== undefined) {
      await supabase.from('pet_business_notes').upsert(
        {
          pet_id: id,
          business_id: businessId,
          notes: staff_notes_business?.trim() || null,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'pet_id,business_id' },
      );
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
    if (demoBrowseOnly) {
      setPets(pets.filter((p) => p.id !== id));
      return true;
    }

    const { error } = await supabase.from('pets').delete().eq('id', id);
    
    if (error) {
      devConsole.error('[usePets] deletePet error:', error.message, error.code, error.details);
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
  const demoBrowseOnly = useDemoBrowseOnly();
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
      devConsole.warn('[useServices] addService validation:', validation.error);
      return null;
    }
    if (demoBrowseOnly) {
      const row = {
        id: uuidv4(),
        ...serviceData,
        business_id: businessId,
        created_at: new Date().toISOString(),
      } as Service;
      setServices([...services, row].sort((a, b) => a.name.localeCompare(b.name)));
      return row;
    }
    const { data, error } = await supabase
      .from('services')
      .insert({ id: uuidv4(), ...serviceData, business_id: businessId })
      .select()
      .single();
    
    if (error) {
      devConsole.error('[useServices] addService error:', error.message, error.code, error.details);
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
    if (demoBrowseOnly) {
      const prev = services.find((s) => s.id === id);
      if (!prev) return null;
      const data = { ...prev, ...serviceData, id: prev.id } as Service;
      setServices(services.map((s) => (s.id === id ? data : s)));
      return data;
    }

    const { data, error } = await supabase
      .from('services')
      .update(serviceData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    
    if (error) {
      devConsole.error('[useServices] updateService error:', error.message, error.code, error.details);
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
    if (demoBrowseOnly) {
      setServices(services.filter((s) => s.id !== id));
      return true;
    }

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);
    
    if (error) {
      devConsole.error('[useServices] deleteService error:', error.message, error.code, error.details);
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
  const demoBrowseOnly = useDemoBrowseOnly();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
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
      devConsole.log('[useAppointments] Fetched', data.length, 'appointments');
      const withStaff = (data as any[]).map((apt) => {
        const staff_id = staffRecordIdFromRow(apt) ?? apt.staff_id;
        return { ...apt, staff_id };
      });
      setAppointments(withStaff as any);
    }
    setLoading(false);
  }, [businessId]);

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchAppointments();
  };

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    if (!businessId || demoBrowseOnly) return;
    const channel = supabase
      .channel(`appointments-rt-biz-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          void fetchAppointments();
        }
      )
      .subscribe();
    const poll = window.setInterval(() => void fetchAppointments(), 45_000);
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [businessId, demoBrowseOnly, fetchAppointments]);

  const addAppointment = async (appointmentData: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;
    const validation = validateAppointmentPayload(appointmentData);
    if (!validation.valid) {
      devConsole.warn('[useAppointments] addAppointment validation:', validation.error);
      return null;
    }
    if (demoBrowseOnly) {
      const now = new Date().toISOString();
      const row = {
        id: uuidv4(),
        ...appointmentData,
        business_id: businessId,
        created_at: now,
        updated_at: now,
      } as Appointment;
      setAppointments([...appointments, row]);
      return row;
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
    if (demoBrowseOnly) {
      const prev = appointments.find((a) => a.id === id);
      if (!prev) return null;
      const data = { ...prev, ...appointmentData, id: prev.id, updated_at: new Date().toISOString() } as Appointment;
      setAppointments(appointments.map((a) => (a.id === id ? data : a)));
      return data;
    }

    const prev = appointments.find((a) => a.id === id);
    if (prev) {
      const optimistic = { ...prev, ...appointmentData, id: prev.id } as Appointment;
      setAppointments((curr) => curr.map((a) => (a.id === id ? optimistic : a)));
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(appointmentData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    
    if (error) {
      if (prev) setAppointments((curr) => curr.map((a) => (a.id === id ? prev! : a)));
      return null;
    }
    if (data) {
      const row = data as any;
      const staff_id = staffRecordIdFromRow(row) ?? row.staff_id;
      const normalized = { ...row, staff_id } as Appointment;
      setAppointments((curr) => curr.map((a) => (a.id === id ? normalized : a)));
      return normalized;
    }
    return null;
  };

  const deleteAppointment = async (id: string) => {
    if (!businessId) return false;
    if (demoBrowseOnly) {
      setAppointments(appointments.filter((a) => a.id !== id));
      return true;
    }

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
