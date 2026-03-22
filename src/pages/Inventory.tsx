import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Package, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import { BarcodeScanIcon } from '@/components/icons/BarcodeScanIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
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
import { InventoryItemExpanded } from '@/components/InventoryItemExpanded';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { PawLoadedContent } from '@/components/PawLoadedContent';
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
import { usePageLoadRef } from '@/hooks/usePageLoad';

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
  /** When true, shows the same paw loader + reveal pattern as Pets. */
  loading?: boolean;
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
  loading = false,
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const pageLoadRef = usePageLoadRef();
  const [searchParams, setSearchParams] = useSearchParams();

  const editingLive = useMemo(
    () => (editProduct ? products.find((p) => p.id === editProduct.id) ?? editProduct : null),
    [editProduct, products]
  );

  // Deep link from notifications: ?product=id
  useEffect(() => {
    const productId = searchParams.get('product');
    if (!productId || products.length === 0) return;
    const p = products.find((x) => x.id === productId);
    const next = new URLSearchParams(searchParams);
    next.delete('product');
    setSearchParams(next, { replace: true });
    if (!p) return;
    setEditProduct(p);
  }, [searchParams, products, setSearchParams]);

  useEffect(() => {
    const el = pageLoadRef.current;
    if (!el) return;
    el.removeAttribute('data-page-visible');
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => el.setAttribute('data-page-visible', ''));
    });
    return () => cancelAnimationFrame(raf);
  }, [viewMode]);
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

  const handleAddProduct = () => {
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
    setInitialBarcodeFromScan(null);
  };

  const handleInlineSave = (id: string, data: Partial<Product>, photoFile?: File) => {
    onUpdateProduct(id, data);
    if (photoFile && onUploadProductPhoto) {
      onUploadProductPhoto(id, photoFile).then((url) => {
        if (url) onUpdateProduct(id, { photo_url: url });
      });
    }
    toast.success(t('common.saved') ?? 'Saved');
    setEditProduct(null);
  };

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      onDeleteProduct(productToDelete);
      if (editProduct?.id === productToDelete) setEditProduct(null);
      setProductToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const thresholdFor = (p: Product) => {
    if (p.reorder_level != null && p.reorder_level >= 0) return p.reorder_level;
    return defaultLowStockThreshold;
  };
  const isLowStock = (p: Product) => p.quantity <= thresholdFor(p);

  return (
    <PawLoadedContent
      loading={loading}
      loaderLabel={t('common.loading')}
      loaderWrapperClassName="min-h-[240px]"
    >
    <div ref={pageLoadRef} data-transition-root className="space-y-4 animate-fade-in">
      {/* Single-line toolbar: search grows; controls fixed width */}
      <div
        className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2"
        data-page-toolbar
        data-page-search
      >
        <SearchFilter
          variant="toolbar"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder={t('inventory.searchPlaceholder')}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative !h-9 !min-h-9 !w-auto !min-w-0 shrink-0 !rounded-lg border border-border/50 bg-white/70 p-0 backdrop-blur-sm hover:bg-accent dark:bg-background/50 aspect-[3/2] [&_svg]:!h-full [&_svg]:!w-full"
          title={t('inventory.scanBarcode')}
          onClick={() => setScanOpen(true)}
        >
          <span className="pointer-events-none absolute inset-1 flex items-center justify-center">
            <BarcodeScanIcon />
          </span>
        </Button>
        <Select value={stockFilter} onValueChange={(v: any) => setStockFilter(v)}>
          <SelectTrigger className="h-9 w-[118px] shrink-0 border-border/50 bg-white/70 px-2 text-xs backdrop-blur-sm dark:bg-background/50 sm:text-sm">
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
          className="h-9 shrink-0 rounded-md border border-border/50 bg-white/50 p-0.5 backdrop-blur-sm dark:bg-background/40"
        >
          <ToggleGroupItem value="tile" className="h-8 w-8 px-0" aria-label={t('inventory.tileView')}>
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" className="h-8 w-8 px-0" aria-label={t('inventory.listView')}>
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button type="button" onClick={handleAddProduct} className="h-9 shrink-0 gap-1.5 px-2.5 shadow-sm sm:px-3">
          <Plus className="h-4 w-4" />
          <span className="max-[480px]:sr-only sm:inline">{t('inventory.addProduct')}</span>
        </Button>
      </div>

      <div className="space-y-4" data-page-content>
          {viewMode === 'tile' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-page-cards-grid>
              {filteredProducts.map((product) => {
                const low = isLowStock(product);
                return (
                  <Card
                    key={product.id}
                    className="group cursor-pointer overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <CardContent className="p-0">
                      <button
                        type="button"
                        className="flex w-full cursor-pointer flex-col text-left"
                        onClick={() => setEditProduct(product)}
                      >
                        <div className="relative flex w-full shrink-0 items-center justify-center bg-muted/50 px-4 py-3">
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted">
                            {product.photo_url ? (
                              <img
                                src={product.photo_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            {low && (
                              <Badge
                                variant="destructive"
                                className="absolute -right-1.5 -top-1.5 gap-0.5 px-1.5 py-0 text-[10px] leading-tight"
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {t('inventory.lowStock')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="w-full min-w-0 p-4 pt-2">
                          <h3 className="truncate font-semibold">{product.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {t('inventory.sku')}: {product.sku}
                          </p>
                          <div className="mt-2 flex w-full min-w-0 items-center justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={cn('h-2 w-2 shrink-0 rounded-full', low ? 'bg-destructive' : 'bg-green-500')}
                                aria-hidden
                              />
                              <span className="shrink-0 text-muted-foreground">{t('inventory.stock')}:</span>
                              <span className={cn('min-w-0 truncate font-medium tabular-nums', low && 'text-destructive')}>
                                {product.quantity}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">${product.price.toFixed(2)}</span>
                          </div>
                        </div>
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto" data-table-load>
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left text-sm font-medium">{t('inventory.productName')}</th>
                      <th className="p-3 text-left text-sm font-medium">{t('inventory.sku')}</th>
                      <th className="p-3 text-left text-sm font-medium">{t('inventory.stock')}</th>
                      <th className="p-3 text-left text-sm font-medium">{t('inventory.costPrice')}</th>
                      <th className="p-3 text-left text-sm font-medium">{t('inventory.salePrice')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const low = isLowStock(product);
                      return (
                        <tr
                          key={product.id}
                          className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30"
                          onClick={() => setEditProduct(product)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                {product.photo_url ? (
                                  <img src={product.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                                ) : (
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium">{product.name}</span>
                                {low && (
                                  <Badge variant="destructive" className="ml-2 text-xs">
                                    {t('inventory.lowStock')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-sm text-muted-foreground">{product.sku}</td>
                          <td className="p-3">
                            <span className="flex items-center gap-1.5">
                              <span
                                className={cn('h-2 w-2 shrink-0 rounded-full', low ? 'bg-destructive' : 'bg-green-500')}
                                aria-hidden
                              />
                              <span className={cn('font-medium', low && 'text-destructive')}>{product.quantity}</span>
                            </span>
                          </td>
                          <td className="p-3">${(product.cost ?? 0).toFixed(2)}</td>
                          <td className="p-3 font-medium">${product.price.toFixed(2)}</td>
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

      <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-3xl">
          <div className="shrink-0 border-b border-border px-6 pb-4 pt-6 pr-14">
            <DialogHeader>
              <DialogTitle>{editingLive?.name ?? t('inventory.editProduct')}</DialogTitle>
              <DialogDescription>{t('inventory.editProductDescription')}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-6">
            {editingLive && (
              <InventoryItemExpanded
                className="px-0 pb-0 pt-0 sm:px-0"
                product={editingLive}
                products={products}
                stockMovements={stockMovements}
                isLowStock={isLowStock}
                onSave={handleInlineSave}
                onRequestDelete={() => handleDeleteClick(editingLive.id)}
                onUploadProductPhoto={onUploadProductPhoto}
                onAdjustStock={onAdjustStock}
                onQuantityUpdated={(id, qty) => onUpdateProduct(id, { quantity: qty })}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <InventoryProductForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setInitialBarcodeFromScan(null);
            setInitialPrefilledFromLookup(null);
          }
        }}
        product={null}
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

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={t('inventory.deleteTitle')}
        description={t('inventory.deleteDescription')}
      />
    </div>
    </PawLoadedContent>
  );
}
