import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Transaction, TransactionLineItem } from '@/types/transactions';
import { useLocation, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Plus, X, LayoutGrid, List, Dog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetForm } from '@/components/PetForm';
import { ClientForm } from '@/components/ClientForm';
import { ClientList } from '@/components/ClientList';
import { SearchFilter } from '@/components/SearchFilter';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { ClientProfileDialog, type ClientProfileSavePayload } from '@/components/ClientProfileDialog';
import { Client, Pet, Appointment } from '@/types';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { usePageLoadRef } from '@/hooks/usePageLoad';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useTransactions, resolveDemoLocalTransactionEntries } from '@/hooks/useTransactions';
import { formatPhoneNumberDisplay } from '@/lib/phoneFormat';
import { useMinWidthSm } from '@/hooks/useMinWidthSm';

interface ClientsProps {
  clients: Client[];
  pets: Pet[];
  appointments: Appointment[];
  onAddClient: (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => Promise<Client | null>;
  onUpdateClient: (id: string, client: Partial<Client>) => Promise<Client | null>;
  onDeleteClient: (id: string) => Promise<boolean>;
  onAddPet: (pet: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => Promise<Pet | null>;
  onUpdatePet?: (id: string, pet: Partial<Pet>) => Promise<Pet | null>;
}

export function Clients({
  clients,
  pets,
  appointments,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onAddPet,
  onUpdatePet,
}: ClientsProps) {
  useLanguage(); // re-render when locale changes so t() placeholders update
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
  const isWide = useMinWidthSm();
  const displayViewMode = isWide ? viewMode : 'cards';
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CLIENT_VIEW_KEY, viewMode);
  }, [viewMode]);

  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const navigate = useNavigate();
  const [clientDetailOpen, setClientDetailOpen] = useState<Client | null>(null);
  const [showPetForm, setShowPetForm] = useState(false);
  const [petFormDefaultClientId, setPetFormDefaultClientId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const pageLoadRef = usePageLoadRef();
  const { user } = useAuth();
  const businessId = useBusinessId();
  const { transactions } = useTransactions();

  const transactionNavigateState = useCallback(
    (txn: Transaction): { transaction: Transaction; lineItems?: TransactionLineItem[] } => {
      if (businessId && txn.id.startsWith('local-')) {
        const entries = resolveDemoLocalTransactionEntries(businessId, user?.id);
        const entry = entries.find((e) => e.transaction.id === txn.id);
        if (entry) {
          return { transaction: entry.transaction, lineItems: entry.lineItems };
        }
      }
      return { transaction: txn };
    },
    [businessId, user?.id],
  );

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

  const handleSubmit = async (
    clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'> & { staff_notes_business?: string | null },
  ): Promise<boolean> => {
    const { staff_notes_business: _sn, ...rest } = clientData;
    void _sn;
    if (editingClient) {
      const result = await onUpdateClient(editingClient.id, rest);
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

    const result = await onAddClient(rest);
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

  const beginAddPetForClient = (client: Client) => {
    setShowForm(false);
    setEditingClient(null);
    setClientDetailOpen(null);
    setPetFormDefaultClientId(client.id);
    setShowPetForm(true);
    setTimeout(() => {
      document.getElementById('pet-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handlePetFormSubmit = async (petData: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => {
    const result = await onAddPet(petData);
    if (result) {
      toast.success(t('pets.saveSuccess'));
      setShowPetForm(false);
      setPetFormDefaultClientId(null);
    } else {
      toast.error(t('pets.saveError'));
    }
  };

  const handlePetFormCancel = () => {
    setShowPetForm(false);
    setPetFormDefaultClientId(null);
  };

  return (
    <div ref={pageLoadRef} className="space-y-6 animate-fade-in" data-transition-root>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap" data-page-toolbar data-page-search>
        <SearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder={t('clients.searchPlaceholder')}
        />
        <div className="hidden sm:inline-flex rounded-xl border border-border/50 bg-white/50 p-0.5 backdrop-blur-sm dark:bg-background/40">
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
            setShowPetForm(false);
            setPetFormDefaultClientId(null);
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
        />
      )}

      {showPetForm && clients.length > 0 && (
        <PetForm
          clients={clients as any}
          onSubmit={handlePetFormSubmit}
          onCancel={handlePetFormCancel}
          initialData={null}
          isEditing={false}
          defaultClientId={petFormDefaultClientId}
        />
      )}

      {filteredClients.length === 0 ? (
        <div data-page-content>
          <ClientList
            clients={[]}
            pets={pets}
            onDelete={onDeleteClient}
            onEdit={handleEdit}
            onAddPetForClient={beginAddPetForClient}
            selectedClientId={selectedClientId}
          />
        </div>
      ) : displayViewMode === 'cards' ? (
        <div data-page-content>
          <ClientList
            clients={filteredClients}
            pets={pets}
            onViewClient={setClientDetailOpen}
            onDelete={onDeleteClient}
            onEdit={handleEdit}
            onAddPetForClient={beginAddPetForClient}
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
                      <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatPhoneNumberDisplay((client as any).phone)}
                      </td>
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
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-border text-xs font-medium hover:bg-muted/60"
                            onClick={() => beginAddPetForClient(client)}
                            aria-label={t('clients.addPetForClient')}
                          >
                            <Plus className="w-3 h-3" />
                            <Dog className="w-3 h-3" />
                          </button>
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

      <ClientProfileDialog
        open={!!clientDetailOpen}
        client={clientDetailOpen}
        pets={pets}
        appointments={appointments}
        transactions={transactions ?? []}
        onOpenChange={(open) => {
          if (!open) setClientDetailOpen(null);
        }}
        onSaveClientProfile={async (data: ClientProfileSavePayload) => {
          if (!clientDetailOpen) return null;
          const { staff_notes_business: _sn, ...rest } = data;
          void _sn;
          const result = await onUpdateClient(clientDetailOpen.id, rest);
          if (result) {
            toast.success(t('clients.updateSuccess'));
            setClientDetailOpen(result);
            return result;
          }
          toast.error(t('clients.saveError'));
          return null;
        }}
        onDelete={() => {
          if (clientDetailOpen) handleDeleteClick(clientDetailOpen.id);
          setClientDetailOpen(null);
        }}
        onAddPet={() => {
          if (clientDetailOpen) beginAddPetForClient(clientDetailOpen);
        }}
        onOpenPet={(pet, clientId) => openPetInPetsPage(pet, clientId)}
        onOpenTransaction={(txn) => {
          setClientDetailOpen(null);
          const path = businessSlug ? `/${businessSlug}/transactions/${txn.id}` : `/transactions/${txn.id}`;
          navigate(path, { state: transactionNavigateState(txn) });
        }}
      />

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