import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Pet, Employee, TimeEntry, EmployeeShift, Appointment, Service } from '@/types';
import { useBusinessId } from './useBusinessId';
import { useAuth } from '@/contexts/AuthContext';

/** When true, data hooks cap rows to avoid loading thousands of rows on demo (e.g. seed appointments until March 2026). */
function isDemoRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/demo');
}

const DEMO_CAP_APPOINTMENTS = 300;
const DEMO_CAP_CLIENTS = 200;
const DEMO_CAP_PETS = 200;
const DEMO_CAP_EMPLOYEES = 100;
const DEMO_CAP_TIME_ENTRIES = 500;

function uuidv4(): string {
  // Prefer native when available
  if (typeof crypto !== 'undefined') {
    const anyCrypto = crypto as unknown as { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array };
    if (typeof anyCrypto.randomUUID === 'function') return anyCrypto.randomUUID();
    if (typeof anyCrypto.getRandomValues === 'function') {
      const buf = new Uint8Array(16);
      anyCrypto.getRandomValues(buf);
      // RFC4122 v4
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      const b = Array.from(buf, (x) => x.toString(16).padStart(2, '0'));
      return `${b[0]}${b[1]}${b[2]}${b[3]}-${b[4]}${b[5]}-${b[6]}${b[7]}-${b[8]}${b[9]}-${b[10]}${b[11]}${b[12]}${b[13]}${b[14]}${b[15]}`;
    }
  }
  // Last resort fallback
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-4${s4().slice(1)}-${((8 + Math.random() * 4) | 0).toString(16)}${s4().slice(1)}-${s4()}${s4()}${s4()}`;
}

export interface Breed {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
}

export function useBreeds() {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBreeds = async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('breeds')
        .select('*')
        .order('species', { ascending: true })
        .order('name', { ascending: true });

      if (err) {
        if (import.meta.env.DEV) console.error('[useBreeds] Error fetching breeds:', err);
        setError(err.message ?? 'Failed to load breeds');
      } else if (data) {
        if (import.meta.env.DEV) console.log('[useBreeds] Fetched', data.length, 'breeds');
        setBreeds(data as Breed[]);
      } else {
        setBreeds([]);
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[useBreeds] Exception:', err);
      setError(err?.message ?? 'Failed to load breeds');
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchBreeds();
  };

  useEffect(() => {
    fetchBreeds();
  }, []);

  return { breeds, loading, error, refetch };
}

/** Minimal client shape for display names (e.g. Transactions list). */
export interface ClientName {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * Lightweight client list (id, first_name, last_name, email only) for pages that only need display names.
 * Use useClients() when full client data is needed.
 */
export function useClientNames() {
  const [clients, setClients] = useState<ClientName[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();
  const { profile } = useAuth();

  const [error, setError] = useState<string | null>(null);

  const fetchClientNames = async () => {
    if (!businessId) {
      setLoading(false);
      setClients([]);
      return;
    }
    setError(null);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (import.meta.env.DEV && (sessionError || (!session && !sessionError))) {
      if (sessionError) console.error('[useClientNames] Session error:', sessionError);
    }
    try {
      let query = supabase
        .from('clients')
        .select('id, first_name, last_name, email')
        .eq('business_id', businessId)
        .neq('email', 'orphaned-pets@system.local')
        .order('created_at', { ascending: false });
      if (isDemoRoute()) query = query.range(0, DEMO_CAP_CLIENTS - 1);
      const { data, error } = await query;
      if (error) {
        if (import.meta.env.DEV) console.error('[useClientNames] Error:', error);
        setError(error.message ?? 'Failed to load clients');
      } else {
        setError(null);
        setClients((data || []).map((c: any) => ({
          id: c.id,
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          email: c.email || '',
        })));
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[useClientNames] Exception:', err);
      setError(err?.message ?? 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchClientNames();
  };

  useEffect(() => {
    fetchClientNames();
  }, [businessId, profile?.business_id]);

  return { clients, loading, error, refetch };
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const businessId = useBusinessId();
  const { profile } = useAuth();

  const fetchClients = async () => {
    if (!businessId) {
      if (import.meta.env.DEV) {
        console.warn('[useClients] No businessId, skipping fetch.', {
          profile: profile ? { email: profile.email, business_id: profile.business_id } : null,
          location: window.location.pathname,
        });
      }
      setLoading(false);
      setClients([]);
      return;
    }
    setError(null);
    // CRITICAL: Verify session exists before querying (RLS requires auth.uid())
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (import.meta.env.DEV) {
      if (sessionError) console.error('[useClients] Session error:', sessionError);
      if (!session && !sessionError) console.warn('[useClients] No active session - RLS may block query. This is OK for demo mode.');
      console.log('[useClients] Fetching clients for businessId:', businessId, 'Type:', typeof businessId, 'Has session:', !!session);
    }

    try {
      let clientQuery = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('business_id', businessId)
        .neq('email', 'orphaned-pets@system.local')
        .order('created_at', { ascending: false });
      if (isDemoRoute()) clientQuery = clientQuery.range(0, DEMO_CAP_CLIENTS - 1);
      const { data, error, count } = await clientQuery;

      if (error) {
        if (import.meta.env.DEV) {
          console.error('[useClients] Error fetching clients:', error);
          console.error('[useClients] Error details:', JSON.stringify(error, null, 2));
        }
        setError(error.message ?? 'Failed to load clients');
      } else {
        setError(null);
        if (import.meta.env.DEV) {
          console.log('[useClients] Query successful.', {
            count,
            dataLength: data?.length || 0,
            businessId,
            sampleClient: data?.[0] ? {
              id: data[0].id,
              first_name: data[0].first_name,
              last_name: data[0].last_name,
              email: data[0].email,
              business_id: data[0].business_id,
            } : null,
          });
        }
        const mappedClients = (data || []).map((c: any) => ({
          id: c.id,
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          notes: c.notes || null,
          business_id: c.business_id || '',
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
        if (import.meta.env.DEV) console.log('[useClients] Fetched clients:', mappedClients.length);
        setClients(mappedClients);
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[useClients] Exception:', err);
      setError(err?.message ?? 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchClients();
  };

  useEffect(() => {
    fetchClients();
  }, [businessId, profile?.business_id]);

  const addClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) {
      if (import.meta.env.DEV) console.warn('[useClients] addClient skipped: no businessId');
      return null;
    }

    // Some deployments have clients.id without a DEFAULT (NOT NULL) → inserts fail unless we provide one.
    const newId = uuidv4();

    const payload = {
      id: newId,
      business_id: businessId,
      first_name: clientData.first_name || '',
      last_name: clientData.last_name || '',
      email: clientData.email || '',
      phone: clientData.phone || '',
      address: clientData.address ?? '',
      notes: clientData.notes ?? null,
    };

    const { data, error } = await supabase
      .from('clients')
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error('[useClients] addClient error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      const newClient: Client = {
        id: data.id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        notes: data.notes || null,
        business_id: data.business_id || '',
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setClients([newClient, ...clients]);
      return newClient;
    }
    return null;
  };

  const updateClient = async (id: string, clientData: Partial<Client>) => {
    if (!businessId) {
      if (import.meta.env.DEV) console.warn('[useClients] updateClient skipped: no businessId');
      return null;
    }

    const patch: Record<string, unknown> = {
      first_name: clientData.first_name,
      last_name: clientData.last_name,
      email: clientData.email,
      phone: clientData.phone,
      address: clientData.address,
      notes: clientData.notes,
    };
    // Remove undefined keys so we don't overwrite with null
    Object.keys(patch).forEach(k => { if (patch[k] === undefined) delete patch[k]; });

    const { data, error } = await supabase
      .from('clients')
      .update(patch as any)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error('[useClients] updateClient error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      const updated: Client = {
        id: data.id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        notes: data.notes || null,
        business_id: data.business_id || '',
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setClients(clients.map(c => c.id === id ? updated : c));
      return updated;
    }
    return null;
  };

  const deleteClient = async (id: string) => {
    if (!businessId) {
      if (import.meta.env.DEV) console.warn('[useClients] deleteClient skipped: no businessId');
      return false;
    }
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

export function usePets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const businessId = useBusinessId();

  const fetchPets = async () => {
    if (!businessId) {
      if (import.meta.env.DEV) console.warn('[usePets] No businessId, skipping fetch');
      setLoading(false);
      return;
    }
    setError(null);
    if (import.meta.env.DEV) console.log('[usePets] Fetching pets for businessId:', businessId);

    // CRITICAL: JOIN with clients table and breeds table to get owner and canonical breed information
    // Supabase PostgREST syntax: 
    // - clients:client_id(...) means join clients table via client_id foreign key
    // - breeds:breed_id(...) means join breeds table via breed_id foreign key
    let petsQuery = supabase
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
    if (isDemoRoute()) petsQuery = petsQuery.range(0, DEMO_CAP_PETS - 1);
    const { data, error } = await petsQuery;
    
    if (error) {
      if (import.meta.env.DEV) {
        console.error('[usePets] Error fetching pets:', error);
        console.error('[usePets] Error details:', JSON.stringify(error, null, 2));
      }
      setError(error.message ?? 'Failed to load pets');
    } else if (data) {
      setError(null);
      if (import.meta.env.DEV) {
        console.log('[usePets] Fetched', data.length, 'pets with client data');
        if (data.length > 0) {
          console.log('[usePets] Sample pet with client and breed:', {
            petId: data[0].id,
            petName: data[0].name,
            clientId: data[0].client_id,
            clientData: data[0].clients,
            breedId: data[0].breed_id,
            breedData: data[0].breeds,
            legacyBreed: data[0].breed,
          });
        }
      }
      setPets(data as Pet[]);
    } else {
      if (import.meta.env.DEV) console.warn('[usePets] No data returned');
      setPets([]);
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

    const { data, error } = await supabase
      .from('pets')
      .insert({ id: uuidv4(), ...petData, business_id: businessId })
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
    
    if (error) {
      if (import.meta.env.DEV) console.error('[usePets] addPet error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
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
    
    if (error) {
      if (import.meta.env.DEV) console.error('[usePets] updatePet error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
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
    if (error) {
      if (import.meta.env.DEV) console.error('[usePets] deletePet error:', error.message, error.code, error.details);
      return false;
    }
    setPets(pets.filter(p => p.id !== id));
    return true;
  };

  return { pets, loading, error, refetch, addPet, updatePet, deletePet };
}

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const businessId = useBusinessId();

  const fetchEmployees = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setError(null);
    let empQuery = supabase
      .from('employees')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (isDemoRoute()) empQuery = empQuery.range(0, DEMO_CAP_EMPLOYEES - 1);
    const { data, error: err } = await empQuery;
    if (err) {
      setError(err.message ?? 'Failed to load employees');
    } else if (data) {
      setError(null);
      setEmployees(data as Employee[]);
    }
    setLoading(false);
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchEmployees();
  };

  useEffect(() => {
    fetchEmployees();
  }, [businessId]);

  const addEmployee = async (employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => {
    // Build payload with only columns known to the DB; add business_id.
    const payload: Record<string, unknown> = {
      id: uuidv4(),
      business_id: businessId,
      name: employeeData.name,
      email: employeeData.email,
      phone: employeeData.phone,
      pin: employeeData.pin,
      hourly_rate: employeeData.hourly_rate,
      role: employeeData.role,
      status: employeeData.status,
      hire_date: (employeeData as any).hire_date ?? null,
      last_date: (employeeData as any).last_date ?? null,
    };

    let { data, error } = await supabase.from('employees').insert(payload as any).select().single();

    // If schema cache doesn't know hire_date/last_date, retry without them
    if (error?.code === 'PGRST204') {
      delete payload.hire_date;
      delete payload.last_date;
      ({ data, error } = await supabase.from('employees').insert(payload as any).select().single());
    }

    if (!error && data) {
      setEmployees([data as Employee, ...employees]);
      return data;
    }
    if (error && import.meta.env.DEV) console.error('[useEmployees] addEmployee error:', error.message, error.code, error.details);
    return null;
  };

  const updateEmployee = async (id: string, employeeData: Partial<Employee>) => {
    // Only send known columns
    const safeFields = ['name', 'email', 'phone', 'pin', 'hourly_rate', 'role', 'status', 'hire_date', 'last_date'];
    const payload: Record<string, unknown> = {};
    for (const key of safeFields) {
      if (key in employeeData) payload[key] = (employeeData as any)[key];
    }

    let { data, error } = await supabase.from('employees').update(payload as any).eq('id', id).select().single();
    if (error?.code === 'PGRST204') {
      delete payload.hire_date;
      delete payload.last_date;
      ({ data, error } = await supabase.from('employees').update(payload as any).eq('id', id).select().single());
    }

    if (!error && data) {
      setEmployees(employees.map(e => e.id === id ? data as Employee : e));
      return data;
    }
    if (error && import.meta.env.DEV) console.error('[useEmployees] updateEmployee error:', error.message, error.code, error.details);
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

  return { employees, loading, error, refetch, addEmployee, updateEmployee, deleteEmployee, verifyPin };
}

export function useTimeEntries() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const businessId = useBusinessId();

  const fetchTimeEntries = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('business_id', businessId);
    if (!employees || employees.length === 0) {
      setLoading(false);
      return;
    }
    const employeeIds = employees.map(e => e.id);
    let timeQuery = supabase
      .from('time_entries')
      .select('*')
      .in('employee_id', employeeIds)
      .order('clock_in', { ascending: false });
    if (isDemoRoute()) timeQuery = timeQuery.range(0, DEMO_CAP_TIME_ENTRIES - 1);
    const { data, error: err } = await timeQuery;
    if (err) {
      setError(err.message ?? 'Failed to load time entries');
    } else if (data) {
      setError(null);
      setTimeEntries(data as TimeEntry[]);
    }
    setLoading(false);
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchTimeEntries();
  };

  useEffect(() => {
    fetchTimeEntries();
  }, [businessId]);

  const clockIn = async (employeeId: string) => {
    const { data, error } = await supabase
      .from('time_entries')
      .insert({ id: uuidv4(), employee_id: employeeId })
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
      .insert({ id: uuidv4(), ...entryData })
      .select()
      .single();
    
    if (!error && data) {
      setTimeEntries([data as TimeEntry, ...timeEntries]);
      return data;
    }
    return null;
  };

  return { timeEntries, loading, error, refetch, clockIn, clockOut, getActiveEntry, updateTimeEntry, addTimeEntry };
}

/** Fetch and mutate employee_shifts (scheduled shifts). Pass dateRange to scope calendar; optional employeeId for "My schedule". */
export function useEmployeeShifts(options?: { employeeId?: string; dateRange?: { start: Date; end: Date } }) {
  const businessId = useBusinessId();
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShifts = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setError(null);
    let query = supabase
      .from('employee_shifts')
      .select('*')
      .eq('business_id', businessId)
      .order('start_time', { ascending: true });
    if (options?.employeeId) {
      query = query.eq('employee_id', options.employeeId);
    }
    if (options?.dateRange) {
      const { start, end } = options.dateRange;
      query = query
        .lt('start_time', end.toISOString())
        .gt('end_time', start.toISOString());
    }
    const { data, err } = await query;
    if (err) {
      setError(err.message ?? 'Failed to load shifts');
    } else if (data) {
      setError(null);
      setShifts((data as EmployeeShift[]) ?? []);
    }
    setLoading(false);
  };

  const refetch = async () => {
    setError(null);
    setLoading(true);
    await fetchShifts();
  };

  useEffect(() => {
    fetchShifts();
  }, [businessId, options?.employeeId, options?.dateRange?.start?.toISOString(), options?.dateRange?.end?.toISOString()]);

  const addShift = async (payload: { employee_id: string; start_time: string; end_time: string; notes?: string }) => {
    if (!businessId) return null;
    const { data, error: err } = await supabase
      .from('employee_shifts')
      .insert({
        id: uuidv4(),
        business_id: businessId,
        employee_id: payload.employee_id,
        start_time: payload.start_time,
        end_time: payload.end_time,
        notes: payload.notes ?? '',
      })
      .select()
      .single();
    if (!err && data) {
      setShifts((prev) => [...prev, data as EmployeeShift].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
      return data as EmployeeShift;
    }
    if (import.meta.env.DEV) console.error('[useEmployeeShifts] addShift error:', err?.message);
    return null;
  };

  const updateShift = async (id: string, payload: Partial<Pick<EmployeeShift, 'start_time' | 'end_time' | 'notes'>>): Promise<EmployeeShift | null> => {
    const { data, error: err } = await supabase
      .from('employee_shifts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (!err && data) {
      setShifts((prev) => prev.map((s) => (s.id === id ? (data as EmployeeShift) : s)).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
      return data as EmployeeShift;
    }
    if (import.meta.env.DEV) console.error('[useEmployeeShifts] updateShift error:', err?.message);
    throw new Error(err?.message ?? 'Failed to update shift');
  };

  const deleteShift = async (id: string) => {
    const { error: err } = await supabase.from('employee_shifts').delete().eq('id', id);
    if (!err) {
      setShifts((prev) => prev.filter((s) => s.id !== id));
      return true;
    }
    if (import.meta.env.DEV) console.error('[useEmployeeShifts] deleteShift error:', err?.message);
    return false;
  };

  return { shifts, loading, error, refetch, addShift, updateShift, deleteShift };
}

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const businessId = useBusinessId();

  const fetchAppointments = async () => {
    if (!businessId) {
      if (import.meta.env.DEV) console.warn('[useAppointments] No businessId, skipping fetch');
      setLoading(false);
      return;
    }
    setError(null);
    if (import.meta.env.DEV) console.log('[useAppointments] Fetching appointments for businessId:', businessId);

    let query = supabase
      .from('appointments')
      .select('*');
    
    // Try with business_id first, fallback if column doesn't exist
    try {
      query = query.eq('business_id', businessId);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[useAppointments] business_id filter failed, trying without it');
    }
    query = query
      .order('appointment_date', { ascending: true, nullsFirst: false })
      .order('start_time', { ascending: true, nullsFirst: false });
    if (isDemoRoute()) query = query.range(0, DEMO_CAP_APPOINTMENTS - 1);
    const { data, error } = await query;
    if (error) {
      setError(error.message ?? 'Failed to load appointments');
      if (import.meta.env.DEV) console.error('[useAppointments] Error fetching appointments:', error);
      if (error.code === '42703' || error.message?.includes('business_id')) {
        if (import.meta.env.DEV) console.warn('[useAppointments] business_id column not found, trying without filter');
        let fallbackQuery = supabase
          .from('appointments')
          .select('*')
          .order('appointment_date', { ascending: true, nullsFirst: false })
          .order('start_time', { ascending: true, nullsFirst: false });
        if (isDemoRoute()) fallbackQuery = fallbackQuery.range(0, DEMO_CAP_APPOINTMENTS - 1);
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        
        if (!fallbackError && fallbackData) {
          setError(null);
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
    } else if (data) {
      setError(null);
      if (import.meta.env.DEV) console.log('[useAppointments] Fetched', data.length, 'appointments');
      const convertedAppointments = data.map((apt: any) => ({
        ...apt,
        scheduled_date: apt.appointment_date 
          ? `${apt.appointment_date}T${apt.start_time || '00:00:00'}` 
          : apt.scheduled_date || new Date().toISOString(),
      }));
      setAppointments(convertedAppointments as Appointment[]);
    } else {
      if (import.meta.env.DEV) console.warn('[useAppointments] No data returned');
      setAppointments([]);
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
    const { data, error } = await supabase
      .from('appointments')
      .insert({ id: uuidv4(), business_id: businessId, ...appointmentData })
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

  return { appointments, loading, error, refetch, addAppointment, updateAppointment, deleteAppointment };
}

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const businessId = useBusinessId();

  const fetchServices = async () => {
    if (!businessId) {
      if (import.meta.env.DEV) console.warn('[useServices] No businessId, skipping fetch');
      setLoading(false);
      return;
    }
    setError(null);
    if (import.meta.env.DEV) console.log('[useServices] Fetching services for businessId:', businessId);
    const { data, error: err } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });
    if (err) {
      setError(err.message ?? 'Failed to load services');
      if (err.code === '42703' || err.message?.includes('business_id')) {
        if (import.meta.env.DEV) console.warn('[useServices] business_id column not found, trying without filter');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('services')
          .select('*')
          .order('name', { ascending: true });
        if (!fallbackError && fallbackData) {
          setError(null);
          setServices(fallbackData as Service[]);
          setLoading(false);
          return;
        }
      }
    } else if (data) {
      setError(null);
      if (import.meta.env.DEV) console.log('[useServices] Fetched', data.length, 'services');
      setServices(data as Service[]);
    } else {
      if (import.meta.env.DEV) console.warn('[useServices] No data returned');
      setServices([]);
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
    if (!businessId) {
      if (import.meta.env.DEV) console.warn('[useServices] addService skipped: no businessId');
      return null;
    }
    // NOTE: `public.services` (in this project) does NOT have `category` or `cost` columns.
    const cleanData: Record<string, unknown> = {
      business_id: businessId,
      name: serviceData.name,
      description: (serviceData as { description?: string }).description ?? null,
      price: serviceData.price,
      duration_minutes: serviceData.duration_minutes,
    };
    delete (cleanData as Record<string, unknown>).category;
    delete (cleanData as Record<string, unknown>).cost;

    const { data, error } = await supabase
      .from('services')
      .insert({ id: uuidv4(), ...cleanData })
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error('[useServices] addService error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      setServices([...services, data as Service].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    }
    return null;
  };

  const updateService = async (id: string, serviceData: Partial<Service>) => {
    if (!businessId) {
      if (import.meta.env.DEV) console.warn('[useServices] updateService skipped: no businessId');
      return null;
    }
    const patch = { ...serviceData };
    delete (patch as Record<string, unknown>).category;
    delete (patch as Record<string, unknown>).cost;
    delete (patch as Record<string, unknown>).id;
    delete (patch as Record<string, unknown>).created_at;

    const { data, error } = await supabase
      .from('services')
      .update(patch)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error('[useServices] updateService error:', error.message, error.code, error.details);
      return null;
    }
    if (data) {
      setServices(services.map(s => s.id === id ? (data as Service) : s));
      return data;
    }
    return null;
  };

  const deleteService = async (id: string) => {
    if (!businessId) {
      if (import.meta.env.DEV) console.warn('[useServices] deleteService skipped: no businessId');
      return false;
    }
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

export interface Settings {
  business_name: string;
  business_hours: string;
  primary_color: string;
  secondary_color: string;
  /** Global default low-stock threshold (number). Used when product has no per-product reorder_level. */
  default_low_stock_threshold: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    business_name: 'Pet Hub',
    business_hours: '9:00 AM - 6:00 PM',
    primary_color: '168 60% 45%',
    secondary_color: '200 55% 55%',
    default_low_stock_threshold: '5',
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
        business_name: business?.name || settingsMap.business_name || 'Pet Hub',
        business_hours: settingsMap.business_hours || '9:00 AM - 6:00 PM',
        primary_color: settingsMap.primary_color || '168 60% 45%',
        secondary_color: settingsMap.secondary_color || '200 55% 55%',
        default_low_stock_threshold: settingsMap.default_low_stock_threshold ?? '5',
      });
    } else if (!businessError && business) {
      // If no settings but business exists, use business name
      setSettings({
        business_name: business.name || 'Pet Hub',
        business_hours: '9:00 AM - 6:00 PM',
        primary_color: '168 60% 45%',
        secondary_color: '200 55% 55%',
        default_low_stock_threshold: '5',
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

  const saveAllSettings = async (newSettings: Partial<Settings>) => {
    if (!businessId) return false;

    const keys = (['business_name', 'business_hours', 'primary_color', 'secondary_color', 'default_low_stock_threshold'] as const).filter(
      (k) => newSettings[k] !== undefined && newSettings[k] !== ''
    );
    const results = await Promise.all(keys.map((k) => updateSetting(k, String(newSettings[k]))));
    return results.every((r) => r);
  };

  return { settings, loading, updateSetting, saveAllSettings, refetch: fetchSettings };
}
