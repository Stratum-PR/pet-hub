import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/ClientForm';
import { ClientList } from '@/components/ClientList';
import { Client, Pet } from '@/types';

interface ClientsProps {
  clients: Client[];
  pets: Pet[];
  onAddClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
  onDeleteClient: (id: string) => void;
}

export function Clients({ clients, pets, onAddClient, onDeleteClient }: ClientsProps) {
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (client: Omit<Client, 'id' | 'createdAt'>) => {
    onAddClient(client);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">
            Manage your grooming clients and their information
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="shadow-xs hover:shadow-sm transition-shadow flex items-center gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Client'}
        </Button>
      </div>

      {showForm && (
        <ClientForm onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
      )}

      <ClientList clients={clients} pets={pets} onDelete={onDeleteClient} />
    </div>
  );
}
