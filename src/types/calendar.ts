// Calendar-specific types for the appointment booking interface

export interface CalendarAppointment {
  id: string;
  petId?: string; // Pet ID for lookup
  petName: string;
  breed: string;
  ownerName: string;
  ownerPhone?: string;
  service: string;
  serviceSize?: string;
  duration: number; // in minutes
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  color: string; // hex color code
  employeeId: string;
  employeeName: string;
  hasAlert?: boolean;
  notes?: string;
  price?: number;
}

export interface CalendarEmployee {
  id: string;
  name: string;
  initials?: string;
  color?: string;
}

export interface WaitlistEntry {
  id: string;
  petName: string;
  breed: string;
  ownerName: string;
  ownerPhone: string;
  service: string;
  price: number;
  requestedDate: string; // ISO date string
  requestedTime?: string; // "Any Time" or specific time
  status: 'with_first_available' | 'specific_time';
  dateAdded: string; // ISO date string
  hasAlert?: boolean;
  notes?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  color: string; // hex color code
}

export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarFilters {
  service: string; // "Grooming" or "All Services"
  employee: string; // "All Employees" or specific employee ID
  view: CalendarView;
}

// Available colors for service categories
export const APPOINTMENT_COLORS = {
  blue: '#7DD3FC',
  pink: '#F9A8D4',
  green: '#86EFAC',
  yellow: '#FDE68A',
  red: '#FCA5A5',
} as const;

export type AppointmentColor = keyof typeof APPOINTMENT_COLORS;
