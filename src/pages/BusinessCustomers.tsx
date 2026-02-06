import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Edit, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useClients, BusinessClient } from '@/hooks/useBusinessData';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { CustomerForm } from '@/components/CustomerForm';
import { SearchFilter } from '@/components/SearchFilter';
import { t } from '@/lib/translations';
import { toast } from 'sonner';

export function BusinessCustomers() {
  const { clients, loading, addClient, updateClient, deleteClient } = useClients();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<BusinessClient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  // Handle highlight from URL parameter
  useEffect(() => {
    if (highlightId) {
      const element = document.getElementById(`client-${highlightId}`);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 3000);
        }, 100);
      }
    }
  }, [highlightId]);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const search = searchTerm.toLowerCase();
    return clients.filter(client =>
      client.first_name.toLowerCase().includes(search) ||
      client.last_name.toLowerCase().includes(search) ||
      client.email?.toLowerCase().includes(search) ||
      client.phone.toLowerCase().includes(search)
    );
  }, [clients, searchTerm]);

  const handleEdit = (client: BusinessClient) => {
    setEditingClient(client);
    setShowForm(true);
    setTimeout(() => {
      const formElement = document.getElementById('client-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleDeleteClick = (id: string) => {
    setClientToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (clientToDelete) {
      deleteClient(clientToDelete);
      setClientToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleSubmit = async (clientData: Omit<BusinessClient, 'id' | 'created_at' | 'updated_at' | 'business_id'>) => {
    if (editingClient) {
      const result = await updateClient(editingClient.id, clientData);
      if (result) {
        toast.success(t('clients.updateSuccess'));
        setShowForm(false);
        setEditingClient(null);
      } else {
        toast.error(t('clients.saveError'));
      }
    } else {
      const result = await addClient(clientData as Omit<BusinessClient, 'id' | 'created_at' | 'updated_at'>);
      if (result) {
        toast.success(t('clients.saveSuccess'));
        setShowForm(false);
        setEditingClient(null);
      } else {
        toast.error(t('clients.saveError'));
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingClient(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
        <div id="client-form">
          <CustomerForm
            initialData={editingClient}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEditing={!!editingClient}
          />
        </div>
      )}

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder={t('clients.searchPlaceholder')}
      />

      {filteredClients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              {searchTerm ? t('clients.noResults') : t('clients.noCustomers')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const isHighlighted = highlightId === client.id;
            return (
            <Card 
              key={client.id} 
              id={`client-${client.id}`}
              className={`shadow-sm hover:shadow-md transition-shadow ${isHighlighted ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {client.first_name} {client.last_name}
                    </h3>
                    {client.email && (
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(client)}
                      className="h-8 w-8"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(client.id)}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {(client.address || client.city || client.state) && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {[client.address, client.city, client.state, client.zip_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {client.notes && (
                  <p className="text-sm text-muted-foreground mt-2 border-t pt-2">
                    {client.notes}
                  </p>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={t('clients.deleteClientTitle')}
        description={t('clients.deleteClientDescription')}
      />
    </div>
  );
}
