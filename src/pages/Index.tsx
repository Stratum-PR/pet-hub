import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SettingsLayout } from '@/components/SettingsLayout';
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
import { Checkout } from '@/pages/Checkout';
import { Payment } from '@/pages/Payment';
import { AppointmentBook } from '@/pages/AppointmentBook';
import { useClients, usePets, useEmployees, useTimeEntries, useAppointments, useSettings, useServices } from '@/hooks/useSupabaseData';
import { useInventory } from '@/hooks/useInventory';
import { useNotifications } from '@/hooks/useNotifications';
import { useBusinessId } from '@/hooks/useBusinessId';
import { DataDiagnostics } from '@/components/DataDiagnostics';
import { AccountSettings } from '@/pages/AccountSettings';
import { BusinessSettingsPage } from '@/pages/BusinessSettingsPage';
import { BookingSettings } from '@/pages/BookingSettings';
import { Billing } from '@/pages/Billing';
import { Help } from '@/pages/Help';
import { Transactions } from '@/pages/Transactions';
import { TransactionCreate } from '@/pages/TransactionCreate';
import { TransactionDetail } from '@/pages/TransactionDetail';

const Index = () => {
  const businessId = useBusinessId();
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { pets, addPet, updatePet, deletePet } = usePets();
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { timeEntries, clockIn, clockOut, getActiveEntry, updateTimeEntry, addTimeEntry } = useTimeEntries();
  const { appointments, addAppointment, updateAppointment, deleteAppointment, refetch: refetchAppointments } = useAppointments();
  const { products, stockMovements, addProduct, updateProduct, deleteProduct, uploadProductPhoto } = useInventory();
  const { services, addService, updateService, deleteService } = useServices();
  const { settings, saveAllSettings } = useSettings();
  const { createNotification } = useNotifications();

  const defaultLow = parseInt(settings.default_low_stock_threshold || '5', 10) || 5;
  const updateProductWithNotification = async (id: string, data: Partial<import('@/types/inventory').Product>) => {
    const result = await updateProduct(id, data);
    if (result && data.quantity !== undefined && businessId) {
      const product = products.find((p) => p.id === id);
      const threshold = product?.reorder_level ?? defaultLow;
      if (data.quantity <= threshold) {
        await createNotification(
          `Low stock: ${product?.name ?? 'Product'} (${data.quantity} left). Order soon.`,
          businessId,
          id
        );
      }
    }
    return result;
  };

  const updateAppointmentWithNotification = async (id: string, data: Partial<import('@/types').Appointment>) => {
    const result = await updateAppointment(id, data);
    if (result && data.status === 'completed' && businessId) {
      const updated = result as { transaction_id?: string | null; billed?: boolean };
      if (!updated.transaction_id && !updated.billed && businessSlug) {
        const createTxn = window.confirm(
          'Appointment completed. Create a transaction for this appointment?'
        );
        if (createTxn) {
          navigate(`/${businessSlug}/transactions/new?appointmentId=${id}`);
          return result;
        }
        await createNotification(
          'Appointment completed but not yet billed. Consider creating a transaction.',
          businessId
        );
      }
    }
    return result;
  };

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
                  onUpdateAppointment={updateAppointmentWithNotification}
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
                  defaultLowStockThreshold={parseInt(settings.default_low_stock_threshold || '5', 10) || 5}
                  stockMovements={stockMovements}
                  onAddProduct={addProduct}
                  onUpdateProduct={updateProductWithNotification}
                  onDeleteProduct={deleteProduct}
                  onUploadProductPhoto={uploadProductPhoto}
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
              path="checkout"
              element={
                <Checkout
                  appointments={appointments}
                  clients={clients}
                  pets={pets}
                  services={services}
                  onUpdateAppointment={updateAppointmentWithNotification}
                />
              }
            />
            <Route
              path="payment"
              element={<Payment />}
            />
            <Route path="transactions" element={<Transactions />} />
            <Route path="transactions/new" element={<TransactionCreate />} />
            <Route path="transactions/:transactionId" element={<TransactionDetail />} />
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="account" replace />} />
              <Route path="account" element={<AccountSettings settings={settings} onSaveSettings={saveAllSettings} />} />
              <Route path="business" element={<BusinessSettingsPage />} />
              <Route path="booking" element={<BookingSettings />} />
              <Route path="billing" element={<Billing />} />
            </Route>
            <Route path="help" element={<Help />} />
          </Routes>
        </Layout>
      } />
      {/* Public booking page - no layout, kept global (not tied to a business slug) */}
      <Route path="/book-appointment" element={<BookAppointment />} />
    </Routes>
  );
};

export default Index;
