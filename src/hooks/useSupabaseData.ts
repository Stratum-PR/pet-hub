import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Client, Pet, Employee, TimeEntry, EmployeeShift, Appointment, Service } from '@/types';
import { useBusinessId } from './useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { loadDemoStored, patchDemoStored } from '@/lib/demoLocalSettings';
import { getDemoStaffSeed, getDemoStaffShiftsForRange, isDemoWorkspaceBusiness } from '@/lib/demoStaffSeed';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import {
  DEFAULT_PRIMARY_COLOR_HSL,
  DEFAULT_SECONDARY_COLOR_HSL,
} from '@/lib/defaultThemeColors';
import { staffRecordIdFromRow } from '@/lib/staffRecordCompat';

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
  const demoBrowseOnly = useDemoBrowseOnly();

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

    if (demoBrowseOnly) {
      const now = new Date().toISOString();
      const newClient: Client = {
        id: uuidv4(),
        business_id: businessId,
        first_name: clientData.first_name || '',
        last_name: clientData.last_name || '',
        email: clientData.email || '',
        phone: clientData.phone || '',
        address: clientData.address ?? '',
        notes: clientData.notes ?? null,
        created_at: now,
        updated_at: now,
      };
      setClients([newClient, ...clients]);
      return newClient;
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

    if (demoBrowseOnly) {
      const prev = clients.find((c) => c.id === id);
      if (!prev) return null;
      const updated: Client = {
        ...prev,
        ...clientData,
        id: prev.id,
        business_id: prev.business_id,
        updated_at: new Date().toISOString(),
      };
      setClients(clients.map((c) => (c.id === id ? updated : c)));
      return updated;
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
    if (demoBrowseOnly) {
      setClients(clients.filter((c) => c.id !== id));
      return true;
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
  const demoBrowseOnly = useDemoBrowseOnly();

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

    if (demoBrowseOnly) {
      const now = new Date().toISOString();
      const newPet = {
        id: uuidv4(),
        ...petData,
        business_id: businessId,
        created_at: now,
        updated_at: now,
      } as Pet;
      setPets([newPet, ...pets]);
      return newPet;
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

    if (demoBrowseOnly) {
      const prev = pets.find((p) => p.id === id);
      if (!prev) return null;
      const updated = { ...prev, ...petData, id: prev.id } as Pet;
      setPets(pets.map((p) => (p.id === id ? updated : p)));
      return updated;
    }

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
    if (demoBrowseOnly) {
      setPets(pets.filter((p) => p.id !== id));
      return true;
    }
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
  const demoBrowseOnly = useDemoBrowseOnly();

  const fetchEmployees = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setError(null);
    let empQuery = supabase
      .from('staff')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (isDemoRoute()) empQuery = empQuery.range(0, DEMO_CAP_EMPLOYEES - 1);
    const { data, error: err } = await empQuery;
    if (err) {
      if (isDemoRoute() && isDemoWorkspaceBusiness(businessId)) {
        setError(null);
        setEmployees(getDemoStaffSeed());
      } else {
        setError(err.message ?? 'Failed to load employees');
      }
    } else if (data) {
      setError(null);
      if (isDemoRoute() && isDemoWorkspaceBusiness(businessId) && data.length === 0) {
        setEmployees(getDemoStaffSeed());
      } else {
        setEmployees(data as Employee[]);
      }
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
    if (!businessId) return null;
    if (demoBrowseOnly) {
      const now = new Date().toISOString();
      const row: Employee = {
        id: uuidv4(),
        business_id: businessId,
        name: employeeData.name,
        email: employeeData.email,
        phone: employeeData.phone,
        pin: employeeData.pin,
        hourly_rate: employeeData.hourly_rate,
        role: employeeData.role,
        access_role: (employeeData as any).access_role ?? 'staff',
        status: employeeData.status,
        hire_date: (employeeData as any).hire_date ?? null,
        last_date: (employeeData as any).last_date ?? null,
        birth_month: (employeeData as any).birth_month ?? null,
        birth_day: (employeeData as any).birth_day ?? null,
        birth_year: (employeeData as any).birth_year ?? null,
        photo_url: (employeeData as any).photo_url ?? null,
        compensation_type: (employeeData as any).compensation_type ?? 'hourly',
        commission_rate: (employeeData as any).commission_rate ?? null,
        bank_routing_number: (employeeData as any).bank_routing_number ?? null,
        bank_account_number: (employeeData as any).bank_account_number ?? null,
        bank_name: (employeeData as any).bank_name ?? null,
        payment_notes: (employeeData as any).payment_notes ?? null,
        created_at: now,
        updated_at: now,
      } as Employee;
      setEmployees([row, ...employees]);
      return row;
    }
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
      access_role: (employeeData as any).access_role ?? 'staff',
      status: employeeData.status,
      hire_date: (employeeData as any).hire_date ?? null,
      last_date: (employeeData as any).last_date ?? null,
      birth_month: (employeeData as any).birth_month ?? null,
      birth_day: (employeeData as any).birth_day ?? null,
      birth_year: (employeeData as any).birth_year ?? null,
      photo_url: (employeeData as any).photo_url ?? null,
      compensation_type: (employeeData as any).compensation_type ?? 'hourly',
      commission_rate: (employeeData as any).commission_rate ?? null,
      bank_routing_number: (employeeData as any).bank_routing_number ?? null,
      bank_account_number: (employeeData as any).bank_account_number ?? null,
      bank_name: (employeeData as any).bank_name ?? null,
      payment_notes: (employeeData as any).payment_notes ?? null,
    };

    let { data, error } = await supabase.from('staff').insert(payload as any).select().single();

    // If schema cache doesn't know newer columns, retry with a smaller payload (legacy PostgREST cache).
    if (error?.code === 'PGRST204') {
      delete payload.hire_date;
      delete payload.last_date;
      delete payload.birth_month;
      delete payload.birth_day;
      delete payload.birth_year;
      delete payload.access_role;
      delete payload.photo_url;
      delete payload.compensation_type;
      delete payload.commission_rate;
      delete payload.bank_routing_number;
      delete payload.bank_account_number;
      delete payload.bank_name;
      delete payload.payment_notes;
      ({ data, error } = await supabase.from('staff').insert(payload as any).select().single());
    }

    if (!error && data) {
      setEmployees([data as Employee, ...employees]);
      return data;
    }
    if (error && import.meta.env.DEV) console.error('[useEmployees] addEmployee error:', error.message, error.code, error.details);
    return null;
  };

  const updateEmployee = async (id: string, employeeData: Partial<Employee>) => {
    if (demoBrowseOnly) {
      const prev = employees.find((e) => e.id === id);
      if (!prev) return null;
      const safeFields = [
        'name',
        'email',
        'phone',
        'pin',
        'hourly_rate',
        'role',
        'access_role',
        'status',
        'hire_date',
        'last_date',
        'birth_month',
        'birth_day',
        'birth_year',
        'pin_set_at',
        'pin_required',
        'photo_url',
        'compensation_type',
        'commission_rate',
        'bank_routing_number',
        'bank_account_number',
        'bank_name',
        'payment_notes',
      ] as const;
      const next = { ...prev } as Employee;
      for (const key of safeFields) {
        if (key in employeeData) (next as any)[key] = (employeeData as any)[key];
      }
      next.updated_at = new Date().toISOString();
      setEmployees(employees.map((e) => (e.id === id ? next : e)));
      return next;
    }
    // Only send known columns
    const safeFields = [
      'name',
      'email',
      'phone',
      'pin',
      'hourly_rate',
      'role',
      'access_role',
      'status',
      'hire_date',
      'last_date',
      'birth_month',
      'birth_day',
      'birth_year',
      'pin_set_at',
      'pin_required',
      'photo_url',
      'compensation_type',
      'commission_rate',
      'bank_routing_number',
      'bank_account_number',
      'bank_name',
      'payment_notes',
    ];
    const payload: Record<string, unknown> = {};
    for (const key of safeFields) {
      if (key in employeeData) payload[key] = (employeeData as any)[key];
    }

    let { data, error } = await supabase.from('staff').update(payload as any).eq('id', id).select().single();
    if (error?.code === 'PGRST204') {
      delete payload.hire_date;
      delete payload.last_date;
      delete payload.birth_month;
      delete payload.birth_day;
      delete payload.birth_year;
      delete payload.access_role;
      delete payload.photo_url;
      delete payload.compensation_type;
      delete payload.commission_rate;
      delete payload.bank_routing_number;
      delete payload.bank_account_number;
      delete payload.bank_name;
      delete payload.payment_notes;
      ({ data, error } = await supabase.from('staff').update(payload as any).eq('id', id).select().single());
    }

    if (!error && data) {
      setEmployees(employees.map(e => e.id === id ? data as Employee : e));
      return data;
    }
    if (error && import.meta.env.DEV) console.error('[useEmployees] updateEmployee error:', error.message, error.code, error.details);
    return null;
  };

  const deleteEmployee = async (id: string) => {
    if (demoBrowseOnly) {
      setEmployees(employees.filter((e) => e.id !== id));
      return true;
    }
    const { error } = await supabase.from('staff').delete().eq('id', id);
    
    if (!error) {
      setEmployees(employees.filter(e => e.id !== id));
      return true;
    }
    return false;
  };

  const verifyPin = async (pin: string) => {
    if (!businessId) return null;
    if (isDemoRoute() && isDemoWorkspaceBusiness(businessId)) {
      const list = employees.length > 0 ? employees : getDemoStaffSeed();
      const hit = list.find((e) => e.pin === pin && e.status === 'active');
      return hit ?? null;
    }
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('business_id', businessId)
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
  const demoBrowseOnly = useDemoBrowseOnly();

  const fetchTimeEntries = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data: employees } = await supabase.from('staff').select('id').eq('business_id', businessId);
    if (!employees || employees.length === 0) {
      setLoading(false);
      return;
    }
    const employeeIds = employees.map(e => e.id);
    let timeQuery = supabase
      .from('time_entries')
      .select('*')
      .in('staff_id', employeeIds)
      .order('clock_in', { ascending: false });
    if (isDemoRoute()) timeQuery = timeQuery.range(0, DEMO_CAP_TIME_ENTRIES - 1);
    const { data, error: err } = await timeQuery;
    if (err) {
      setError(err.message ?? 'Failed to load time entries');
    } else if (data) {
      setError(null);
      const normalized = (data as TimeEntry[]).map((te) => {
        const sid = staffRecordIdFromRow(te);
        return sid ? ({ ...te, staff_id: sid } as TimeEntry) : te;
      });
      setTimeEntries(normalized);
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

  // Allow other parts of the app (e.g. TimeKiosk RPC) to trigger a refetch.
  useEffect(() => {
    const handler = () => {
      // fire and forget; hook manages loading/error
      refetch();
    };
    window.addEventListener('timeentries:refetch', handler);
    return () => window.removeEventListener('timeentries:refetch', handler);
  }, [businessId]);

  const clockIn = async (employeeId: string) => {
    if (demoBrowseOnly) {
      const row = {
        id: uuidv4(),
        staff_id: employeeId,
        clock_in: new Date().toISOString(),
        clock_out: null,
      } as TimeEntry;
      setTimeEntries([row, ...timeEntries]);
      return row;
    }
    const { data, error } = await supabase
      .from('time_entries')
      .insert({ id: uuidv4(), staff_id: employeeId })
      .select()
      .single();
    
    if (!error && data) {
      setTimeEntries([data as TimeEntry, ...timeEntries]);
      return data;
    }
    return null;
  };

  const clockOut = async (entryId: string) => {
    if (demoBrowseOnly) {
      const out = new Date().toISOString();
      const next = timeEntries.map((t) =>
        t.id === entryId ? ({ ...t, clock_out: out } as TimeEntry) : t
      );
      setTimeEntries(next);
      return (next.find((t) => t.id === entryId) as TimeEntry) ?? null;
    }
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
    return timeEntries.find(t => t.staff_id === employeeId && !t.clock_out);
  };

  const updateTimeEntry = async (id: string, entryData: Partial<TimeEntry>) => {
    if (demoBrowseOnly) {
      const prev = timeEntries.find((t) => t.id === id);
      if (!prev) return null;
      const data = { ...prev, ...entryData, id: prev.id } as TimeEntry;
      setTimeEntries(timeEntries.map((t) => (t.id === id ? data : t)));
      return data;
    }
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
      staff_id: employeeId,
      clock_in: clockIn,
    };
    if (clockOut) {
      entryData.clock_out = clockOut;
    }
    if (demoBrowseOnly) {
      const row = { id: uuidv4(), ...entryData } as TimeEntry;
      setTimeEntries([row, ...timeEntries]);
      return row;
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
  const demoBrowseOnly = useDemoBrowseOnly();
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
      .from('staff_shifts')
      .select('*')
      .eq('business_id', businessId)
      .order('start_time', { ascending: true });
    if (options?.employeeId) {
      query = query.eq('staff_id', options.employeeId);
    }
    if (options?.dateRange) {
      const { start, end } = options.dateRange;
      query = query
        .lt('start_time', end.toISOString())
        .gt('end_time', start.toISOString());
    }
    const { data, error: shiftErr } = await query;
    if (shiftErr) {
      if (isDemoRoute() && isDemoWorkspaceBusiness(businessId)) {
        setError(null);
        setShifts(getDemoStaffShiftsForRange(options?.dateRange, options?.employeeId));
      } else {
        setError(shiftErr.message ?? 'Failed to load shifts');
      }
    } else if (data) {
      setError(null);
      const rows = ((data as EmployeeShift[]) ?? []).map((s) => {
        const sid = staffRecordIdFromRow(s);
        return sid ? ({ ...s, staff_id: sid } as EmployeeShift) : s;
      });
      if (isDemoRoute() && isDemoWorkspaceBusiness(businessId) && rows.length === 0) {
        setShifts(getDemoStaffShiftsForRange(options?.dateRange, options?.employeeId));
      } else {
        setShifts(rows);
      }
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

  const addShift = async (payload: { staff_id: string; start_time: string; end_time: string; notes?: string }) => {
    if (!businessId) return null;
    if (demoBrowseOnly) {
      const row: EmployeeShift = {
        id: uuidv4(),
        business_id: businessId,
        staff_id: payload.staff_id,
        start_time: payload.start_time,
        end_time: payload.end_time,
        notes: payload.notes ?? '',
      } as EmployeeShift;
      setShifts((prev) =>
        [...prev, row].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      );
      return row;
    }
    const insertRow: Record<string, unknown> = {
      id: uuidv4(),
      business_id: businessId,
      staff_id: payload.staff_id,
      start_time: payload.start_time,
      end_time: payload.end_time,
      notes: payload.notes ?? '',
    };
    const { data, error: err } = await supabase.from('staff_shifts').insert(insertRow).select().single();
    if (!err && data) {
      const raw = data as EmployeeShift;
      const sid = staffRecordIdFromRow(raw);
      const row = (sid ? { ...raw, staff_id: sid } : raw) as EmployeeShift;
      setShifts((prev) => [...prev, row].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
      return row;
    }
    if (import.meta.env.DEV) console.error('[useEmployeeShifts] addShift error:', err?.message);
    return null;
  };

  const updateShift = async (id: string, payload: Partial<Pick<EmployeeShift, 'start_time' | 'end_time' | 'notes'>>): Promise<EmployeeShift | null> => {
    if (demoBrowseOnly) {
      const prev = shifts.find((s) => s.id === id);
      if (!prev) throw new Error('Shift not found');
      const data = { ...prev, ...payload, id: prev.id } as EmployeeShift;
      setShifts((prevList) =>
        prevList.map((s) => (s.id === id ? data : s)).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      );
      return data;
    }
    const { data, error: err } = await supabase
      .from('staff_shifts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (!err && data) {
      const raw = data as EmployeeShift;
      const sid = staffRecordIdFromRow(raw);
      const normalized = (sid ? { ...raw, staff_id: sid } : raw) as EmployeeShift;
      setShifts((prev) =>
        prev.map((s) => (s.id === id ? normalized : s)).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      );
      return normalized;
    }
    if (import.meta.env.DEV) console.error('[useEmployeeShifts] updateShift error:', err?.message);
    throw new Error(err?.message ?? 'Failed to update shift');
  };

  const deleteShift = async (id: string) => {
    if (demoBrowseOnly) {
      setShifts((prev) => prev.filter((s) => s.id !== id));
      return true;
    }
    const { error: err } = await supabase.from('staff_shifts').delete().eq('id', id);
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
  const demoBrowseOnly = useDemoBrowseOnly();

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
          const convertedAppointments = fallbackData.map((apt: any) => {
            const staff_id = staffRecordIdFromRow(apt) ?? apt.staff_id;
            return {
              ...apt,
              staff_id,
              scheduled_date: apt.appointment_date
                ? `${apt.appointment_date}T${apt.start_time || '00:00:00'}`
                : apt.scheduled_date || new Date().toISOString(),
            };
          });
          setAppointments(convertedAppointments as Appointment[]);
          setLoading(false);
          return;
        }
      }
    } else if (data) {
      setError(null);
      if (import.meta.env.DEV) console.log('[useAppointments] Fetched', data.length, 'appointments');
      const convertedAppointments = data.map((apt: any) => {
        const staff_id = staffRecordIdFromRow(apt) ?? apt.staff_id;
        return {
          ...apt,
          staff_id,
          scheduled_date: apt.appointment_date
            ? `${apt.appointment_date}T${apt.start_time || '00:00:00'}`
            : apt.scheduled_date || new Date().toISOString(),
        };
      });
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
    if (demoBrowseOnly) {
      const now = new Date().toISOString();
      const row = {
        id: uuidv4(),
        business_id: businessId,
        ...appointmentData,
        created_at: now,
        updated_at: now,
      } as Appointment;
      setAppointments(
        [...appointments, row].sort(
          (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
        )
      );
      return row;
    }
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
    if (demoBrowseOnly) {
      const prev = appointments.find((a) => a.id === id);
      if (!prev) return null;
      const data = { ...prev, ...appointmentData, id: prev.id } as Appointment;
      setAppointments(appointments.map((a) => (a.id === id ? data : a)));
      return data;
    }
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
    if (demoBrowseOnly) {
      setAppointments(appointments.filter((a) => a.id !== id));
      return true;
    }
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
  const demoBrowseOnly = useDemoBrowseOnly();

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
    if (demoBrowseOnly) {
      const row = {
        id: uuidv4(),
        business_id: businessId,
        name: serviceData.name,
        description: (serviceData as { description?: string }).description ?? null,
        price: serviceData.price,
        duration_minutes: serviceData.duration_minutes,
        created_at: new Date().toISOString(),
      } as Service;
      setServices([...services, row].sort((a, b) => a.name.localeCompare(b.name)));
      return row;
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
    if (demoBrowseOnly) {
      const prev = services.find((s) => s.id === id);
      if (!prev) return null;
      const patch = { ...serviceData };
      delete (patch as Record<string, unknown>).category;
      delete (patch as Record<string, unknown>).cost;
      delete (patch as Record<string, unknown>).id;
      delete (patch as Record<string, unknown>).created_at;
      const data = { ...prev, ...patch, id: prev.id } as Service;
      setServices(services.map((s) => (s.id === id ? data : s)));
      return data;
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
  /** Optional business logo URL (typically Supabase Storage public URL). */
  business_logo_url: string | null;
  /** Optional business logo URL for light mode. */
  business_logo_url_light: string | null;
  /** Optional business logo URL for dark mode. */
  business_logo_url_dark: string | null;
  /** Sidebar header logo mode ('square' | 'wide'). */
  navbar_logo_mode: string;
  /** Sidebar header logo size in pixels (bounded in UI). */
  navbar_logo_size_px: string;
  /** IANA timezone name (e.g. 'America/Puerto_Rico'). */
  timezone: string;
  /** Global default low-stock threshold (number). Used when product has no per-product reorder_level. */
  default_low_stock_threshold: string;
  /** ISO date (YYYY-MM-DD) that anchors the pay-period cadence. */
  pay_schedule_anchor_date: string;
  /** Pay cadence in weeks (e.g. '1' for weekly, '2' for bi-weekly). */
  pay_schedule_cadence_weeks: string;
  /** Notification toggle: unbilled completed appointments. */
  notify_appointment_unbilled: string;
  /** Notification toggle: low stock inventory alerts. */
  notify_inventory_low_stock: string;
  /** Notification toggle: overdue partial payment alerts. */
  notify_payment_overdue: string;
  /** Notification toggle: birthday reminders. */
  notify_birthdays: string;
  /** Notification toggle: generic notices. */
  notify_general: string;
}

function isUnauthenticatedDemoPath(pathname: string): boolean {
  return pathname === '/demo' || pathname.startsWith('/demo/');
}

export function useSettings() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const demoLocalOnly = isUnauthenticatedDemoPath(pathname) && !user;

  const todayIso = new Date().toISOString().slice(0, 10);
  const [settings, setSettings] = useState<Settings>({
    business_name: 'Pet Hub',
    business_hours: '9:00 AM - 6:00 PM',
    primary_color: DEFAULT_PRIMARY_COLOR_HSL,
    secondary_color: DEFAULT_SECONDARY_COLOR_HSL,
    business_logo_url: null,
    business_logo_url_light: null,
    business_logo_url_dark: null,
    navbar_logo_mode: 'square',
    navbar_logo_size_px: '80',
    timezone: '',
    default_low_stock_threshold: '5',
    pay_schedule_anchor_date: todayIso,
    pay_schedule_cadence_weeks: '2',
    notify_appointment_unbilled: 'true',
    notify_inventory_low_stock: 'true',
    notify_payment_overdue: 'true',
    notify_birthdays: 'true',
    notify_general: 'true',
  });
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();

  const fetchSettings = async () => {
    if (!businessId) return;
    const mergeLocalDemo = isUnauthenticatedDemoPath(pathname) && !user;

    setLoading(true);
    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .maybeSingle();

    // Prefer full settings row, but fall back gracefully if newer columns
    // (e.g. timezone/logo variants) haven't been migrated in this environment yet.
    const fullSelect =
      'business_name, business_hours, primary_color, secondary_color, business_logo_url, business_logo_url_light, business_logo_url_dark, navbar_logo_mode, navbar_logo_size_px, timezone, default_low_stock_threshold, pay_schedule_anchor_date, pay_schedule_cadence_weeks, notify_appointment_unbilled, notify_inventory_low_stock, notify_payment_overdue, notify_birthdays, notify_general';
    const legacySelect =
      'business_name, business_hours, primary_color, secondary_color, business_logo_url, default_low_stock_threshold, pay_schedule_anchor_date, pay_schedule_cadence_weeks';

    let row: any = null;
    let error: any = null;
    {
      const res = await supabase
        .from('settings')
        .select(fullSelect)
        .eq('business_id', businessId)
        .maybeSingle();
      row = res.data as any;
      error = res.error as any;
    }
    if (error) {
      const msg = (error?.message ?? '').toLowerCase();
      const isMissingColumn = error?.code === '42703' || msg.includes('column') || msg.includes('schema cache');
      if (isMissingColumn) {
        const res2 = await supabase
          .from('settings')
          .select(legacySelect)
          .eq('business_id', businessId)
          .maybeSingle();
        row = res2.data as any;
        error = res2.error as any;
      }
    }

    const defaults = {
      business_name: business?.name ?? 'Pet Hub',
      business_hours: '9:00 AM - 6:00 PM',
      primary_color: DEFAULT_PRIMARY_COLOR_HSL,
      secondary_color: DEFAULT_SECONDARY_COLOR_HSL,
      business_logo_url: null as string | null,
      business_logo_url_light: null as string | null,
      business_logo_url_dark: null as string | null,
      navbar_logo_mode: 'square',
      navbar_logo_size_px: '80',
      timezone: '',
      default_low_stock_threshold: '5',
      pay_schedule_anchor_date: todayIso,
      pay_schedule_cadence_weeks: '2',
      notify_appointment_unbilled: 'true',
      notify_inventory_low_stock: 'true',
      notify_payment_overdue: 'true',
      notify_birthdays: 'true',
      notify_general: 'true',
    };

    const baseFromDb = !error && row
      ? {
          business_name: row.business_name ?? defaults.business_name,
          business_hours: row.business_hours ?? defaults.business_hours,
          primary_color: row.primary_color ?? defaults.primary_color,
          secondary_color: row.secondary_color ?? defaults.secondary_color,
          business_logo_url: row.business_logo_url ?? defaults.business_logo_url,
          business_logo_url_light: row.business_logo_url_light ?? defaults.business_logo_url_light,
          business_logo_url_dark: row.business_logo_url_dark ?? defaults.business_logo_url_dark,
          navbar_logo_mode: row.navbar_logo_mode ?? defaults.navbar_logo_mode,
          navbar_logo_size_px: String(row.navbar_logo_size_px ?? defaults.navbar_logo_size_px),
          timezone: row.timezone ?? defaults.timezone,
          default_low_stock_threshold: row.default_low_stock_threshold ?? defaults.default_low_stock_threshold,
          pay_schedule_anchor_date: row.pay_schedule_anchor_date ?? defaults.pay_schedule_anchor_date,
          pay_schedule_cadence_weeks: row.pay_schedule_cadence_weeks ?? defaults.pay_schedule_cadence_weeks,
          notify_appointment_unbilled: row.notify_appointment_unbilled ?? defaults.notify_appointment_unbilled,
          notify_inventory_low_stock: row.notify_inventory_low_stock ?? defaults.notify_inventory_low_stock,
          notify_payment_overdue: row.notify_payment_overdue ?? defaults.notify_payment_overdue,
          notify_birthdays: row.notify_birthdays ?? defaults.notify_birthdays,
          notify_general: row.notify_general ?? defaults.notify_general,
        }
      : defaults;

    if (mergeLocalDemo) {
      const blob = loadDemoStored(businessId);
      const keys = [
        'business_name',
        'business_hours',
        'primary_color',
        'secondary_color',
        'business_logo_url',
        'business_logo_url_light',
        'business_logo_url_dark',
        'navbar_logo_mode',
        'navbar_logo_size_px',
        'timezone',
        'default_low_stock_threshold',
        'pay_schedule_anchor_date',
        'pay_schedule_cadence_weeks',
        'notify_appointment_unbilled',
        'notify_inventory_low_stock',
        'notify_payment_overdue',
        'notify_birthdays',
        'notify_general',
      ] as const;
      const merged = { ...baseFromDb } as Settings;
      for (const k of keys) {
        if (!Object.prototype.hasOwnProperty.call(blob, k)) continue;
        const v = blob[k];
        if (v === '') continue;
        (merged as Record<string, unknown>)[k] = v as string | null;
      }
      setSettings(merged);
    } else {
      setSettings(baseFromDb);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!businessId) return; // wait for businessId to resolve
    fetchSettings();
  }, [businessId, demoLocalOnly, pathname, user?.id]);

  const settingsKeyToColumn: Record<string, string> = {
    business_name: 'business_name',
    business_hours: 'business_hours',
    primary_color: 'primary_color',
    secondary_color: 'secondary_color',
    business_logo_url: 'business_logo_url',
    business_logo_url_light: 'business_logo_url_light',
    business_logo_url_dark: 'business_logo_url_dark',
    navbar_logo_mode: 'navbar_logo_mode',
    navbar_logo_size_px: 'navbar_logo_size_px',
    timezone: 'timezone',
    default_low_stock_threshold: 'default_low_stock_threshold',
    pay_schedule_anchor_date: 'pay_schedule_anchor_date',
    pay_schedule_cadence_weeks: 'pay_schedule_cadence_weeks',
    notify_appointment_unbilled: 'notify_appointment_unbilled',
    notify_inventory_low_stock: 'notify_inventory_low_stock',
    notify_payment_overdue: 'notify_payment_overdue',
    notify_birthdays: 'notify_birthdays',
    notify_general: 'notify_general',
  };

  const updateSetting = async (key: string, value: string | null): Promise<{ ok: boolean; error?: string }> => {
    if (!businessId) return { ok: false, error: 'No business ID' };
    const column = settingsKeyToColumn[key];
    if (!column) return { ok: false, error: `Unknown setting key: ${key}` };

    if (demoLocalOnly) {
      patchDemoStored(businessId, { [key]: value ?? undefined });
      setSettings((prev) => ({ ...prev, [key]: value } as Settings));
      return { ok: true };
    }

    const payload = { business_id: businessId, [column]: value };
    const { error } = await supabase
      .from('settings')
      .upsert(payload, { onConflict: 'business_id' });

    if (error) {
      if (import.meta.env.DEV) console.error('[useSettings] upsert error:', error);
      return { ok: false, error: error.message };
    }
    setSettings(prev => ({ ...prev, [key]: value }));
    return { ok: true };
  };

  const saveAllSettings = async (newSettings: Partial<Settings>): Promise<{ ok: boolean; error?: string }> => {
    if (!businessId) return { ok: false, error: 'No business ID' };

    if (demoLocalOnly) {
      const patch: Record<string, string | null | undefined> = {};
      for (const [k, v] of Object.entries(newSettings)) {
        if (v === undefined) continue;
        patch[k] = v as string | null;
      }
      patchDemoStored(businessId, patch);
      setSettings((prev) => ({ ...prev, ...newSettings }));
      return { ok: true };
    }

    const payload: Record<string, unknown> = { business_id: businessId };
    const keys = [
      'business_name',
      'business_hours',
      'primary_color',
      'secondary_color',
      'business_logo_url',
      'business_logo_url_light',
      'business_logo_url_dark',
      'navbar_logo_mode',
      'navbar_logo_size_px',
      'timezone',
      'default_low_stock_threshold',
      'pay_schedule_anchor_date',
      'pay_schedule_cadence_weeks',
      'notify_appointment_unbilled',
      'notify_inventory_low_stock',
      'notify_payment_overdue',
      'notify_birthdays',
      'notify_general',
    ] as const;
    for (const k of keys) {
      const v = newSettings[k];
      if (v !== undefined) {
        // Allow explicit null to clear optional fields like `business_logo_url`.
        if (typeof v === 'string') {
          if (v !== '') payload[settingsKeyToColumn[k]] = v;
        } else {
          payload[settingsKeyToColumn[k]] = v;
        }
      }
    }

    const { error } = await supabase
      .from('settings')
      .upsert(payload, { onConflict: 'business_id' });

    if (error) {
      if (import.meta.env.DEV) console.error('[useSettings] saveAllSettings upsert error:', error);
      return { ok: false, error: error.message };
    }
    setSettings(prev => ({ ...prev, ...newSettings }));
    return { ok: true };
  };

  return { settings, loading, updateSetting, saveAllSettings, refetch: fetchSettings };
}
