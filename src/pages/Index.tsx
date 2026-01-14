import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Clients } from '@/pages/Clients';
import { Pets } from '@/pages/Pets';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Client, Pet } from '@/types';

const Index = () => {
  const [clients, setClients] = useLocalStorage<Client[]>('pawcare-clients', []);
  const [pets, setPets] = useLocalStorage<Pet[]>('pawcare-pets', []);

  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient: Client = {
      ...clientData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setClients([...clients, newClient]);
  };

  const deleteClient = (id: string) => {
    setClients(clients.filter((c) => c.id !== id));
    setPets(pets.filter((p) => p.clientId !== id));
  };

  const addPet = (petData: Omit<Pet, 'id' | 'createdAt'>) => {
    const newPet: Pet = {
      ...petData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setPets([...pets, newPet]);
  };

  const deletePet = (id: string) => {
    setPets(pets.filter((p) => p.id !== id));
  };

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard clients={clients} pets={pets} />} />
        <Route
          path="/clients"
          element={
            <Clients
              clients={clients}
              pets={pets}
              onAddClient={addClient}
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
              onDeletePet={deletePet}
            />
          }
        />
      </Routes>
    </Layout>
  );
};

export default Index;
