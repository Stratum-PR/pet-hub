import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Edit, Trash2, Scissors, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Service } from '@/types';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { SearchFilter } from '@/components/SearchFilter';
import { usePageLoadRef } from '@/hooks/usePageLoad';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { devConsole } from '@/lib/clientDebug';

interface ServicesProps {
  loading: boolean;
  services: Service[];
  onAddService: (service: Omit<Service, 'id' | 'created_at'>) => Promise<Service | null>;
  onUpdateService: (id: string, service: Partial<Service>) => Promise<Service | null>;
  onDeleteService: (id: string) => Promise<boolean>;
}

export function Services({ loading, services, onAddService, onUpdateService, onDeleteService }: ServicesProps) {
  const pageLoadRef = usePageLoadRef();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const SERVICE_VIEW_KEY = 'pet-hub-services-view';
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window === 'undefined') return 'cards';
    return window.localStorage.getItem(SERVICE_VIEW_KEY) === 'list' ? 'list' : 'cards';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SERVICE_VIEW_KEY, viewMode);
  }, [viewMode]);

  const filteredServices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return services;
    return services.filter((s) => {
      const name = (s.name ?? '').toLowerCase();
      const desc = (s.description ?? '').toLowerCase();
      const price = String(s.price ?? '');
      const duration = String(s.duration_minutes ?? '');
      return (
        name.includes(term) ||
        desc.includes(term) ||
        price.includes(term) ||
        duration.includes(term)
      );
    });
  }, [services, searchTerm]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    duration_minutes: 60,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      duration_minutes: 60,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        name: formData.name,
        description: formData.description || undefined,
        price: formData.price,
        duration_minutes: formData.duration_minutes,
      };
      
      if (editingService) {
        const result = await onUpdateService(editingService.id, submitData);
        if (result) {
          toast.success(t('services.serviceUpdated') || 'Service updated successfully!');
          setEditingService(null);
        } else {
          toast.error(t('services.updateError') || 'Could not update service.');
          return;
        }
      } else {
        const result = await onAddService(submitData);
        if (result) {
          toast.success(t('services.serviceAdded') || 'Service added successfully!');
        } else {
          toast.error(t('services.addError') || 'Could not add service.');
          return;
        }
      }
      resetForm();
      setShowForm(false);
    } catch (error) {
      devConsole.error('Error saving service:', error);
      toast.error(t('services.saveError') || 'An error occurred while saving the service');
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price,
      duration_minutes: service.duration_minutes,
    });
    setShowForm(true);
  };

  // Deep link from notifications: ?service=id
  useEffect(() => {
    const serviceId = searchParams.get('service');
    if (!serviceId || services.length === 0) return;
    const svc = services.find((s) => s.id === serviceId);
    const next = new URLSearchParams(searchParams);
    next.delete('service');
    setSearchParams(next, { replace: true });
    if (!svc) return;
    handleEdit(svc);
  }, [searchParams, services, setSearchParams]);

  const handleCancel = () => {
    setShowForm(false);
    setEditingService(null);
    resetForm();
  };

  const handleDeleteClick = (id: string) => {
    setServiceToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (serviceToDelete) {
      onDeleteService(serviceToDelete);
      setServiceToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  return (
    <PawLoadedContent
      loading={loading}
      loaderLabel={t('common.loading')}
      loaderWrapperClassName="min-h-[240px]"
    >
      <div ref={pageLoadRef} data-transition-root className="min-w-0 space-y-6 animate-fade-in">
        <div
          className="flex w-full min-w-0 flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center"
          data-page-toolbar
          data-page-search
        >
          <SearchFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder={t('services.searchPlaceholder')}
          />
          <div className="inline-flex rounded-xl border border-input bg-background/80 backdrop-blur-sm p-0.5 shrink-0">
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
              setEditingService(null);
              resetForm();
              setShowForm(!showForm);
            }}
            className="shadow-sm flex items-center gap-2 shrink-0"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? t('common.cancel') : t('services.addService')}
          </Button>
        </div>

      {showForm && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>{editingService ? t('common.edit') + ' ' + t('services.title') : t('services.addService')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Full Grooming"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price ($) *</Label>
                  <Input
                    type="text"
                    value={formData.price === 0 ? '' : formData.price.toString()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      if (value === '' || value === '.') {
                        setFormData({ ...formData, price: 0 });
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          setFormData({ ...formData, price: numValue });
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setFormData({ ...formData, price: value });
                      }
                    }}
                    required
                    placeholder="15"
                  />
                  <p className="text-xs text-muted-foreground">Enter amount (e.g., 15 for $15.00)</p>
                </div>
                <div className="space-y-2">
                  <Label>Duration (minutes) *</Label>
                  <Input
                    type="text"
                    value={formData.duration_minutes === 0 ? '' : formData.duration_minutes.toString()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      if (value === '') {
                        setFormData({ ...formData, duration_minutes: 0 });
                      } else {
                        const numValue = parseInt(value, 10);
                        if (!isNaN(numValue) && numValue > 0) {
                          setFormData({ ...formData, duration_minutes: numValue });
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value > 0) {
                        setFormData({ ...formData, duration_minutes: value });
                      } else if (formData.duration_minutes === 0) {
                        setFormData({ ...formData, duration_minutes: 60 });
                      }
                    }}
                    required
                    placeholder="30"
                  />
                  <p className="text-xs text-muted-foreground">Enter minutes (e.g., 30 for 30 minutes)</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full min-h-[100px] px-3 py-2 text-sm border border-input rounded-md bg-background"
                  placeholder="Service description..."
                />
              </div>
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap">
                <Button type="submit" className="shadow-sm w-full sm:w-auto">
                  {editingService ? t('common.edit') + ' ' + t('services.title') : t('services.addService')}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6" data-page-content>
        {services.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Scissors className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No services yet. Add your first service above!</p>
            </CardContent>
          </Card>
        ) : filteredServices.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Scissors className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('services.noSearchResults')}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Services</CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === 'cards' ? (
                <div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  data-page-cards-grid
                >
                  {filteredServices.map((service) => (
                    <Card key={service.id} className="border hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-lg break-words">{service.name}</h3>
                            {service.description && (
                              <p className="text-sm text-muted-foreground mt-1 break-words">{service.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(service)}
                              className="h-8 w-8"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(service.id)}
                              className="h-8 w-8 text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1 text-sm mt-3 pt-3 border-t">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Price:</span>
                            <span className="font-semibold">${service.price.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="text-muted-foreground">{service.duration_minutes} min</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  <ul className="space-y-3 lg:hidden" data-services-list-mobile>
                    {filteredServices.map((service) => (
                      <li
                        key={service.id}
                        className="rounded-lg border border-border bg-card p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium break-words">{service.name}</p>
                            <p className="text-sm text-muted-foreground break-words">
                              {service.description?.trim() ? service.description : '—'}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
                              <span>
                                {t('serviceForm.duration')}: {service.duration_minutes} min
                              </span>
                              <span className="font-semibold text-foreground">
                                {t('serviceForm.price')}: ${service.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(service)}
                              className="h-8 w-8"
                              aria-label={t('common.edit')}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(service.id)}
                              className="h-8 w-8 text-destructive"
                              aria-label={t('common.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden min-w-0 overflow-x-auto rounded-lg border-0 bg-card lg:block" data-table-load>
                    <table className="w-full min-w-0 text-sm table-fixed">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="w-[22%] px-2 py-2 text-left text-xs font-medium sm:px-3 sm:text-sm">
                            {t('serviceForm.name')}
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-medium sm:px-3 sm:text-sm">
                            {t('serviceForm.description')}
                          </th>
                          <th className="w-[12%] px-2 py-2 text-left text-xs font-medium whitespace-nowrap sm:px-3 sm:text-sm">
                            {t('serviceForm.duration')}
                          </th>
                          <th className="w-[12%] px-2 py-2 text-left text-xs font-medium whitespace-nowrap sm:px-3 sm:text-sm">
                            {t('serviceForm.price')}
                          </th>
                          <th className="w-[100px] px-2 py-2 text-left text-xs font-medium sm:px-3 sm:text-sm">
                            {t('common.actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredServices.map((service) => (
                          <tr key={service.id} className="border-t hover:bg-muted/40">
                            <td className="px-2 py-2 align-top font-medium break-words sm:px-3">{service.name}</td>
                            <td className="px-2 py-2 align-top text-muted-foreground break-words">
                              <span className="line-clamp-3">{service.description || '—'}</span>
                            </td>
                            <td className="px-2 py-2 align-top text-muted-foreground whitespace-nowrap sm:px-3">
                              {service.duration_minutes} min
                            </td>
                            <td className="px-2 py-2 align-top font-semibold whitespace-nowrap sm:px-3">
                              ${service.price.toFixed(2)}
                            </td>
                            <td className="px-2 py-2 align-top sm:px-3">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(service)}
                                  className="h-8 w-8"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(service.id)}
                                  className="h-8 w-8 text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Service"
        description="Are you sure you want to delete this service? This action cannot be undone."
      />
      </div>
    </PawLoadedContent>
  );
}
