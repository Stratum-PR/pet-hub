import { useState, useMemo } from 'react';
import { Plus, X, Edit, Trash2, Scissors, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useServices, Service } from '@/hooks/useBusinessData';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { APPOINTMENT_COLORS } from '@/types/calendar';

export function BusinessServices() {
  const { services, loading, error, refetch, addService, updateService, deleteService } = useServices();
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    duration_minutes: 60,
    is_active: true,
    category: '',
    color: APPOINTMENT_COLORS.blue,
  });

  const categories = useMemo(() => {
    const cats = new Set<string>();
    services.forEach(s => {
      // Note: category field doesn't exist in new schema, but keeping for compatibility
      const cat = (s as any).category;
      if (cat && cat.trim()) cats.add(cat.trim());
    });
    return Array.from(cats).sort();
  }, [services]);

  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, Service[]> = {};
    services.forEach(service => {
      const cat = (service as any).category || 'Uncategorized';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(service);
    });
    return grouped;
  }, [services]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      duration_minutes: 60,
      is_active: true,
      category: '',
      color: APPOINTMENT_COLORS.blue,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        description: formData.description || null,
      };
      
      if (editingService) {
        const result = await updateService(editingService.id, submitData);
        if (result) {
          toast.success(t('services.serviceUpdated'));
          resetForm();
          setShowForm(false);
          setEditingService(null);
        } else {
          toast.error(t('services.updateError'));
        }
      } else {
        const result = await addService(submitData);
        if (result) {
          toast.success(t('services.serviceAdded'));
          resetForm();
          setShowForm(false);
        } else {
          toast.error(t('services.addError'));
        }
      }
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error(t('services.saveError'));
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price,
      duration_minutes: service.duration_minutes,
      is_active: service.is_active,
      category: (service as any).category || '',
      color: (service as any).color || APPOINTMENT_COLORS.blue,
    });
    setShowForm(true);
  };

  const handleDeleteClick = (id: string) => {
    setServiceToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (serviceToDelete) {
      const success = await deleteService(serviceToDelete);
      if (success) {
        toast.success(t('services.serviceDeleted'));
      } else {
        toast.error(t('services.deleteError'));
      }
      setServiceToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleCancel = () => {
    resetForm();
    setShowForm(false);
    setEditingService(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-destructive">Failed to load services.</p>
            <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Button
          onClick={() => {
            setEditingService(null);
            resetForm();
            setShowForm(!showForm);
          }}
          className="shadow-sm flex items-center gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? t('common.cancel') : t('services.addService')}
        </Button>
      </div>

      {showForm && (
        <Card className="shadow-sm animate-fade-in">
          <CardHeader>
            <CardTitle>
              {editingService ? t('serviceForm.editService') : t('serviceForm.addNewService')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('serviceForm.name')} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder={t('serviceForm.namePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">{t('serviceForm.price')} *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">{t('serviceForm.duration')} *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.duration_minutes || ''}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                    required
                    placeholder="60"
                  />
                  <p className="text-xs text-muted-foreground">{t('serviceForm.durationHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="is_active">{t('serviceForm.status')}</Label>
                  <Select
                    value={formData.is_active ? 'active' : 'inactive'}
                    onValueChange={(value) => setFormData({ ...formData, is_active: value === 'active' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('serviceForm.active')}</SelectItem>
                      <SelectItem value="inactive">{t('serviceForm.inactive')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Grooming, Bath, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Appointment Color</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(value) => setFormData({ ...formData, color: value })}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border border-gray-300"
                            style={{ backgroundColor: formData.color }}
                          />
                          <span>{Object.entries(APPOINTMENT_COLORS).find(([_, v]) => v === formData.color)?.[0] || 'Blue'}</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPOINTMENT_COLORS).map(([name, color]) => (
                        <SelectItem key={name} value={color}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded border border-gray-300"
                              style={{ backgroundColor: color }}
                            />
                            <span className="capitalize">{name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Color used in appointment calendar</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">{t('serviceForm.description')}</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('serviceForm.descriptionPlaceholder')}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="shadow-sm">
                  {editingService ? t('serviceForm.updateService') : t('serviceForm.addService')}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {services.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">{t('services.noServices')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
            <Card key={category} className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary" />
                  {category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryServices.map((service) => (
                    <Card key={service.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold">{service.name}</h3>
                            {service.description && (
                              <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
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
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2">
                            {(service as any).color && (
                              <div
                                className="w-4 h-4 rounded border border-gray-300"
                                style={{ backgroundColor: (service as any).color }}
                                title="Appointment color"
                              />
                            )}
                            <span className="text-sm text-muted-foreground">
                              {service.duration_minutes} {t('serviceForm.minutes')}
                            </span>
                          </div>
                          <span className="font-semibold">${service.price.toFixed(2)}</span>
                        </div>
                        {!service.is_active && (
                          <div className="mt-2">
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                              {t('serviceForm.inactive')}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={t('services.deleteServiceTitle')}
        description={t('services.deleteServiceDescription')}
      />
    </div>
  );
}
