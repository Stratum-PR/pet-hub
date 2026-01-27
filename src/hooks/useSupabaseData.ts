import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Pet, Employee, TimeEntry, Appointment, Service } from '@/types';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setClients(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const addClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();
    
    if (!error && data) {
      setClients([data, ...clients]);
      return data;
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

  const fetchPets = async () => {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setPets(data as Pet[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPets();
  }, []);

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

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setEmployees(data as Employee[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

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

  const fetchTimeEntries = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .order('clock_in', { ascending: false });
    
    if (!error && data) {
      setTimeEntries(data as TimeEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTimeEntries();
  }, []);

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

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('scheduled_date', { ascending: true });
    
    if (!error && data) {
      setAppointments(data as Appointment[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

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

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error && data) {
      setServices(data as Service[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const addService = async (serviceData: Omit<Service, 'id' | 'created_at'>) => {
    const cleanData = {
      name: serviceData.name,
      description: serviceData.description || null,
      price: serviceData.price,
      duration_minutes: serviceData.duration_minutes,
    };
    
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

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*');
    
    if (!error && data) {
      const settingsMap: Record<string, string> = {};
      data.forEach((item: { key: string; value: string }) => {
        settingsMap[item.key] = item.value;
      });
      setSettings({
        business_name: settingsMap.business_name || 'Stratum Hub',
        business_hours: settingsMap.business_hours || '9:00 AM - 6:00 PM',
        primary_color: settingsMap.primary_color || '168 60% 45%',
        secondary_color: settingsMap.secondary_color || '200 55% 55%',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = async (key: string, value: string) => {
    // First try to update, if no rows affected, insert
    const { data: existingData } = await supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (existingData) {
      const { error } = await supabase
        .from('settings')
        .update({ value })
        .eq('key', key);
      
      if (error) return false;
    } else {
      const { error } = await supabase
        .from('settings')
        .insert({ key, value });
      
      if (error) return false;
    }

    setSettings(prev => ({ ...prev, [key]: value }));
    return true;
  };

  const saveAllSettings = async (newSettings: Settings) => {
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
