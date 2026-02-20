import { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Scan,
  LayoutGrid,
  List,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Product } from '@/types/inventory';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { SearchFilter } from '@/components/SearchFilter';
import { InventoryProductForm } from '@/components/InventoryProductForm';
import { InventoryProductDetailModal } from '@/components/InventoryProductDetailModal';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateSkuForBarcode } from '@/lib/skuFromBarcode';
import { normalizeBarcodeForMatch } from '@/lib/barcodeValidation';

/** Get user-facing message from supabase.functions.invoke error (e.g. 503 body). */
async function getInvokeErrorMessage(err: unknown): Promise<string | null> {
  const e = err as { context?: { json?: () => Promise<{ error?: string; message?: string }> }; message?: string };
  if (e?.context?.json) {
    try {
      const body = await e.context.json();
      return body?.error ?? body?.message ?? null;
    } catch {
      // ignore
    }
  }
  return e?.message ?? null;
}

type ViewMode = 'tile' | 'list';

interface InventoryProps {
  products: Product[];
  /** Global default low-stock threshold (used when product has no reorder_level). Default 5. */
  defaultLowStockThreshold?: number;
  onAddProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product | null>;
  onUpdateProduct: (id: string, product: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
  /** When user scans an existing product and confirms quantity, add to stock and log movement. */
  onAdjustStock?: (productId: string, quantityDelta: number, movementType?: 'restock' | 'adjustment' | 'purchase' | 'sale', notes?: string | null) => Promise<Product | null>;
  stockMovements?: { product_id: string; quantity: number; movement_type: string; supplier?: string | null; created_at: string }[];
  onUploadProductPhoto?: (productId: string, file: File) => Promise<string | null>;
}

export function Inventory({
  products,
  defaultLowStockThreshold = 5,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  stockMovements = [],
  onUploadProductPhoto,
}: InventoryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'in_stock'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustMode, setAdjustMode] = useState<'delta' | 'count'>('delta');
  const [initialBarcodeFromScan, setInitialBarcodeFromScan] = useState<string | null>(null);
  /** Prefilled data from barcode lookup (open add form instead of auto-adding). */
  const [initialPrefilledFromLookup, setInitialPrefilledFromLookup] = useState<{
    name: string;
    barcode: string;
    brand?: string;
    category?: string;
    description?: string;
    imageUrl?: string;
  } | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [quickAddQty, setQuickAddQty] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lastScanTimeRef = useRef<number>(0);
  const SCAN_COOLDOWN_MS = 1500;

  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          (p.barcode && p.barcode.toLowerCase().includes(term)) ||
          (p.category && p.category.toLowerCase().includes(term)) ||
          (p.supplier && p.supplier.toLowerCase().includes(term))
      );
    }
    if (stockFilter === 'low') {
      list = list.filter((p) => p.reorder_level != null && p.quantity <= p.reorder_level);
    } else if (stockFilter === 'in_stock') {
      list = list.filter((p) => p.reorder_level == null || p.quantity > p.reorder_level);
    }
    return list;
  }, [products, searchTerm, stockFilter]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setInitialBarcodeFromScan(null);
    setFormOpen(true);
  };

  const handleScanResult = async (value: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (now - lastScanTimeRef.current < SCAN_COOLDOWN_MS) return;
    lastScanTimeRef.current = now;

    // Match by barcode (UPC/EAN) first, then by SKU. Normalize so 12-digit UPC and 13-digit EAN match.
    const normalizedScan = normalizeBarcodeForMatch(trimmed);
    const found =
      products.find((p) => p.barcode && normalizeBarcodeForMatch(p.barcode) === normalizedScan) ??
      products.find((p) => p.sku && p.sku.trim().toLowerCase() === trimmed.toLowerCase());
    if (found) {
      if (onAdjustStock) {
        const updated = await onAdjustStock(found.id, 1, 'adjustment', 'Barcode scan');
        if (updated) {
          onUpdateProduct(found.id, { quantity: updated.quantity });
          setScanOpen(false);
          toast.success(t('inventory.addQuantity') ?? 'Stock updated');
        } else {
          toast.error(t('common.genericError'));
        }
      } else {
        setAdjustProduct(found);
        setAdjustMode('delta');
        setAdjustQty('1');
      }
      return;
    }

    setLookupLoading(true);
    const loadingToastId = toast.loading(t('inventory.lookingUpBarcode') ?? 'Looking up product…');
    try {
      const { data, error } = await supabase.functions.invoke('barcode-lookup', {
        body: { barcode: trimmed },
      });
      if (import.meta.env.DEV && (error || !data?.found)) {
        console.debug('[barcode-lookup]', { barcode: trimmed, data, error });
      }
      const payload = data as { found?: boolean; product?: { name: string; brand?: string; category?: string; description?: string; imageUrl?: string; barcode: string }; error?: string } | null;
      if (error) {
        const errMsg = await getInvokeErrorMessage(error);
        if (errMsg?.includes('not configured')) {
          toast.warning(t('inventory.barcodeLookupNotConfigured'));
        } else {
          toast.warning(errMsg || t('inventory.barcodeLookupFailed'));
        }
        openFormWithBarcode(trimmed);
        return;
      }
      if (payload?.error) {
        if (payload.error.includes('not configured')) {
          toast.warning(t('inventory.barcodeLookupNotConfigured'));
        } else {
          toast.warning(payload.error);
        }
        openFormWithBarcode(trimmed);
        return;
      }
      if (payload?.found && payload?.product) {
        setScanOpen(false);
        setInitialPrefilledFromLookup({
          name: payload.product.name,
          barcode: payload.product.barcode,
          brand: payload.product.brand,
          category: payload.product.category,
          description: payload.product.description,
          imageUrl: payload.product.imageUrl,
        });
        setInitialBarcodeFromScan(null);
        setFormOpen(true);
        toast.success(t('inventory.barcodeFoundPrefill') ?? 'Product found. Confirm details and save.');
      } else {
        toast.info(t('inventory.barcodeNotFoundInDatabase'));
        openFormWithBarcode(trimmed);
      }
    } catch {
      toast.warning(t('inventory.barcodeLookupFailed'));
      openFormWithBarcode(trimmed);
    } finally {
      setLookupLoading(false);
      toast.dismiss(loadingToastId);
    }
  };

  function openFormWithBarcode(barcode: string) {
    setInitialBarcodeFromScan(barcode);
    setEditingProduct(null);
    setFormOpen(true);
    toast.info(t('inventory.addProduct') + ' – ' + (t('inventory.manualBarcodeEntry') ?? 'Enter details'));
  }

  const handleAdjustSubmit = async () => {
    if (!adjustProduct || !onAdjustStock) return;
    let delta: number;
    let movementType: 'restock' | 'adjustment' | 'purchase' | 'sale' = 'adjustment';
    let notes: string | null = 'Barcode scan';

    if (adjustMode === 'count') {
      const newTotal = parseInt(adjustQty, 10);
      if (Number.isNaN(newTotal) || newTotal < 0) {
        toast.error(t('inventory.setQuantityTo') ? 'Enter a valid quantity (0 or more)' : 'Enter a valid quantity (0 or more)');
        return;
      }
      delta = newTotal - adjustProduct.quantity;
      movementType = 'adjustment';
      notes = 'Inventory count';
    } else {
      const qty = parseInt(adjustQty, 10);
      if (Number.isNaN(qty) || qty === 0) {
        toast.error(t('inventory.quantityToAddOrRemove') ? 'Enter a non-zero quantity (negative for sale)' : 'Enter a non-zero quantity');
        return;
      }
      delta = qty;
      movementType = delta < 0 ? 'sale' : 'adjustment';
      notes = delta < 0 ? 'Sale' : 'Barcode scan';
    }

    setAdjusting(true);
    const updated = await onAdjustStock(adjustProduct.id, delta, movementType, notes);
    setAdjusting(false);
    if (updated) {
      onUpdateProduct(adjustProduct.id, { quantity: updated.quantity });
      setAdjustProduct(null);
      setAdjustQty('');
      toast.success(adjustMode === 'count' ? (t('inventory.inventoryCount') ?? 'Count saved') : (t('inventory.addQuantity') ?? 'Stock updated'));
    } else {
      toast.error(t('common.genericError'));
    }
  };

  const handleSaveNew = async (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>, photoFile?: File) => {
    const created = await onAddProduct(data);
    if (created && photoFile && onUploadProductPhoto) {
      const url = await onUploadProductPhoto(created.id, photoFile);
      if (url) onUpdateProduct(created.id, { photo_url: url });
    }
    setFormOpen(false);
    setInitialBarcodeFromScan(null);
  };

  const handleSaveUpdate = (id: string, data: Partial<Product>, photoFile?: File) => {
    onUpdateProduct(id, data);
    if (photoFile && onUploadProductPhoto) {
      onUploadProductPhoto(id, photoFile).then((url) => {
        if (url) onUpdateProduct(id, { photo_url: url });
      });
    }
    setFormOpen(false);
    setEditingProduct(null);
    setInitialBarcodeFromScan(null);
  };

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      onDeleteProduct(productToDelete);
      setProductToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const thresholdFor = (p: Product) => {
    if (p.reorder_level != null && p.reorder_level >= 0) return p.reorder_level;
    return defaultLowStockThreshold;
  };
  const isLowStock = (p: Product) => p.quantity <= thresholdFor(p);

  const handleQuickAdd = async (p: Product) => {
    const qty = parseInt(quickAddQty, 10) || 0;
    if (qty <= 0 || !onAdjustStock) return;
    setQuickAdding(true);
    const updated = await onAdjustStock(p.id, qty, 'adjustment', 'Quick add');
    setQuickAdding(false);
    setQuickAddProduct(null);
    setQuickAddQty('');
    if (updated) {
      onUpdateProduct(p.id, { quantity: updated.quantity });
      toast.success(t('inventory.addQuantity') ?? 'Stock updated');
    } else toast.error(t('common.genericError'));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" title={t('inventory.scanBarcode')} onClick={() => setScanOpen(true)}>
            <Scan className="w-4 h-4" />
            <span className="hidden sm:inline">{t('inventory.scanBarcode')}</span>
          </Button>
          <Button onClick={handleAddProduct} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            {t('inventory.addProduct')}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
          {/* Search, filters, view toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SearchFilter
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder={t('inventory.searchPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={stockFilter} onValueChange={(v: any) => setStockFilter(v)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inventory.stockFilterAll')}</SelectItem>
                  <SelectItem value="low">{t('inventory.stockFilterLow')}</SelectItem>
                  <SelectItem value="in_stock">{t('inventory.stockFilterInStock')}</SelectItem>
                </SelectContent>
              </Select>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as ViewMode)}
                className="border rounded-md p-0.5"
              >
                <ToggleGroupItem value="tile" aria-label={t('inventory.tileView')}>
                  <LayoutGrid className="w-4 h-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label={t('inventory.listView')}>
                  <List className="w-4 h-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Product grid or list */}
          {viewMode === 'tile' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const low = isLowStock(product);
                return (
                  <Card
                    key={product.id}
                    className="shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group cursor-pointer"
                    onClick={() => setDetailProduct(product)}
                  >
                    <CardContent className="p-0">
                      <div className="aspect-square bg-muted/50 relative flex items-center justify-center">
                        {product.photo_url ? (
                          <img
                            src={product.photo_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-12 h-12 text-muted-foreground" />
                        )}
                        {low && (
                          <Badge
                            variant="destructive"
                            className="absolute top-2 right-2 gap-1 text-xs"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            {t('inventory.lowStock')}
                          </Badge>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold truncate">{product.name}</h3>
                            <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(product)}>
                                  {t('inventory.editProduct')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteClick(product.id)}
                                >
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', low ? 'bg-destructive' : 'bg-green-500')} aria-hidden />
                            <span className="text-muted-foreground">{t('inventory.stock')}: </span>
                            <span className={cn('font-medium', low && 'text-destructive')}>
                              {product.quantity}
                            </span>
                            {onAdjustStock && (
                              <Popover open={quickAddProduct?.id === product.id} onOpenChange={(open) => { if (!open) { setQuickAddProduct(null); setQuickAddQty(''); } else setQuickAddProduct(product); }}>
                                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-1" title={t('inventory.addMoreStock') ?? 'Add more to stock'}>
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-3" align="start" onClick={(e) => e.stopPropagation()}>
                                  <p className="text-sm font-medium mb-2">{t('inventory.addHowMany') ?? 'How many to add?'}</p>
                                  <div className="flex gap-2">
                                    <Input
                                      type="number"
                                      min={1}
                                      value={quickAddProduct?.id === product.id ? quickAddQty : ''}
                                      onChange={(e) => setQuickAddQty(e.target.value)}
                                      placeholder="0"
                                      className="h-9"
                                    />
                                    <Button size="sm" className="shrink-0" disabled={quickAdding || !(parseInt(quickAddQty, 10) > 0)} onClick={() => handleQuickAdd(product)}>
                                      {quickAdding ? t('common.saving') : (t('inventory.done') ?? 'Done')}
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground">{t('inventory.costPrice')}: </span>
                            <span>${(product.cost ?? 0).toFixed(2)}</span>
                            <span className="text-muted-foreground ml-1">{t('inventory.salePrice')}: </span>
                            <span className="font-medium">${product.price.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 text-sm font-medium">{t('inventory.productName')}</th>
                      <th className="text-left p-3 text-sm font-medium">{t('inventory.sku')}</th>
                      <th className="text-left p-3 text-sm font-medium">{t('inventory.stock')}</th>
                      <th className="text-left p-3 text-sm font-medium">{t('inventory.costPrice')}</th>
                      <th className="text-left p-3 text-sm font-medium">{t('inventory.salePrice')}</th>
                      <th className="w-20 p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const low = isLowStock(product);
                      return (
                        <tr
                          key={product.id}
                          className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                          onClick={() => setDetailProduct(product)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                {product.photo_url ? (
                                  <img
                                    src={product.photo_url}
                                    alt=""
                                    className="w-10 h-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                              <div>
                                <span className="font-medium">{product.name}</span>
                                {low && (
                                  <Badge variant="destructive" className="ml-2 text-xs">
                                    {t('inventory.lowStock')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground font-mono text-sm">{product.sku}</td>
                          <td className="p-3">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn('w-2 h-2 rounded-full shrink-0', low ? 'bg-destructive' : 'bg-green-500')} aria-hidden />
                              <span className={cn('font-medium', low && 'text-destructive')}>
                                {product.quantity}
                              </span>
                              {onAdjustStock && (
                                <Popover open={quickAddProduct?.id === product.id} onOpenChange={(open) => { if (!open) { setQuickAddProduct(null); setQuickAddQty(''); } else setQuickAddProduct(product); }}>
                                  <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('inventory.addMoreStock') ?? 'Add more to stock'}>
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-56 p-3" align="start" onClick={(e) => e.stopPropagation()}>
                                    <p className="text-sm font-medium mb-2">{t('inventory.addHowMany') ?? 'How many to add?'}</p>
                                    <div className="flex gap-2">
                                      <Input
                                        type="number"
                                        min={1}
                                        value={quickAddProduct?.id === product.id ? quickAddQty : ''}
                                        onChange={(e) => setQuickAddQty(e.target.value)}
                                        placeholder="0"
                                        className="h-9"
                                      />
                                      <Button size="sm" className="shrink-0" disabled={quickAdding || !(parseInt(quickAddQty, 10) > 0)} onClick={() => handleQuickAdd(product)}>
                                        {quickAdding ? t('common.saving') : (t('inventory.done') ?? 'Done')}
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </span>
                          </td>
                          <td className="p-3">${(product.cost ?? 0).toFixed(2)}</td>
                          <td className="p-3 font-medium">${product.price.toFixed(2)}</td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(product)}>
                                  {t('inventory.editProduct')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteClick(product.id)}
                                >
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {filteredProducts.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm || stockFilter !== 'all'
                    ? t('inventory.noResults')
                    : t('inventory.emptyState')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

      <InventoryProductForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingProduct(null);
            setInitialBarcodeFromScan(null);
            setInitialPrefilledFromLookup(null);
          }
        }}
        product={editingProduct}
        products={products}
        onSave={handleSaveNew}
        onUpdate={handleSaveUpdate}
        initialBarcodeOrSku={initialBarcodeFromScan ?? undefined}
        initialPrefilledFromLookup={initialPrefilledFromLookup ?? undefined}
      />

      <BarcodeScannerModal
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={handleScanResult}
        title={t('inventory.scanBarcode')}
        beepOnScan
      />

      <Dialog open={!!adjustProduct} onOpenChange={(open) => !open && setAdjustProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('inventory.adjustQuantity')}</DialogTitle>
            <DialogDescription>
              {adjustProduct && (
                <>
                  {adjustProduct.name} · {t('inventory.stock')}: {adjustProduct.quantity}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2 border-b pb-2">
              <Button
                type="button"
                variant={adjustMode === 'delta' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => { setAdjustMode('delta'); setAdjustQty('1'); }}
              >
                {t('inventory.addOrRemove')}
              </Button>
              <Button
                type="button"
                variant={adjustMode === 'count' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => { setAdjustMode('count'); if (adjustProduct) setAdjustQty(String(adjustProduct.quantity)); }}
              >
                {t('inventory.setQuantityTo')}
              </Button>
            </div>
            <div className="space-y-2">
              {adjustMode === 'delta' ? (
                <>
                  <Label>{t('inventory.quantityToAddOrRemove')}</Label>
                  <Input
                    type="number"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder="+5 or -2"
                  />
                </>
              ) : (
                <>
                  <Label>{t('inventory.setQuantityTo')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder={adjustProduct ? String(adjustProduct.quantity) : '0'}
                  />
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustProduct(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAdjustSubmit} disabled={adjusting || !onAdjustStock}>
              {adjusting ? t('common.saving') : adjustMode === 'count' ? t('inventory.inventoryCount') : t('inventory.addQuantity')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InventoryProductDetailModal
        product={detailProduct}
        open={!!detailProduct}
        onOpenChange={(open) => !open && setDetailProduct(null)}
        stockMovements={stockMovements}
        isLowStock={isLowStock}
        onUpdateProduct={onUpdateProduct}
        onEditProduct={handleEdit}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={t('inventory.deleteTitle')}
        description={t('inventory.deleteDescription')}
      />
    </div>
  );
}
