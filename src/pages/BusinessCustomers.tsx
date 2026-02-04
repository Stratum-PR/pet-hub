import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Edit, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomers } from '@/hooks/useBusinessData';
import { Customer } from '@/hooks/useBusinessData';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { CustomerForm } from '@/components/CustomerForm';
import { SearchFilter } from '@/components/SearchFilter';
import { t } from '@/lib/translations';
import { toast } from 'sonner';

export function BusinessCustomers() {
  const { customers, loading, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  // Handle highlight from URL parameter
  useEffect(() => {
    if (highlightId) {
      const element = document.getElementById(`customer-${highlightId}`);
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

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const search = searchTerm.toLowerCase();
    return customers.filter(customer =>
      customer.first_name.toLowerCase().includes(search) ||
      customer.last_name.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search) ||
      customer.phone.toLowerCase().includes(search)
    );
  }, [customers, searchTerm]);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
    // Scroll to form
    setTimeout(() => {
      const formElement = document.getElementById('customer-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleDeleteClick = (id: string) => {
    setCustomerToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (customerToDelete) {
      deleteCustomer(customerToDelete);
      setCustomerToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleSubmit = async (customerData: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'business_id'>) => {
    if (editingCustomer) {
      const result = await updateCustomer(editingCustomer.id, customerData);
      if (result) {
        toast.success(t('clients.updateSuccess'));
        setShowForm(false);
        setEditingCustomer(null);
      } else {
        toast.error(t('clients.saveError'));
      }
    } else {
      const result = await addCustomer(customerData as Omit<Customer, 'id' | 'created_at' | 'updated_at'>);
      if (result) {
        toast.success(t('clients.saveSuccess'));
        setShowForm(false);
        setEditingCustomer(null);
      } else {
        toast.error(t('clients.saveError'));
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCustomer(null);
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
            setEditingCustomer(null);
            setShowForm(!showForm);
          }}
          className="shadow-sm flex items-center gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? t('common.cancel') : t('clients.addClient')}
        </Button>
      </div>

      {showForm && (
        <div id="customer-form">
          <CustomerForm
            initialData={editingCustomer}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEditing={!!editingCustomer}
          />
        </div>
      )}

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder={t('clients.searchPlaceholder')}
      />

      {filteredCustomers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              {searchTerm ? t('clients.noResults') : t('clients.noCustomers')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => {
            const isHighlighted = highlightId === customer.id;
            return (
            <Card 
              key={customer.id} 
              id={`customer-${customer.id}`}
              className={`shadow-sm hover:shadow-md transition-shadow ${isHighlighted ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {customer.first_name} {customer.last_name}
                    </h3>
                    {customer.email && (
                      <p className="text-sm text-muted-foreground">{customer.email}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(customer)}
                      className="h-8 w-8"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(customer.id)}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {(customer.address || customer.city || customer.state) && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {[customer.address, customer.city, customer.state, customer.zip_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {customer.notes && (
                  <p className="text-sm text-muted-foreground mt-2 border-t pt-2">
                    {customer.notes}
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
