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

/** Permission tier (separate from job title in `role`: groomer, receptionist, …). */
export type StaffAccessRole = 'manager' | 'staff' | 'admin' | 'contractor';

export type StaffCompensationType = 'hourly' | 'commission';

export interface Employee {
  id: string;
  /** Present on rows from Supabase; omitted in some demo/local shapes. */
  business_id?: string;
  name: string;
  email: string;
  phone: string;
  pin: string;
  hourly_rate: number;
  /** Job title / position label */
  role: string;
  access_role?: StaffAccessRole | null;
  /** Linked auth user for manager/staff with login */
  user_id?: string | null;
  status: 'active' | 'inactive';
  hire_date?: string;
  last_date?: string;
  /** Birthday (staff notifications). */
  birth_month?: number | null;
  birth_day?: number | null;
  birth_year?: number | null;
  pin_set_at?: string;
  pin_required?: boolean;
  /** Public URL in `staff-photos` bucket (same limits as pet photos). */
  photo_url?: string | null;
  compensation_type?: StaffCompensationType | null;
  /** Commission percentage when `compensation_type` is commission. */
  commission_rate?: number | null;
  bank_routing_number?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
  payment_notes?: string | null;
  created_at: string;
  updated_at: string;
}

/** Preferred alias for UI copy and new code */
export type StaffMember = Employee;

export interface TimeEntry {
  id: string;
  staff_id: string;
  business_id?: string;
  clock_in: string;
  clock_out?: string;
  notes?: string;
  location_latitude?: number;
  location_longitude?: number;
  location_name?: string;
  is_off_schedule?: boolean;
  rounded_clock_in?: string;
  rounded_clock_out?: string;
  status?: 'active' | 'pending_edit' | 'approved' | 'rejected';
  edit_request_id?: string;
  created_at: string;
}

export interface TimeEntryEditRequest {
  id: string;
  time_entry_id: string;
  staff_id: string;
  business_id: string;
  requested_by?: string;
  requested_changes: Record<string, any>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeShift {
  id: string;
  business_id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  pet_id: string;
  staff_id?: string;
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