import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Clients } from '@/pages/Clients';
import { Pets } from '@/pages/Pets';
import { Employees } from '@/pages/Employees';
import { Reports } from '@/pages/Reports';
import { Admin } from '@/pages/Admin';
import { useClients, usePets, useEmployees, useTimeEntries, useAppointments } from '@/hooks/useSupabaseData';

const Index = () => {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { pets, addPet, updatePet, deletePet } = usePets();
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { timeEntries, clockIn, clockOut, getActiveEntry } = useTimeEntries();
  const { appointments } = useAppointments();

  return (
    <Layout>
      <Routes>
        <Route 
          path="/" 
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
          path="/clients"
          element={
            <Clients
              clients={clients}
              pets={pets}
              onAddClient={addClient}
              onUpdateClient={updateClient}
              onDeleteClient={deleteClient}
            />
          }
        />
        <Route
          path="/pets"
          element={
            <Pets
              clients={clients}
              pets={pets}
              onAddPet={addPet}
              onUpdatePet={updatePet}
              onDeletePet={deletePet}
            />
          }
        />
        <Route
          path="/employees"
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
          path="/reports"
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
          path="/admin"
          element={
            <Admin
              employees={employees}
              timeEntries={timeEntries}
              onAddEmployee={addEmployee}
              onUpdateEmployee={updateEmployee}
              onDeleteEmployee={deleteEmployee}
            />
          }
        />
      </Routes>
    </Layout>
  );
};

export default Index;