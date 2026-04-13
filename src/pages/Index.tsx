import { Routes, Route, Navigate, useNavigate, useParams, useLocation, useSearchParams, Outlet } from 'react-router-dom';
import { useMemo, useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageTransitionProvider, usePageTransition } from '@/contexts/PageTransitionContext';
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
import { TimeKiosk } from '@/pages/TimeKiosk';
import { Reports } from '@/pages/Reports';
import { Payroll } from '@/pages/Payroll';
import { EmployeePayroll } from '@/pages/EmployeePayroll';
import { EmployeeTimesheet } from '@/pages/EmployeeTimesheet';
import { TimeEditApproval } from '@/components/TimeEditApproval';
import { ShiftChangeApproval } from '@/components/ShiftChangeApproval';
import { Services } from '@/pages/Services';
import { Checkout } from '@/pages/Checkout';
import { Payment } from '@/pages/Payment';
import { AppointmentBook } from '@/pages/AppointmentBook';
import { useClients, usePets, useEmployees, useTimeEntries, useAppointments, useSettings, useServices } from '@/hooks/useSupabaseData';
import { useInventory } from '@/hooks/useInventory';
import { useNotifications } from '@/hooks/useNotifications';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureRollout } from '@/hooks/useFeatureRollout';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { useCanonicalSlugRedirect } from '@/hooks/useCanonicalSlugRedirect';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { AccountSettings } from '@/pages/AccountSettings';
import { BusinessSettingsPage } from '@/pages/BusinessSettingsPage';
import { BookingSettings } from '@/pages/BookingSettings';
import { Billing } from '@/pages/Billing';
import { Help } from '@/pages/Help';
import { Notifications } from '@/pages/Notifications';
import { Transactions } from '@/pages/Transactions';
import { TransactionCreate } from '@/pages/TransactionCreate';
import { TransactionDetail } from '@/pages/TransactionDetail';
import { isKioskLocked } from '@/lib/kioskLock';
import { PawStagedLoadingFullscreen } from '@/components/PawStagedLoading';
import { PawRevealEnter } from '@/components/PawRevealEnter';

/** Old bookmarks / notifications used /employee-management; canonical URL is /staff-management. */
function RedirectLegacyEmployeeManagement() {
  const [searchParams] = useSearchParams();
  const staff = searchParams.get('staff') ?? searchParams.get('employee');
  const qs = staff ? `?staff=${encodeURIComponent(staff)}` : '';
  return <Navigate to={`staff-management${qs}`} replace />;
}

/** Short URL alias: /:slug/calendar → Appt Book calendar (feature-gated). */
function RedirectApptBookCalendarAlias() {
  const slug = useResolvedBusinessSlug();
  const prefix = slug ? `/${slug}` : '';
  return <Navigate to={`${prefix}/appt-book/calendar`} replace />;
}

/** Legacy URLs used .../payroll/employee/:id; canonical is .../payroll/staff/:id */
function RedirectLegacyPayrollEmployee() {
  const { employeeId } = useParams<{ employeeId: string; businessSlug?: string }>();
  const businessSlug = useResolvedBusinessSlug();
  const { pathname } = useLocation();
  if (!employeeId) return <Navigate to={businessSlug ? `/${businessSlug}/reports/payroll` : '/reports/payroll'} replace />;
  const isTimesheet = pathname.endsWith('/timesheet');
  const base = businessSlug ? `/${businessSlug}` : '';
  const suffix = isTimesheet ? '/timesheet' : '';
  return <Navigate to={`${base}/reports/payroll/staff/${employeeId}${suffix}`} replace />;
}

