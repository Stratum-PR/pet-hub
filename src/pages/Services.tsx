import { useState, useMemo } from 'react';
import { Plus, X, Edit, Trash2, Scissors, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Service } from '@/types';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { toast } from 'sonner';
import { t } from '@/lib/translations';

interface ServicesProps {
  services: Service[];
  onAddService: (service: Omit<Service, 'id' | 'created_at'>) => void;
  onUpdateService: (id: string, service: Partial<Service>) => void;
  onDeleteService: (id: string) => void;
}

export function Services({ services, onAddService, onUpdateService, onDeleteService }: ServicesProps) {
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
    cost: 0,
    duration_minutes: 60,
    category: '',
  });

  const categories = useMemo(() => {
    const cats = new Set<string>();
    services.forEach(s => {
      if (s.category && s.category.trim()) cats.add(s.category.trim());
    });
    return Array.from(cats).sort();
  }, [services]);

  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, Service[]> = {};
    services.forEach(service => {
      const cat = service.category || 'Uncategorized';
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
      cost: 0,
      duration_minutes: 60,
      category: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        category: formData.category.trim() || undefined,
        cost: formData.cost > 0 ? formData.cost : undefined,
      };
      
      if (editingService) {
        onUpdateService(editingService.id, submitData);
        toast.success('Service updated successfully!');
        setEditingService(null);
      } else {
        onAddService(submitData);
        toast.success('Service added successfully!');
      }
      resetForm();
      setShowForm(false);
      setShowCategoryInput(false);
      setNewCategory('');
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('An error occurred while saving the service');
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price,
      cost: service.cost || 0,
      duration_minutes: service.duration_minutes,
      category: service.category || '',
    });
    setShowForm(true);
  };

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('services.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('services.description')}
          </p>
        </div>
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
                  <Label>Category</Label>
                  <div className="flex gap-2">
                    {!showCategoryInput ? (
                      <>
                        <Select
                          value={formData.category || ''}
                          onValueChange={(value) => {
                            if (value === '__new__') {
                              setShowCategoryInput(true);
                            } else {
                              setFormData({ ...formData, category: value });
                            }
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select or create category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.length > 0 ? (
                              <>
                                {categories.map(cat => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__new__" className="text-primary">
                                  <Plus className="w-4 h-4 inline mr-2" />
                                  Create New Category
                                </SelectItem>
                              </>
                            ) : (
                              <SelectItem value="__new__" className="text-primary">
                                <Plus className="w-4 h-4 inline mr-2" />
                                Create First Category
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <>
                        <Input
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          placeholder="Enter new category name"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newCategory.trim()) {
                                setFormData({ ...formData, category: newCategory.trim() });
                                setShowCategoryInput(false);
                                setNewCategory('');
                              }
                            } else if (e.key === 'Escape') {
                              setShowCategoryInput(false);
                              setNewCategory('');
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (newCategory.trim()) {
                              setFormData({ ...formData, category: newCategory.trim() });
                            }
                            setShowCategoryInput(false);
                            setNewCategory('');
                          }}
                        >
                          <Tag className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setShowCategoryInput(false);
                            setNewCategory('');
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  {formData.category && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {formData.category}
                    </p>
                  )}
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
                  <Label>Cost ($) - Business Expense</Label>
                  <Input
                    type="text"
                    value={formData.cost === 0 ? '' : formData.cost.toString()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      if (value === '' || value === '.') {
                        setFormData({ ...formData, cost: 0 });
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          setFormData({ ...formData, cost: numValue });
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setFormData({ ...formData, cost: value });
                      }
                    }}
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">Cost to business (e.g., 10 for $10.00)</p>
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
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="shadow-sm">
                  {editingService ? t('common.edit') + ' ' + t('services.title') : t('services.addService')}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {Object.keys(servicesByCategory).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Scissors className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No services yet. Add your first service above!</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(servicesByCategory).map(([category, categoryServices]) => (
            <Card key={category} className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryServices.map((service) => (
                    <Card key={service.id} className="border hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{service.name}</h3>
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
                        <div className="space-y-1 text-sm mt-3 pt-3 border-t">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Price:</span>
                            <span className="font-semibold">${service.price.toFixed(2)}</span>
                          </div>
                          {service.cost && service.cost > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Cost:</span>
                              <span className="text-muted-foreground">${service.cost.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="text-muted-foreground">{service.duration_minutes} min</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Service?"
        description="This will permanently delete this service. This action cannot be undone."
      />
    </div>
  );
}
