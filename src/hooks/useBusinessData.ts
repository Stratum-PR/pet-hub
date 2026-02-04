import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from './useBusinessId';

// Types matching new schema
export interface Customer {
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
  client_id: string; // CRITICAL: Use client_id (not customer_id) - customers table was merged into clients
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
  // Legacy field mapping (for compatibility during migration)
  customer_id?: string; // Deprecated - use client_id
  customer?: any; // Deprecated - use clients
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  customer_id: string;
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

// Customers hook
export function useCustomers() {
  const businessId = useBusinessId();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    // CRITICAL: Query clients table (not customers) - customers was merged into clients
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      // Convert clients format to Customer format for compatibility
      const convertedCustomers = data.map((c: any) => ({
        id: c.id,
        business_id: c.business_id,
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        email: c.email || null,
        phone: c.phone || '',
        address: c.address || null,
        city: c.city || null,
        state: c.state || null,
        zip_code: c.zip_code || null,
        notes: c.notes || null,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
      setCustomers(convertedCustomers);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [businessId]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;

    // CRITICAL: Insert into clients table (not customers)
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...customerData, business_id: businessId })
      .select()
      .single();
    
    if (error) {
      console.error('[useCustomers] addCustomer error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      // Convert to Customer format
      const convertedCustomer = {
        id: data.id,
        business_id: data.business_id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || null,
        phone: data.phone || '',
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        notes: data.notes || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setCustomers([convertedCustomer, ...customers]);
      return convertedCustomer;
    }
    return null;
  };

  const updateCustomer = async (id: string, customerData: Partial<Customer>) => {
    if (!businessId) return null;

    // CRITICAL: Update clients table (not customers)
    const { data, error } = await supabase
      .from('clients')
      .update(customerData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    
    if (error) {
      console.error('[useCustomers] updateCustomer error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      // Convert to Customer format
      const convertedCustomer = {
        id: data.id,
        business_id: data.business_id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || null,
        phone: data.phone || '',
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        notes: data.notes || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setCustomers(customers.map(c => c.id === id ? convertedCustomer : c));
      return convertedCustomer;
    }
    return null;
  };

  const deleteCustomer = async (id: string) => {
    if (!businessId) return false;

    // CRITICAL: Delete from clients table (not customers)
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);
    
    if (error) {
      console.error('[useCustomers] deleteCustomer error:', error.message, error.code, error.details);
      return false;
    }
    setCustomers(customers.filter(c => c.id !== id));
    return true;
  };

  return { customers, loading, addCustomer, updateCustomer, deleteCustomer, refetch: fetchCustomers };
}

// Pets hook
export function usePets() {
  const businessId = useBusinessId();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPets = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    // CRITICAL: JOIN with clients table (not customers) - customers was merged into clients
    // Supabase automatically resolves foreign key relationships
    const { data, error } = await supabase
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
    
    if (!error && data) {
      console.log('[usePets] Fetched pets with customer data:', data.length);
      setPets(data as any);
    } else if (error) {
      console.error('[usePets] Error fetching pets:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPets();
  }, [businessId]);

  const addPet = async (petData: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;

    // CRITICAL: Map customer_id to client_id if present (for backward compatibility)
    const petDataToInsert = {
      ...petData,
      client_id: (petData as any).client_id || (petData as any).customer_id, // Support both during migration
    };
    delete (petDataToInsert as any).customer_id; // Remove customer_id if present
    
    const { data, error } = await supabase
      .from('pets')
      .insert({ ...petDataToInsert, business_id: businessId })
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
      console.error('[usePets] addPet error:', error.message, error.code, error.details);
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

    // CRITICAL: Map customer_id to client_id if present (for backward compatibility)
    const petDataToUpdate = { ...petData };
    if ((petDataToUpdate as any).customer_id && !(petDataToUpdate as any).client_id) {
      (petDataToUpdate as any).client_id = (petDataToUpdate as any).customer_id;
      delete (petDataToUpdate as any).customer_id;
    }
    
    const { data, error } = await supabase
      .from('pets')
      .update(petDataToUpdate)
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
      console.error('[usePets] updatePet error:', error.message, error.code, error.details);
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
      console.error('[usePets] deletePet error:', error.message, error.code, error.details);
      return false;
    }
    // Refetch all pets with JOIN to ensure consistency
    await fetchPets();
    return true;
  };

  return { pets, loading, addPet, updatePet, deletePet, refetch: fetchPets };
}

// Services hook
export function useServices() {
  const businessId = useBusinessId();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });
    
    if (!error && data) {
      setServices(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServices();
  }, [businessId]);

  const addService = async (serviceData: Omit<Service, 'id' | 'created_at'>) => {
    if (!businessId) return null;

    const { data, error } = await supabase
      .from('services')
      .insert({ ...serviceData, business_id: businessId })
      .select()
      .single();
    
    if (error) {
      console.error('[useServices] addService error:', error.message, error.code, error.details);
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
      console.error('[useServices] updateService error:', error.message, error.code, error.details);
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
      console.error('[useServices] deleteService error:', error.message, error.code, error.details);
      return false;
    }
    setServices(services.filter(s => s.id !== id));
    return true;
  };

  return { services, loading, addService, updateService, deleteService, refetch: fetchServices };
}

// Appointments hook
export function useAppointments() {
  const businessId = useBusinessId();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', businessId)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (!error && data) {
      setAppointments(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, [businessId]);

  const addAppointment = async (appointmentData: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;

    const { data, error } = await supabase
      .from('appointments')
      .insert({ ...appointmentData, business_id: businessId })
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

  return { appointments, loading, addAppointment, updateAppointment, deleteAppointment, refetch: fetchAppointments };
}
