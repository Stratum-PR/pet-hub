import { CalendarAppointment, CalendarEmployee, WaitlistEntry, APPOINTMENT_COLORS } from '@/types/calendar';
import { format, addDays } from 'date-fns';

// Sample employees
export const sampleEmployees: CalendarEmployee[] = [
  { id: 'emp1', name: 'Chris K', initials: 'CK' },
  { id: 'emp2', name: 'Chelsea T', initials: 'CT' },
];

// Sample appointments for May 8, 2024 (Wednesday)
export const getSampleAppointments = (date: Date): CalendarAppointment[] => {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // Check if it's May 8, 2024
  if (format(date, 'yyyy-MM-dd') === '2024-05-08') {
    return [
      // Chris K's appointments
      {
        id: 'apt1',
        petName: 'Toby',
        breed: 'Cane Corso',
        ownerName: 'Yolanda Campbell',
        service: 'Dog Haircut',
        serviceSize: 'Large',
        duration: 60,
        startTime: '07:30',
        endTime: '08:30',
        color: APPOINTMENT_COLORS.blue,
        employeeId: 'emp1',
        employeeName: 'Chris K',
        hasAlert: false,
        price: 75.00,
      },
      {
        id: 'apt2',
        petName: 'Bentley',
        breed: 'American Curl',
        ownerName: 'Jane C 12312312345',
        service: 'Dog Bath',
        serviceSize: 'Medium and below',
        duration: 45,
        startTime: '09:00',
        endTime: '09:45',
        color: APPOINTMENT_COLORS.green,
        employeeId: 'emp1',
        employeeName: 'Chris K',
        hasAlert: false,
        price: 45.00,
      },
      {
        id: 'apt3',
        petName: 'Jeb',
        breed: 'Afghan Hound',
        ownerName: 'Jim Smith',
        service: 'Dog Haircut',
        serviceSize: 'Medium',
        duration: 45,
        startTime: '10:00',
        endTime: '10:45',
        color: APPOINTMENT_COLORS.pink,
        employeeId: 'emp1',
        employeeName: 'Chris K',
        hasAlert: false,
        price: 50.00,
      },
      {
        id: 'apt4',
        petName: 'Ruger',
        breed: 'Doodle',
        ownerName: 'John Alexander asdfasdf',
        service: 'Dog Haircut',
        serviceSize: 'Large',
        duration: 60,
        startTime: '11:30',
        endTime: '12:30',
        color: APPOINTMENT_COLORS.blue,
        employeeId: 'emp1',
        employeeName: 'Chris K',
        hasAlert: false,
        price: 75.00,
      },
      // Chelsea T's appointments
      {
        id: 'apt5',
        petName: 'Bear',
        breed: 'Alaskan Malamute',
        ownerName: 'Natalie Allen',
        ownerPhone: '(123) 123-1234',
        service: 'Dog Haircut',
        serviceSize: 'Large',
        duration: 45,
        startTime: '07:00',
        endTime: '07:45',
        color: APPOINTMENT_COLORS.blue,
        employeeId: 'emp2',
        employeeName: 'Chelsea T',
        hasAlert: false,
        price: 75.00,
      },
      {
        id: 'apt6',
        petName: 'Jane C 12312312345',
        breed: '',
        ownerName: 'Jane C 12312312345',
        service: 'Dog Haircut',
        serviceSize: 'Large',
        duration: 60,
        startTime: '09:00',
        endTime: '10:00',
        color: APPOINTMENT_COLORS.blue,
        employeeId: 'emp2',
        employeeName: 'Chelsea T',
        hasAlert: false,
        price: 75.00,
      },
      {
        id: 'apt7',
        petName: 'Doggo',
        breed: '',
        ownerName: 'Dawn Smith',
        service: 'Dog Bath',
        serviceSize: 'Medium and below',
        duration: 45,
        startTime: '11:00',
        endTime: '11:45',
        color: APPOINTMENT_COLORS.green,
        employeeId: 'emp2',
        employeeName: 'Chelsea T',
        hasAlert: false,
        price: 45.00,
      },
      {
        id: 'apt8',
        petName: 'Rocket',
        breed: 'unbearded collie',
        ownerName: 'Lesley Doughty',
        service: 'Dog Haircut',
        serviceSize: 'Small',
        duration: 30,
        startTime: '11:30',
        endTime: '12:00',
        color: APPOINTMENT_COLORS.red,
        employeeId: 'emp2',
        employeeName: 'Chelsea T',
        hasAlert: false,
        price: 40.00,
      },
    ];
  }
  
  return [];
};

// Sample waitlist entries
export const sampleWaitlist: WaitlistEntry[] = [
  {
    id: 'wl1',
    petName: 'Bear',
    breed: 'Alaskan Malamute',
    ownerName: 'Natalie Allen',
    ownerPhone: '(123) 123-1234',
    service: 'Dog Bath Large',
    price: 0.00,
    requestedDate: '2022-11-16',
    requestedTime: 'Any Time',
    status: 'with_first_available',
    dateAdded: '2022-11-16T00:00:00Z',
    hasAlert: true,
  },
  {
    id: 'wl2',
    petName: 'ky',
    breed: 'Saluki',
    ownerName: 'nderson',
    ownerPhone: '123-1234',
    service: 'Dog Grooming',
    price: 0.00,
    requestedDate: '2024-03-11',
    requestedTime: 'Any Time',
    status: 'with_first_available',
    dateAdded: '2024-03-11T00:00:00Z',
    hasAlert: true,
  },
];

// Sample service categories with colors
export const sampleServiceCategories = [
  { id: 'cat1', name: 'Dog Haircut', color: APPOINTMENT_COLORS.blue },
  { id: 'cat2', name: 'Dog Bath', color: APPOINTMENT_COLORS.green },
  { id: 'cat3', name: 'Full Grooming', color: APPOINTMENT_COLORS.pink },
  { id: 'cat4', name: 'Nail Trim', color: APPOINTMENT_COLORS.yellow },
  { id: 'cat5', name: 'Special Services', color: APPOINTMENT_COLORS.red },
];
