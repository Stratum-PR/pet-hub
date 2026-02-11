import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Clients } from '@/pages/Clients';
import { Pets } from '@/pages/Pets';
import { Appointments } from '@/pages/Appointments';
import { Inventory } from '@/pages/Inventory';
import { BookAppointment } from '@/pages/BookAppointment';
import { Employees } from '@/pages/Employees';
import { EmployeeManagement } from '@/pages/EmployeeManagement';
import { EmployeeSchedule } from '@/pages/EmployeeSchedule';
import { Reports } from '@/pages/Reports';
import { Payroll } from '@/pages/Payroll';
import { EmployeePayroll } from '@/pages/EmployeePayroll';
import { EmployeeTimesheet } from '@/pages/EmployeeTimesheet';
import { Services } from '@/pages/Services';
import { Personalization } from '@/pages/Personalization';
import { Checkout } from '@/pages/Checkout';
import { Payment } from '@/pages/Payment';
import { AppointmentBook } from '@/pages/AppointmentBook';
import { useClients, usePets, useEmployees, useTimeEntries, useAppointments, useSettings, useServices } from '@/hooks/useSupabaseData';
import { useInventory } from '@/hooks/useInventory';
import { DataDiagnostics } from '@/components/DataDiagnostics';

const Index = () => {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { pets, addPet, updatePet, deletePet } = usePets();
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { timeEntries, clockIn, clockOut, getActiveEntry, updateTimeEntry, addTimeEntry } = useTimeEntries();
  const { appointments, addAppointment, updateAppointment, deleteAppointment, refetch: refetchAppointments } = useAppointments();
  const { products, addProduct, updateProduct, deleteProduct } = useInventory();
  const { services, addService, updateService, deleteService } = useServices();
  const { settings, saveAllSettings } = useSettings();

  return (
    <Routes>
      {/* All routes for a business with layout; parent route provides :businessSlug */}
      <Route
        path="*"
        element={
        <Layout settings={settings}>
          <Routes>
            {/* Default dashboard */}
            <Route
              path=""
              element={<Navigate to="dashboard" replace />}
            />
            <Route
              path="dashboard"
              element={
                <Dashboard
                  clients={clients}
                  pets={pets}
                  employees={employees}
                  appointments={appointments}
                />
              }
            />
            <Route
              path="clients"
              element={
                <Clients
                  clients={clients}
                  pets={pets}
                  onAddClient={addClient}
                  onUpdateClient={updateClient}
                  onDeleteClient={deleteClient}
                  onUpdatePet={updatePet}
                />
              }
            />
            <Route
              path="pets"
              element={
                <Pets
                  clients={clients}
                  pets={pets}
                  appointments={appointments}
                  onAddPet={addPet}
                  onUpdatePet={updatePet}
                  onDeletePet={deletePet}
                />
              }
            />
            <Route
              path="appointments"
              element={
                <Appointments
                  appointments={appointments}
                  pets={pets}
                  clients={clients}
                  employees={employees}
                  services={services}
                  onAddAppointment={addAppointment}
                  onUpdateAppointment={updateAppointment}
                  onDeleteAppointment={deleteAppointment}
                  onRefreshAppointments={refetchAppointments}
                />
              }
            />
            <Route
              path="appt-book"
              element={<AppointmentBook />}
            />
            <Route
              path="inventory"
              element={
                <Inventory
                  products={products}
                  onAddProduct={addProduct}
                  onUpdateProduct={updateProduct}
                  onDeleteProduct={deleteProduct}
                />
              }
            />
            <Route
              path="time-tracking"
              element={
                <Employees
                  employees={employees}
                  timeEntries={timeEntries}
                  onClockIn={clockIn}
                  onClockOut={clockOut}
                  getActiveEntry={getActiveEntry}
                />
              }
            />
            <Route
              path="employee-management"
              element={
                <EmployeeManagement
                  employees={employees}
                  onAddEmployee={addEmployee}
                  onUpdateEmployee={updateEmployee}
                  onDeleteEmployee={deleteEmployee}
                />
              }
            />
            <Route
              path="employee-schedule"
              element={
                <EmployeeSchedule
                  employees={employees}
                  timeEntries={timeEntries}
                />
              }
            />
            <Route
              path="reports/analytics"
              element={
                <Reports
                  clients={clients}
                  pets={pets}
                  employees={employees}
                  timeEntries={timeEntries}
                  appointments={appointments}
                />
              }
            />
            <Route
              path="reports/payroll"
              element={
                <Payroll
                  employees={employees}
                  timeEntries={timeEntries}
                  onUpdateTimeEntry={updateTimeEntry}
                  onAddTimeEntry={addTimeEntry}
                />
              }
            />
            <Route
              path="reports/payroll/employee/:employeeId"
              element={
                <EmployeePayroll
                  employees={employees}
                  timeEntries={timeEntries}
                />
              }
            />
            <Route
              path="reports/payroll/employee/:employeeId/timesheet"
              element={
                <EmployeeTimesheet
                  employees={employees}
                  timeEntries={timeEntries}
                />
              }
            />
            <Route
              path="reports"
              element={
                <Reports
                  clients={clients}
                  pets={pets}
                  employees={employees}
                  timeEntries={timeEntries}
                  appointments={appointments}
                />
              }
            />
            <Route
              path="services"
              element={
                <Services
                  services={services}
                  onAddService={addService}
                  onUpdateService={updateService}
                  onDeleteService={deleteService}
                />
              }
            />
            <Route
              path="personalization"
              element={
                <Personalization
                  settings={settings}
                  onSaveSettings={saveAllSettings}
                />
              }
            />
            <Route
              path="checkout"
              element={
                <Checkout
                  appointments={appointments}
                  clients={clients}
                  pets={pets}
                  services={services}
                  onUpdateAppointment={updateAppointment}
                />
              }
            />
            <Route
              path="payment"
              element={<Payment />}
            />
          </Routes>
        </Layout>
      } />
      {/* Public booking page - no layout, kept global (not tied to a business slug) */}
      <Route path="/book-appointment" element={<BookAppointment />} />
    </Routes>
  );
};

export default Index;
