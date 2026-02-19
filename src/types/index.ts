export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
  business_id?: string;
  // Payment details (saved if user chooses to save payment in checkout)
  card_number?: string;
  card_name?: string;
  card_expiry?: string;
  card_cvv?: string;
  created_at: string;
  updated_at: string;
}

export interface Pet {
  id: string;
  client_id?: string; // References clients.id
  business_id?: string; // Multi-tenant field
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed_id?: string | null; // References breeds.id (canonical breed)
  breed?: string | null; // Legacy TEXT field, kept for backward compatibility
  birth_month?: number | null;
  birth_year?: number | null;
  weight: number;
  notes?: string;
  vaccination_status?: 'up_to_date' | 'out_of_date' | 'unknown' | string;
  last_vaccination_date?: string | null;
  photo_url?: string | null;
  last_grooming_date?: string;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
  // Legacy field for backward compatibility
  age?: number;
  // Joined data from Supabase queries
  clients?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  breeds?: {
    id: string;
    name: string;
    species: string;
  } | null;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  pin: string;
  hourly_rate: number;
  role: string;
  status: 'active' | 'inactive';
  hire_date?: string;
  last_date?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out?: string;
  notes?: string;
  created_at: string;
}

export interface EmployeeShift {
  id: string;
  business_id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  pet_id: string;
  employee_id?: string;
  scheduled_date: string;
  service_type: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  price: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  transaction_id?: string | null;
  billed?: boolean;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}