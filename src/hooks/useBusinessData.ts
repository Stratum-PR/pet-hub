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
  customer_id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string | null;
  age: number | null;
  weight: number | null;
  color: string | null;
  notes: string | null;
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
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

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setCustomers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [businessId]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;

    const { data, error } = await supabase
      .from('customers')
      .insert({ ...customerData, business_id: businessId })
      .select()
      .single();
    
    if (!error && data) {
      setCustomers([data, ...customers]);
      return data;
    }
    return null;
  };

  const updateCustomer = async (id: string, customerData: Partial<Customer>) => {
    if (!businessId) return null;

    const { data, error } = await supabase
      .from('customers')
      .update(customerData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    
    if (!error && data) {
      setCustomers(customers.map(c => c.id === id ? data : c));
      return data;
    }
    return null;
  };

  const deleteCustomer = async (id: string) => {
    if (!businessId) return false;

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);
    
    if (!error) {
      setCustomers(customers.filter(c => c.id !== id));
      return true;
    }
    return false;
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

    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setPets(data);
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
      .select()
      .single();
    
    if (!error && data) {
      setPets([data, ...pets]);
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
      .select()
      .single();
    
    if (!error && data) {
      setPets(pets.map(p => p.id === id ? data : p));
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
    
    if (!error) {
      setPets(pets.filter(p => p.id !== id));
      return true;
    }
    return false;
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
    
    if (!error && data) {
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
    
    if (!error && data) {
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
    
    if (!error) {
      setServices(services.filter(s => s.id !== id));
      return true;
    }
    return false;
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
