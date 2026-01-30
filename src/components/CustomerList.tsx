import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Mail, Phone, MapPin, Dog } from 'lucide-react';
import { Customer, Pet } from '@/hooks/useBusinessData';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { t } from '@/lib/translations';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CustomerListProps {
  customers: Customer[];
  pets: Pet[];
  onDelete: (id: string) => void;
  onEdit: (customer: Customer) => void;
  selectedCustomerId?: string;
}

export function CustomerList({ customers, pets, onDelete, onEdit, selectedCustomerId }: CustomerListProps) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCustomerId) {
      const element = document.getElementById(`customer-${selectedCustomerId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 2000);
      }
    }
  }, [selectedCustomerId]);

  const handleDeleteClick = (id: string) => {
    setCustomerToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (customerToDelete) {
      onDelete(customerToDelete);
      setCustomerToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handlePetClick = (petId: string) => {
    navigate(`/app/pets?highlight=${petId}`);
  };

  if (customers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">{t('clients.noCustomers')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((customer) => {
          const customerPets = pets.filter((pet) => pet.customer_id === customer.id);
          return (
            <Card
              key={customer.id}
              id={`customer-${customer.id}`}
              className="shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">
                      {customer.first_name} {customer.last_name}
                    </h3>
                  </div>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(customer)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Editar información del cliente</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(customer.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Eliminar cliente permanentemente</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{customer.email || t('common.noEmail')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{customer.phone}</span>
                  </div>
                  {(customer.address || customer.city || customer.state) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">
                        {[customer.address, customer.city, customer.state, customer.zip_code]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>
                {customerPets.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Dog className="w-4 h-4 text-primary" />
                      <span>
                        {customerPets.length} {customerPets.length === 1 ? t('pets.pet') : t('pets.pets')}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {customerPets.map((pet) => (
                        <button
                          key={pet.id}
                          id={`pet-${pet.id}`}
                          onClick={() => handlePetClick(pet.id)}
                          className="px-2 py-1 bg-accent text-accent-foreground text-xs rounded-md hover:bg-accent/80 transition-colors cursor-pointer"
                        >
                          {pet.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={t('clients.deleteClientTitle')}
        description={t('clients.deleteClientDescription')}
      />
    </>
  );
}
