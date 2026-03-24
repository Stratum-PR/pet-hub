import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package, Trash2, Upload, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { format } from 'date-fns';
import { toast } from 'sonner';

export type StockMovementLite = {
  product_id: string;
  quantity: number;
  movement_type: string;
  supplier?: string | null;
  created_at: string;
};

type FormShape = {
  name: string;
  sku: string;
  barcode: string;
  price: number;
  quantity: number;
  supplier: string;
  category: string;
  description: string;
  cost: number;
  reorder_level: number;
  notes: string;
};

function productToForm(p: Product): FormShape {
  return {
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
  };
}

export type InventoryItemExpandedHandle = {
  save: () => void;
};

interface InventoryItemExpandedProps {
  product: Product;
  products: Product[];
  stockMovements: StockMovementLite[];
  isLowStock: (p: Product) => boolean;
  onSave: (id: string, data: Partial<Product>, photoFile?: File) => void;
  onRequestDelete: () => void;
  onUploadProductPhoto?: (productId: string, file: File) => Promise<string | null>;
  onAdjustStock?: (
    productId: string,
    quantityDelta: number,
    movementType?: 'restock' | 'adjustment' | 'purchase' | 'sale',
    notes?: string | null
  ) => Promise<Product | null>;
  onQuantityUpdated?: (id: string, quantity: number) => void;
  /** e.g. dialog body: `px-0 pt-1` */
  className?: string;
  /** When false, Save/Delete row is omitted (use modal header + ref.save()). */
  hideToolbar?: boolean;
}