/** Renders Routes with displayPathname so old page stays visible while cover rolls down. */
function TransitionRoutes({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const ctx = usePageTransition();
  const displayPathname = ctx?.displayPathname ?? location.pathname;
  const displayLocation = useMemo(
    () => ({ ...location, pathname: displayPathname }),
    [location.pathname, location.search, location.hash, displayPathname],
  );
  return <Routes location={displayLocation}>{children}</Routes>;
}

function EmployeeHomeRedirect({
  staffId,
  employees,
  employeesLoading,
}: {
  staffId: string | null;
  employees: { id: string; status: string }[];
  employeesLoading: boolean;
}) {
  if (employeesLoading) {
    return <PawStagedLoadingFullscreen label="Loading" />;
  }
  const me = staffId ? employees.find((e) => e.id === staffId) : undefined;
  const target = me?.status === 'inactive' ? 'staff-management' : 'clients';
  return <Navigate to={target} replace />;
}

const Index = () => {
  const businessId = useBusinessId();
  const { business, role, profile } = useAuth();
  const staffId = profile?.staff_id ?? null;
  useCanonicalSlugRedirect(business);
  const navigate = useNavigate();
  const businessSlug = useResolvedBusinessSlug();

  const location = useLocation();
  const workspaceDemoReadOnly = useDemoBrowseOnly();
  const { isFeatureVisible } = useFeatureRollout();
  const accountSettingsVisible = isFeatureVisible('account_settings');
  const appointmentsVisible = isFeatureVisible('appointments');
  const appointmentBookVisible = isFeatureVisible('appointment_book');
  const inventoryVisible = isFeatureVisible('inventory');
  const paymentsVisible = isFeatureVisible('payments');
  const transactionsListVisible = isFeatureVisible('transactions_list');
  const transactionCreateVisible = isFeatureVisible('transaction_create');
  const transactionDetailVisible = isFeatureVisible('transaction_detail');
  const bookingSettingsVisible = isFeatureVisible('booking_settings');
  const routeGateSnapshot = {
    appointments: isFeatureVisible('appointments'),
    appointment_book: isFeatureVisible('appointment_book'),
    inventory: isFeatureVisible('inventory'),
    transactions_list: isFeatureVisible('transactions_list'),
    transaction_create: isFeatureVisible('transaction_create'),
    transaction_detail: isFeatureVisible('transaction_detail'),
    payments: isFeatureVisible('payments'),
    booking_settings: isFeatureVisible('booking_settings'),
    barcode_lookup: isFeatureVisible('barcode_lookup'),
  };

  // When locked, employees should only see the time kiosk (and any navigation attempt is redirected).
  const [kioskLocked, setKioskLockedState] = useState(isKioskLocked());
  const kioskFullPath = businessSlug ? `/${businessSlug}/time-kiosk` : '/time-kiosk';

  useEffect(() => {
    const sync = () => setKioskLockedState(isKioskLocked());
    sync();
    window.addEventListener('kiosklockchange', sync);
    return () => window.removeEventListener('kiosklockchange', sync);
  }, []);

  useEffect(() => {
    if (!kioskLocked) return;
    if (location.pathname !== kioskFullPath) {
      navigate(kioskFullPath, { replace: true });
    }
  }, [kioskLocked, location.pathname, kioskFullPath, navigate]);

  const { clients, loading: clientsLoading, addClient, updateClient, deleteClient } = useClients();
  const { pets, loading: petsLoading, addPet, updatePet, deletePet } = usePets();
  const {
    employees,
    loading: employeesLoading,
    error: employeesError,
    refetch: refetchEmployees,
    addEmployee,
    updateEmployee,
  } = useEmployees();
  const { timeEntries, clockIn, clockOut, getActiveEntry, updateTimeEntry, addTimeEntry } = useTimeEntries();
  const {
    appointments,
    loading: appointmentsLoading,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    refetch: refetchAppointments,
  } = useAppointments();
  const {
    products,
    stockMovements,
    loading: inventoryLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    uploadProductPhoto,
  } = useInventory();
  const { services, loading: servicesLoading, addService, updateService, deleteService } = useServices();
  const { settings, saveAllSettings, loading: settingsLoading } = useSettings();
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
          { productId: id, type: 'inventory' }
        );
      }
    }
    return result;
  };

  const dashboardDataLoading =
    clientsLoading ||
    petsLoading ||
    employeesLoading ||
    appointmentsLoading ||
    inventoryLoading;

  const updateAppointmentWithNotification = async (id: string, data: Partial<import('@/types').Appointment>) => {
    const result = await updateAppointment(id, data);
    if (result && data.status === 'completed' && businessId) {
      const updated = result as {
        transaction_id?: string | null;
        billed?: boolean;
        service_id?: string | null;
        service_type?: string | null;
      };
      if (!updated.transaction_id && !updated.billed && businessSlug) {
        const createTxn = window.confirm(
          'Appointment completed. Create a transaction for this appointment?'
        );
        if (createTxn) {
          navigate(`/${businessSlug}/transactions/new?appointmentId=${id}`);
          return result;
        }
        await createNotification(
          updated.service_type
            ? `${updated.service_type} completed but not yet billed. Consider creating a transaction.`
            : 'Appointment completed but not yet billed. Consider creating a transaction.',
          businessId,
          {
            appointmentId: id,
            serviceId: updated.service_id ?? null,
            type: updated.service_id ? 'service' : 'appointment',
          }
        );
      }
    }
    return result;
  };

  useEffect(() => {
    if (role !== 'employee' || !businessSlug || kioskLocked || settingsLoading || employeesLoading)
      return;

    const allowMobilePunch = settings.allow_employee_mobile_punch === 'true';
    const raw = location.pathname.replace(new RegExp(`^/${businessSlug}/?`), '').replace(/\/$/, '');

    const staffPrefix = staffId ? `reports/payroll/staff/${staffId}` : '';
    const me = staffId ? employees.find((e) => e.id === staffId) : undefined;
    const isInactive = me?.status === 'inactive';

    const allowedActive =
      raw === 'clients' ||
      raw === 'pets' ||
      raw === 'staff-management' ||
      raw === 'employee-schedule' ||
      (allowMobilePunch && raw === 'time-kiosk') ||
      (!!staffId && (raw === `${staffPrefix}/timesheet` || raw === staffPrefix)) ||
      raw === 'help' ||
      raw === 'notifications' ||
      (accountSettingsVisible && (raw === 'settings/account' || raw === 'settings'));

    const allowedInactive =
      raw === 'staff-management' ||
      (!!staffId && (raw === `${staffPrefix}/timesheet` || raw === staffPrefix)) ||
      raw === 'help';

    const allowed = isInactive ? allowedInactive : allowedActive;
    const fallback = isInactive ? 'staff-management' : 'clients';

    if (!allowed) {
      navigate(`/${businessSlug}/${fallback}`, { replace: true });
    }
  }, [
    role,
    businessSlug,
    kioskLocked,
    settingsLoading,
    employeesLoading,
    employees,
    location.pathname,
    settings.allow_employee_mobile_punch,
    staffId,
    accountSettingsVisible,
    navigate,
  ]);

  return (
    <Routes>
      {/* All routes for a business with layout; parent route provides :businessSlug */}
      <Route
        path="*"
        element={kioskLocked ? <TimeKiosk /> : (
        <PageTransitionProvider>
          {settingsLoading ? (
            <PawStagedLoadingFullscreen label="Loading business settings" />
          ) : (
            <PawRevealEnter className="flex h-[100svh] max-h-[100svh] min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Layout settings={settings}>
              <TransitionRoutes>
              <Route
                path=""
                element={
                  role === 'employee' ? (
                    <EmployeeHomeRedirect
                      staffId={staffId}
                      employees={employees}
                      employeesLoading={employeesLoading}
                    />
                  ) : (
                    <Navigate to="dashboard" replace />
                  )
                }
              />
            <Route
              path="dashboard"
              element={
                role === 'employee' ? (
                  <Navigate to="clients" replace />
                ) : (
                  <Dashboard
                    clients={clients}
                    pets={pets}
                    employees={employees}
                    appointments={appointments}
                    products={products}
                    defaultLowStockThreshold={defaultLow}
                    dataLoading={dashboardDataLoading}
                    onUpdateAppointment={updateAppointmentWithNotification}
                    canMarkNoShow={
                      role === 'manager' ||
                      role === 'super_admin' ||
                      !!profile?.is_super_admin
                    }
                  />
                )
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
                  onAddPet={addPet}
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
                appointmentsVisible ? (
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
                    canMarkNoShow={
                      role === 'manager' ||
                      role === 'super_admin' ||
                      !!profile?.is_super_admin
                    }
                  />
                ) : (
                  <Navigate to="dashboard" replace />
                )
              }
            />
            <Route
              path="calendar"
              element={
                appointmentBookVisible ? (
                  <RedirectApptBookCalendarAlias />
                ) : (
                  <Navigate to="dashboard" replace />
                )
              }
            />
            <Route
              path="appt-book"
              element={appointmentBookVisible ? <Outlet /> : <Navigate to="dashboard" replace />}
            >
              <Route index element={<Navigate to="calendar" replace />} />
              <Route path="calendar" element={<AppointmentBook />} />
              <Route path="appointments" element={<AppointmentBook />} />
            </Route>
            <Route
              path="inventory"
              element={
                inventoryVisible ? (
                  <Inventory
                    loading={inventoryLoading}
                    readOnly={workspaceDemoReadOnly}
                    products={products}
                    defaultLowStockThreshold={parseInt(settings.default_low_stock_threshold || '5', 10) || 5}
                    stockMovements={stockMovements}
                    onAddProduct={addProduct}
                    onUpdateProduct={updateProductWithNotification}
                    onDeleteProduct={deleteProduct}
                    onAdjustStock={adjustStock}
                    onUploadProductPhoto={uploadProductPhoto}
                  />
                ) : (
                  <Navigate to="dashboard" replace />
                )
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
            <Route path="employee-management" element={<RedirectLegacyEmployeeManagement />} />
            <Route
              path="staff-management"
              element={
                <EmployeeManagement
                  employees={employees}
                  loading={employeesLoading}
                  loadError={employeesError}
                  onRetryLoad={() => void refetchEmployees()}
                  onAddEmployee={addEmployee}
                  onUpdateEmployee={updateEmployee}
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
            <Route path="employee-schedule/change-requests" element={<ShiftChangeApproval />} />
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
              path="reports/payroll/staff/:staffId/timesheet"
              element={
                <EmployeeTimesheet
                  employees={employees}
                  timeEntries={timeEntries}
                />
              }
            />
            <Route
              path="reports/payroll/staff/:staffId"
              element={
                <EmployeePayroll
                  employees={employees}
                  timeEntries={timeEntries}
                />
              }
            />
            <Route path="reports/payroll/employee/:employeeId/timesheet" element={<RedirectLegacyPayrollEmployee />} />
            <Route path="reports/payroll/employee/:employeeId" element={<RedirectLegacyPayrollEmployee />} />
            <Route
              path="reports/payroll/edit-requests"
              element={<TimeEditApproval />}
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
              path="time-kiosk"
              element={<TimeKiosk />}
            />
            <Route
              path="services"
              element={
                <Services
                  loading={servicesLoading}
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
              element={paymentsVisible ? <Payment /> : <Navigate to="dashboard" replace />}
            />
            <Route
              path="transactions"
              element={transactionsListVisible ? <Transactions /> : <Navigate to="dashboard" replace />}
            />
            <Route
              path="transactions/new"
              element={transactionCreateVisible ? <TransactionCreate /> : <Navigate to="../dashboard" replace />}
            />
            <Route
              path="transactions/:transactionId"
              element={transactionDetailVisible ? <TransactionDetail /> : <Navigate to="../dashboard" replace />}
            />
            <Route path="settings" element={<SettingsLayout />}>
              <Route
                index
                element={
                  <Navigate
                    to={
                      role === 'employee'
                        ? accountSettingsVisible
                          ? 'account'
                          : '../clients'
                        : accountSettingsVisible
                          ? 'account'
                          : 'business'
                    }
                    replace
                  />
                }
              />
              <Route
                path="account"
                element={
                  accountSettingsVisible ? (
                    <AccountSettings settings={settings} onSaveSettings={saveAllSettings} />
                  ) : role === 'employee' ? (
                    <Navigate to="../clients" replace />
                  ) : (
                    <Navigate to="../business" replace />
                  )
                }
              />
              <Route
                path="business"
                element={role === 'employee' ? <Navigate to="../clients" replace /> : <BusinessSettingsPage />}
              />
              <Route
                path="booking"
                element={
                  role === 'employee' ? (
                    <Navigate to="../clients" replace />
                  ) : bookingSettingsVisible ? (
                    <BookingSettings />
                  ) : (
                    <Navigate to="../business" replace />
                  )
                }
              />
              <Route
                path="billing"
                element={role === 'employee' ? <Navigate to="../clients" replace /> : <Billing />}
              />
            </Route>
            <Route path="help" element={<Help />} />
            <Route path="notifications" element={<Notifications />} />
              </TransitionRoutes>
            </Layout>
            </PawRevealEnter>
          )}
        </PageTransitionProvider>
      )} />
      {/* Public booking page - no layout, kept global (not tied to a business slug) */}
      <Route path="/book-appointment" element={<BookAppointment />} />
    </Routes>
  );
};

export default Index;
