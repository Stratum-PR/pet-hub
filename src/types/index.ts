export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
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
  client_id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string;
  age: number;
  weight: number;
  notes?: string;
  vaccination_status?: string;
  last_grooming_date?: string;
  created_at: string;
  updated_at: string;
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