export const InventoryItemExpanded = forwardRef<InventoryItemExpandedHandle, InventoryItemExpandedProps>(
  function InventoryItemExpanded(
    {
      product,
      products,
      stockMovements,
      isLowStock,
      onSave,
      onRequestDelete,
      onUploadProductPhoto,
      onAdjustStock,
      onQuantityUpdated,
      className,
      hideToolbar = false,
    },
    ref
  ) {
  const [form, setForm] = useState<FormShape>(() => productToForm(product));
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [quickQty, setQuickQty] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

  useEffect(() => {
    setForm(productToForm(product));
    setPhotoFile(null);
  }, [product.id, product.updated_at]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photoFile]);

  const movements = stockMovements.filter((m) => m.product_id === product.id);
  const low = isLowStock({ ...product, ...form, quantity: form.quantity } as Product);

  const duplicateSku =
    form.sku.trim().length > 0 &&
    products.some(
      (p) => p.id !== product.id && p.sku.toLowerCase() === form.sku.trim().toLowerCase()
    );

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error(t('inventory.validationNameRequired'));
      return;
    }
    if (!form.sku.trim()) {
      toast.error(t('inventory.validationSkuRequired'));
      return;
    }
    if (duplicateSku) {
      toast.error(t('inventory.validationSkuDuplicate') ?? 'SKU already in use');
      return;
    }
    if (form.quantity < 0) {
      toast.error(t('inventory.validationNegativeStock'));
      return;
    }
    if (form.price < 0 || form.cost < 0) {
      toast.error(t('inventory.validationNegativePrice'));
      return;
    }

    setSaving(true);
    const patch: Partial<Product> = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: form.price,
      quantity: form.quantity,
      supplier: form.supplier.trim() || undefined,
      category: form.category.trim() || undefined,
      description: form.description.trim() || undefined,
      cost: form.cost,
      reorder_level: form.reorder_level,
      notes: form.notes.trim() || undefined,
    };
    (patch as { barcode?: string | null }).barcode = form.barcode.trim() || null;
    onSave(product.id, patch, photoFile || undefined);
    setPhotoFile(null);
    setSaving(false);
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useImperativeHandle(ref, () => ({
    save: () => handleSaveRef.current(),
  }));

  const handleQuickAdd = async () => {
    const qty = parseInt(quickQty, 10);
    if (!onAdjustStock || !qty || qty <= 0) return;
    setQuickAdding(true);
    const updated = await onAdjustStock(product.id, qty, 'adjustment', 'Quick add');
    setQuickAdding(false);
    setQuickQty('');
    if (updated) {
      setForm((f) => ({ ...f, quantity: updated.quantity }));
      onQuantityUpdated?.(product.id, updated.quantity);
      toast.success(t('inventory.addQuantity') ?? 'Stock updated');
    } else toast.error(t('common.genericError'));
  };

  const field = (id: string, label: string, child: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {child}
    </div>
  );

  return (
    <div className={cn('space-y-4 p-4 sm:p-5', className)} onClick={(e) => e.stopPropagation()}>
      {!hideToolbar ? (
        <div className="flex items-center justify-end gap-1.5 border-b border-border pb-3">
          <Button
            type="button"
            size="icon"
            variant="default"
            className="h-9 w-9 shrink-0"
            disabled={saving || duplicateSku}
            title={saving ? t('common.saving') : t('common.save')}
            aria-label={saving ? t('common.saving') : t('common.save')}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-9 w-9 shrink-0"
            title={t('common.delete')}
            aria-label={t('common.delete')}
            onClick={onRequestDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2 sm:w-36">
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {photoPreviewUrl ? (
              <img src={photoPreviewUrl} alt="" className="h-full w-full object-cover" />
            ) : product.photo_url ? (
              <img src={product.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          {onUploadProductPhoto && (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhotoFile(f);
                  e.target.value = '';
                }}
              />
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Upload className="h-3.5 w-3.5" />
                {t('inventory.uploadPhoto')}
              </span>
            </label>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field(
              `inv-name-${product.id}`,
              t('inventory.productName'),
              <Input
                id={`inv-name-${product.id}`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9"
              />
            )}
            {field(
              `inv-sku-${product.id}`,
              t('inventory.sku'),
              <Input
                id={`inv-sku-${product.id}`}
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                className="h-9 font-mono text-sm"
              />
            )}
            {field(
              `inv-barcode-${product.id}`,
              t('inventory.barcode'),
              <Input
                id={`inv-barcode-${product.id}`}
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                className="h-9 font-mono text-sm"
                placeholder={t('inventory.barcodePlaceholder') ?? ''}
              />
            )}
            {field(
              `inv-cat-${product.id}`,
              t('inventory.category') ?? 'Category',
              <Input
                id={`inv-cat-${product.id}`}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="h-9"
              />
            )}
            {field(
              `inv-supplier-${product.id}`,
              t('inventory.supplier') ?? 'Supplier',
              <Input
                id={`inv-supplier-${product.id}`}
                value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                className="h-9"
              />
            )}
            {field(
              `inv-qty-${product.id}`,
              t('inventory.stock'),
              <Input
                id={`inv-qty-${product.id}`}
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 0 }))}
                className={cn('h-9', low && 'border-destructive')}
              />
            )}
            {field(
              `inv-reorder-${product.id}`,
              t('inventory.reorderLevel') ?? 'Reorder at',
              <Input
                id={`inv-reorder-${product.id}`}
                type="number"
                min={0}
                value={form.reorder_level}
                onChange={(e) => setForm((f) => ({ ...f, reorder_level: parseInt(e.target.value, 10) || 0 }))}
                className="h-9"
              />
            )}
            {field(
              `inv-cost-${product.id}`,
              t('inventory.costPrice'),
              <Input
                id={`inv-cost-${product.id}`}
                type="number"
                min={0}
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: parseFloat(e.target.value) || 0 }))}
                className="h-9"
              />
            )}
            {field(
              `inv-price-${product.id}`,
              t('inventory.salePrice'),
              <Input
                id={`inv-price-${product.id}`}
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                className="h-9"
              />
            )}
          </div>

          {field(
            `inv-desc-${product.id}`,
            t('inventory.productDescription'),
            <Textarea
              id={`inv-desc-${product.id}`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="min-h-[60px] resize-y text-sm"
            />
          )}
          {field(
            `inv-notes-${product.id}`,
            t('inventory.notes') ?? 'Notes',
            <Textarea
              id={`inv-notes-${product.id}`}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="min-h-[52px] resize-y text-sm"
            />
          )}

          {onAdjustStock && (
            <div className="flex flex-wrap items-end gap-2 rounded-md border border-border/80 bg-muted/30 p-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('inventory.addMoreStock') ?? 'Add stock'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={quickQty}
                    onChange={(e) => setQuickQty(e.target.value)}
                    placeholder="0"
                    className="h-9 w-24"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    disabled={quickAdding || !(parseInt(quickQty, 10) > 0)}
                    onClick={handleQuickAdd}
                  >
                    {quickAdding ? t('common.saving') : t('inventory.done') ?? 'Apply'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t('inventory.orderHistory')}</h3>
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('inventory.noOrderHistory')}</p>
        ) : (
          <ul className="max-h-36 space-y-1.5 overflow-y-auto text-sm">
            {movements.map((m) => (
              <li key={m.created_at + m.quantity} className="flex justify-between border-b border-border/60 pb-1">
                <span>
                  {format(new Date(m.created_at), 'MMM d, yyyy')} · {m.movement_type}{' '}
                  {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                  {m.supplier ? ` (${m.supplier})` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
});

InventoryItemExpanded.displayName = 'InventoryItemExpanded';
