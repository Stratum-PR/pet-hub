import { useState, useMemo } from 'react';
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
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';

type ViewMode = 'tile' | 'list';

interface InventoryProps {
  products: Product[];
  /** Global default low-stock threshold (used when product has no reorder_level). Default 5. */
  defaultLowStockThreshold?: number;
  onAddProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product | null>;
  onUpdateProduct: (id: string, product: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
  stockMovements?: { product_id: string; quantity: number; movement_type: string; supplier?: string | null; created_at: string }[];
  onUploadProductPhoto?: (productId: string, file: File) => Promise<string | null>;
}

export function Inventory({
  products,
  defaultLowStockThreshold = 5,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
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
    setFormOpen(true);
  };

  const handleSaveNew = async (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>, photoFile?: File) => {
    const created = await onAddProduct(data);
    if (created && photoFile && onUploadProductPhoto) {
      const url = await onUploadProductPhoto(created.id, photoFile);
      if (url) onUpdateProduct(created.id, { photo_url: url });
    }
    setFormOpen(false);
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

  const handleGenerateBarcode = (p: Product) => {
    const code = `PH-${p.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    onUpdateProduct(p.id, { barcode: code });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('inventory.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('inventory.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" title={t('inventory.scanBarcode')}>
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
                          <div className="flex items-center gap-1.5">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', low ? 'bg-destructive' : 'bg-green-500')} aria-hidden />
                            <span className="text-muted-foreground">{t('inventory.stock')}: </span>
                            <span className={cn('font-medium', low && 'text-destructive')}>
                              {product.quantity}
                            </span>
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
                            <span className="flex items-center gap-1.5">
                              <span className={cn('w-2 h-2 rounded-full shrink-0', low ? 'bg-destructive' : 'bg-green-500')} aria-hidden />
                              <span className={cn('font-medium', low && 'text-destructive')}>
                                {product.quantity}
                              </span>
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
            <Card className="border-dashed">
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
          if (!open) setEditingProduct(null);
        }}
        product={editingProduct}
        products={products}
        onSave={handleSaveNew}
        onUpdate={handleSaveUpdate}
      />

      <InventoryProductDetailModal
        product={detailProduct}
        open={!!detailProduct}
        onOpenChange={(open) => !open && setDetailProduct(null)}
        stockMovements={stockMovements}
        isLowStock={isLowStock}
        onGenerateBarcode={handleGenerateBarcode}
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
