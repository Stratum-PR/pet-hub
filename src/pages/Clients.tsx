import { useState, useMemo, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/ClientForm';
import { ClientList } from '@/components/ClientList';
import { SearchFilter } from '@/components/SearchFilter';
import { Client, Pet } from '@/types';
import { t } from '@/lib/translations';
import { toast } from 'sonner';

interface ClientsProps {
  clients: Client[];
  pets: Pet[];
  onAddClient: (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => Promise<Client | null>;
  onUpdateClient: (id: string, client: Partial<Client>) => Promise<Client | null>;
  onDeleteClient: (id: string) => Promise<boolean>;
  onUpdatePet?: (id: string, pet: Partial<Pet>) => Promise<Pet | null>;
}

export function Clients({ clients, pets, onAddClient, onUpdateClient, onDeleteClient, onUpdatePet }: ClientsProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Handle both state and URL parameter for backward compatibility
  useEffect(() => {
    const state = location.state as { selectedClientId?: string } | null;
    if (state?.selectedClientId) {
      setSelectedClientId(state.selectedClientId);
    } else if (highlightId) {
      setSelectedClientId(highlightId);
    }
  }, [location, highlightId]);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(client =>
      `${client.first_name} ${client.last_name}`.toLowerCase().includes(term) ||
      client.email.toLowerCase().includes(term) ||
      client.phone.includes(term)
    );
  }, [clients, searchTerm]);

  const handleSubmit = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> => {
    if (editingClient) {
      const result = await onUpdateClient(editingClient.id, clientData);
      if (result) {
        toast.success(t('clients.updateSuccess'));
        setEditingClient(null);
        setShowForm(false);
        return true;
      } else {
        toast.error(t('clients.saveError'));
      }
      return false;
    }

    const result = await onAddClient(clientData);
    if (result) {
      toast.success(t('clients.saveSuccess'));
      setShowForm(false);
      return true;
    } else {
      toast.error(t('clients.saveError'));
    }
    return false;
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowForm(true);
    // Scroll to form after a brief delay to ensure it's rendered
    setTimeout(() => {
      const formElement = document.getElementById('client-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingClient(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('clients.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('clients.description')}
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
          {showForm ? t('common.cancel') : t('clients.addClient')}
        </Button>
      </div>

      {showForm && (
        <ClientForm 
          onSubmit={handleSubmit} 
          onCancel={handleCancel}
          initialData={editingClient}
          isEditing={!!editingClient}
          pets={pets}
          onUpdatePet={onUpdatePet}
        />
      )}

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder={t('clients.searchPlaceholder')}
      />

      <ClientList 
        clients={filteredClients} 
        pets={pets} 
        onDelete={onDeleteClient}
        onEdit={handleEdit}
        selectedClientId={selectedClientId}
      />
    </div>
  );
}