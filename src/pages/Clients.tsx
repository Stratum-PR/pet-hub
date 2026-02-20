import { useState, useMemo, useEffect } from 'react';
import { useLocation, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Plus, X, LayoutGrid, List, Dog, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/ClientForm';
import { ClientList } from '@/components/ClientList';
import { SearchFilter } from '@/components/SearchFilter';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Client, Pet } from '@/types';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { usePageLoadRef } from '@/hooks/usePageLoad';
import { useTransactions } from '@/hooks/useTransactions';
import { format } from 'date-fns';

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
  const CLIENT_VIEW_KEY = 'pet-hub-clients-view';
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window === 'undefined') return 'cards';
    return window.localStorage.getItem(CLIENT_VIEW_KEY) === 'list' ? 'list' : 'cards';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CLIENT_VIEW_KEY, viewMode);
  }, [viewMode]);

  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const navigate = useNavigate();
  const [clientDetailOpen, setClientDetailOpen] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const pageLoadRef = usePageLoadRef();
  const { transactions } = useTransactions();

  const handleDeleteClick = (id: string) => {
    setClientToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (clientToDelete) {
      onDeleteClient(clientToDelete);
      setClientToDelete(null);
      setClientDetailOpen(null);
    }
    setDeleteDialogOpen(false);
  };

  const getClientPets = (clientId: string) => pets.filter((p: Pet) => p.client_id === clientId);

  const openPetInPetsPage = (pet: Pet, clientId: string) => {
    setClientDetailOpen(null);
    const q = new URLSearchParams({ highlight: pet.id, fromClient: clientId });
    if (businessSlug) navigate(`/${businessSlug}/pets?${q.toString()}`);
    else navigate(`/pets?${q.toString()}`);
  };

  // Handle both state and URL parameter for backward compatibility
  useEffect(() => {
    const state = location.state as { selectedClientId?: string } | null;
    if (state?.selectedClientId) {
      setSelectedClientId(state.selectedClientId);
    } else if (highlightId) {
      setSelectedClientId(highlightId);
    }
  }, [location, highlightId]);

  // Scroll to and highlight client when navigated from pets page (?highlight=clientId)
  useEffect(() => {
    if (!highlightId) return;
    let highlightClear: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      const el = document.getElementById(`client-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        highlightClear = setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 3000);
      }
    }, viewMode === 'list' ? 150 : 300);
    return () => {
      clearTimeout(timer);
      if (highlightClear) clearTimeout(highlightClear);
    };
  }, [viewMode, highlightId]);

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
    <div ref={pageLoadRef} className="space-y-6 animate-fade-in" data-transition-root>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap" data-page-toolbar data-page-search>
        <SearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder={t('clients.searchPlaceholder')}
        />
        <div className="inline-flex rounded-xl border border-input bg-background/80 backdrop-blur-sm p-0.5">
          <button
            type="button"
            className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
              viewMode === 'cards' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
            onClick={() => setViewMode('cards')}
            aria-label="Card view"
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
              viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List className="w-4 h-4 shrink-0" />
          </button>
        </div>
        <Button
          onClick={() => {
            setEditingClient(null);
            setShowForm(!showForm);
          }}
          className="shadow-sm flex items-center gap-2 shrink-0"
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

      {filteredClients.length === 0 ? (
        <div data-page-content>
          <ClientList
            clients={[]}
            pets={pets}
            onDelete={onDeleteClient}
            onEdit={handleEdit}
            selectedClientId={selectedClientId}
          />
        </div>
      ) : viewMode === 'cards' ? (
        <div data-page-content>
          <ClientList
            clients={filteredClients}
            pets={pets}
            onViewClient={setClientDetailOpen}
            onDelete={onDeleteClient}
            onEdit={handleEdit}
            selectedClientId={selectedClientId}
          />
        </div>
      ) : (
        <div data-page-content>
          <div className="overflow-x-auto rounded-lg border-0 bg-card" data-table-load>
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{t('clients.listName')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('clients.listEmail')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('clients.listPhone')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('clients.listPets')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const clientPets = getClientPets(client.id);
                  return (
                    <tr
                      key={client.id}
                      id={`client-${client.id}`}
                      role="button"
                      tabIndex={0}
                      className={`border-t hover:bg-muted/40 cursor-pointer ${selectedClientId === client.id ? 'bg-primary/5' : ''}`}
                      onClick={() => setClientDetailOpen(client)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setClientDetailOpen(client); } }}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="font-medium text-left hover:underline"
                          onClick={(e) => { e.stopPropagation(); setClientDetailOpen(client); }}
                        >
                          {client.first_name} {client.last_name}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{(client as any).email || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{(client as any).phone || '—'}</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          {clientPets.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            clientPets.map((pet) => (
                              <button
                                key={pet.id}
                                type="button"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
                                onClick={() => openPetInPetsPage(pet, client.id)}
                              >
                                <Dog className="w-3 h-3" />
                                {pet.name}
                              </button>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Client detail popup (shared for list and cards) */}
      <Dialog open={!!clientDetailOpen} onOpenChange={(open) => !open && setClientDetailOpen(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {clientDetailOpen && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {clientDetailOpen.first_name} {clientDetailOpen.last_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                {(clientDetailOpen as any).email && (
                  <p><span className="text-muted-foreground">Email:</span> {(clientDetailOpen as any).email}</p>
                )}
                {(clientDetailOpen as any).phone && (
                  <p><span className="text-muted-foreground">Phone:</span> {(clientDetailOpen as any).phone}</p>
                )}
                {[(clientDetailOpen as any).address, (clientDetailOpen as any).city, (clientDetailOpen as any).state].filter(Boolean).length > 0 && (
                  <p><span className="text-muted-foreground">Address:</span>{' '}
                    {[(clientDetailOpen as any).address, (clientDetailOpen as any).city, (clientDetailOpen as any).state, (clientDetailOpen as any).zip_code].filter(Boolean).join(', ')}
                  </p>
                )}
                {(clientDetailOpen as any).notes && (
                  <p><span className="text-muted-foreground">Notes:</span> {(clientDetailOpen as any).notes}</p>
                )}
                <div className="pt-2">
                  <span className="text-muted-foreground font-medium">Pets:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {getClientPets(clientDetailOpen.id).length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      getClientPets(clientDetailOpen.id).map((pet) => (
                        <button
                          key={pet.id}
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-sm hover:bg-primary/20"
                          onClick={() => openPetInPetsPage(pet, clientDetailOpen.id)}
                        >
                          <Dog className="w-3.5 h-3.5" />
                          {pet.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                {/* Transaction history for this client */}
                <div className="pt-3 border-t border-border">
                  <h4 className="font-medium text-foreground mb-2">Transaction history</h4>
                  {(() => {
                    const clientTxns = (transactions ?? []).filter(
                      (txn: any) => txn.customer_id === clientDetailOpen.id
                    ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    if (clientTxns.length === 0) {
                      return <p className="text-muted-foreground">No transactions yet.</p>;
                    }
                    return (
                      <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                        {clientTxns.map((txn: any) => {
                          const totalDollars = (Number(txn.total) / 100).toFixed(2);
                          const displayId = txn.transaction_number != null
                            ? `TXN-${String(txn.transaction_number).padStart(5, '0')}`
                            : txn.id.slice(0, 8);
                          return (
                            <li key={txn.id}>
                              <button
                                type="button"
                                className="flex justify-between items-center w-full text-left py-1 px-2 rounded hover:bg-muted/60"
                                onClick={() => {
                                  setClientDetailOpen(null);
                                  if (businessSlug) navigate(`/${businessSlug}/transactions/${txn.id}`);
                                  else navigate(`/transactions/${txn.id}`);
                                }}
                              >
                                <span className="font-mono text-xs">{displayId}</span>
                                <span>{format(new Date(txn.created_at), 'MMM d, yyyy')}</span>
                                <span className="font-medium">${totalDollars}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { handleEdit(clientDetailOpen); setClientDetailOpen(null); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { handleDeleteClick(clientDetailOpen.id); setClientDetailOpen(null); }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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