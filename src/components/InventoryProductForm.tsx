import { useState, useEffect } from 'react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Scan, Search, Check, Plus, Upload } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { useIsMobile } from '@/hooks/use-mobile';

const defaultFormData = {
  name: '',
  sku: '',
  barcode: '',
  price: 0,
  quantity: 0,
  supplier: '',
  category: '',
  description: '',
  cost: 0,
  reorder_level: 0,
  notes: '',
  photo_url: null as string | null,
  custom_fields: {} as Record<string, string | number | boolean | null>,
};

interface InventoryProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  products: Product[];
  onSave: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>, photoFile?: File) => void;
  onUpdate: (id: string, data: Partial<Product>, photoFile?: File) => void;
  onSelectFromRegistry?: (product: Product) => void;
}

export function InventoryProductForm({
  open,
  onOpenChange,
  product,
  products,
  onSave,
  onUpdate,
}: InventoryProductFormProps) {
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState(defaultFormData);
  const [registryOpen, setRegistryOpen] = useState(false);
  const [registryQuery, setRegistryQuery] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showDuplicateSkuDialog, setShowDuplicateSkuDialog] = useState(false);

  const isEditing = !!product;

  const duplicateSku = formData.sku.trim()
    ? products.some((p) => p.sku.toLowerCase() === formData.sku.trim().toLowerCase() && p.id !== product?.id)
    : false;

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        price: product.price,
        quantity: product.quantity,
        supplier: product.supplier || '',
        category: product.category || '',
        description: product.description || '',
        cost: product.cost ?? 0,
        reorder_level: product.reorder_level ?? 0,
        notes: product.notes || '',
        photo_url: product.photo_url ?? null,
        custom_fields: product.custom_fields ?? {},
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [product, open]);

  const filteredRegistry = products.filter(
    (p) =>
      !registryQuery ||
      p.name.toLowerCase().includes(registryQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(registryQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(registryQuery.toLowerCase()))
  );

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.name?.trim()) next.name = t('inventory.validationNameRequired');
    if (!formData.sku?.trim()) next.sku = t('inventory.validationSkuRequired');
    if (formData.quantity < 0) next.quantity = t('inventory.validationNegativeStock');
    if (formData.price < 0) next.price = t('inventory.validationNegativePrice');
    if (formData.cost < 0) next.cost = t('inventory.validationNegativeCost');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const doSubmit = () => {
    if (isEditing && product) {
      onUpdate(product.id, formData, photoFile || undefined);
    } else {
      onSave(formData, photoFile || undefined);
    }
    setPhotoFile(null);
    setErrors({});
    setShowDuplicateSkuDialog(false);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (duplicateSku) {
      setShowDuplicateSkuDialog(true);
      return;
    }
    doSubmit();
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEditing && (
        <div className="space-y-2">
          <Label>{t('inventory.productRegistry')}</Label>
          <Popover open={registryOpen} onOpenChange={setRegistryOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span className="truncate">Search or add new product...</span>
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search products..."
                  value={registryQuery}
                  onValueChange={setRegistryQuery}
                />
                <CommandList>
                  <CommandEmpty>
                    <div className="py-4 text-center text-sm">
                      <p className="mb-2">No product found.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRegistryOpen(false)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Product
                      </Button>
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredRegistry.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.id}
                        onSelect={() => {
                          setFormData({
                            ...defaultFormData,
                            name: p.name,
                            sku: p.sku,
                            barcode: p.barcode || '',
                            price: p.price,
                            quantity: p.quantity,
                            supplier: p.supplier || '',
                            category: p.category || '',
                            description: p.description || '',
                            cost: p.cost ?? 0,
                            reorder_level: p.reorder_level ?? 0,
                            notes: p.notes || '',
                            photo_url: p.photo_url ?? null,
                            custom_fields: p.custom_fields ?? {},
                          });
                          setRegistryOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', 'opacity-0')} />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">SKU: {p.sku}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('inventory.productName')} *</Label>
          <Input
            value={formData.name}
            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors((e2) => ({ ...e2, name: '' })); }}
            required
            placeholder="e.g. Dog Shampoo"
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label>{t('inventory.sku')} *</Label>
          <Input
            value={formData.sku}
            onChange={(e) => { setFormData({ ...formData, sku: e.target.value }); setErrors((e2) => ({ ...e2, sku: '' })); }}
            required
            placeholder="DS-001"
            className={errors.sku ? 'border-destructive' : ''}
          />
          {errors.sku && <p className="text-sm text-destructive">{errors.sku}</p>}
          {duplicateSku && formData.sku.trim() && (
            <p className="text-sm text-amber-600 dark:text-amber-500">{t('inventory.duplicateSkuWarning')}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('inventory.barcode')}</Label>
          <div className="flex gap-2">
            <Input
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="Scan or enter barcode"
            />
            <Button type="button" variant="outline" size="icon" title={t('inventory.scanBarcode')}>
              <Scan className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('inventory.category')}</Label>
          <Input
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="Shampoo, Food, Toys"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('inventory.supplier')}</Label>
          <Input
            value={formData.supplier}
            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            placeholder="Supplier name"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('inventory.quantity')} *</Label>
          <Input
            type="number"
            min={0}
            value={formData.quantity}
            onChange={(e) => { setFormData({ ...formData, quantity: Number(e.target.value) }); setErrors((er) => ({ ...er, quantity: '' })); }}
            required
            className={errors.quantity ? 'border-destructive' : ''}
          />
          {errors.quantity && <p className="text-sm text-destructive">{errors.quantity}</p>}
        </div>
        <div className="space-y-2">
          <Label>{t('inventory.reorderLevel')}</Label>
          <Input
            type="number"
            min={0}
            value={formData.reorder_level}
            onChange={(e) => setFormData({ ...formData, reorder_level: Number(e.target.value) })}
            placeholder="Low stock threshold"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('inventory.costPrice')}</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={formData.cost || ''}
            onChange={(e) => { setFormData({ ...formData, cost: Number(e.target.value) || 0 }); setErrors((er) => ({ ...er, cost: '' })); }}
            placeholder="0.00"
            className={errors.cost ? 'border-destructive' : ''}
          />
          {errors.cost && <p className="text-sm text-destructive">{errors.cost}</p>}
        </div>
        <div className="space-y-2">
          <Label>{t('inventory.salePrice')} *</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={formData.price || ''}
            onChange={(e) => { setFormData({ ...formData, price: Number(e.target.value) || 0 }); setErrors((er) => ({ ...er, price: '' })); }}
            required
            placeholder="0.00"
            className={errors.price ? 'border-destructive' : ''}
          />
          {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('inventory.productPhoto')}</Label>
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/*"
              className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) {
                  setPhotoFile(null);
                  return;
                }
                const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
                if (!ALLOWED_TYPES.includes(f.type)) {
                  setErrors((prev) => ({ ...prev, photo: 'Invalid file type. Use JPEG, PNG, WebP or GIF.' }));
                  e.target.value = '';
                  setPhotoFile(null);
                  return;
                }
                if (f.size > 5 * 1024 * 1024) {
                  setErrors((prev) => ({ ...prev, photo: 'File too large. Maximum size is 5MB.' }));
                  e.target.value = '';
                  setPhotoFile(null);
                  return;
                }
                setErrors((prev) => ({ ...prev, photo: '' }));
                setPhotoFile(f);
                setFormData((d) => ({ ...d, photo_url: null }));
              }}
            />
            {!photoFile && (
              <Input
                value={formData.photo_url || ''}
                onChange={(e) => setFormData({ ...formData, photo_url: e.target.value || null })}
                placeholder={t('inventory.photoUrlPlaceholder')}
              />
            )}
            {photoFile && <p className="text-sm text-muted-foreground">{photoFile.name}</p>}
            {errors.photo && <p className="text-sm text-destructive">{errors.photo}</p>}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t('inventory.productDescription')}</Label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full min-h-[80px] px-3 py-2 text-sm border border-input rounded-md bg-background resize-y"
          placeholder="Product description..."
        />
      </div>
      <div className="space-y-2">
        <Label>{t('inventory.notes')}</Label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full min-h-[60px] px-3 py-2 text-sm border border-input rounded-md bg-background resize-y"
          placeholder="Internal notes..."
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit">
          {isEditing ? t('common.save') : t('inventory.addProduct')}
        </Button>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
      </div>

      <AlertDialog open={showDuplicateSkuDialog} onOpenChange={setShowDuplicateSkuDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inventory.duplicateSkuTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('inventory.duplicateSkuDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit}>{t('inventory.saveAnyway')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );

  const title = isEditing ? t('inventory.editProduct') : t('inventory.addProduct');

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">{content}</div>
      </SheetContent>
    </Sheet>
  );
}
