import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/ClientForm';
import { ClientList } from '@/components/ClientList';
import { SearchFilter } from '@/components/SearchFilter';
import { Client, Pet } from '@/types';

interface ClientsProps {
  clients: Client[];
  pets: Pet[];
  onAddClient: (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateClient: (id: string, client: Partial<Client>) => void;
  onDeleteClient: (id: string) => void;
}

export function Clients({ clients, pets, onAddClient, onUpdateClient, onDeleteClient }: ClientsProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(client =>
      client.name.toLowerCase().includes(term) ||
      client.email.toLowerCase().includes(term) ||
      client.phone.includes(term)
    );
  }, [clients, searchTerm]);

  const handleSubmit = (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingClient) {
      onUpdateClient(editingClient.id, clientData);
      setEditingClient(null);
    } else {
      onAddClient(clientData);
    }
    setShowForm(false);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingClient(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">
            Manage your grooming clients and their information
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingClient(null);
            setShowForm(!showForm);
          }}
          className="shadow-sm flex items-center gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Client'}
        </Button>
      </div>

      {showForm && (
        <ClientForm 
          onSubmit={handleSubmit} 
          onCancel={handleCancel}
          initialData={editingClient}
          isEditing={!!editingClient}
        />
      )}

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search clients by name, email, or phone..."
      />

      <ClientList 
        clients={filteredClients} 
        pets={pets} 
        onDelete={onDeleteClient}
        onEdit={handleEdit}
      />
    </div>
  );
}