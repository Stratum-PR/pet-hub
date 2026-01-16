import { useState, useMemo } from 'react';
import { Plus, X, Edit, Trash2, Package, Scan, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Product } from '@/types/inventory';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { SearchFilter } from '@/components/SearchFilter';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';

interface InventoryProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateProduct: (id: string, product: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
}

export function Inventory({ products, onAddProduct, onUpdateProduct, onDeleteProduct }: InventoryProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productRegistryOpen, setProductRegistryOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  const [formData, setFormData] = useState({
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
  });

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term) ||
      product.category?.toLowerCase().includes(term) ||
      product.supplier?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const filteredRegistryProducts = useMemo(() => {
    if (!productSearchQuery) return products;
    const query = productSearchQuery.toLowerCase();
    return products.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.barcode?.toLowerCase().includes(query)
    );
  }, [products, productSearchQuery]);

  const resetForm = () => {
    setFormData({
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
    });
    setSelectedProductId(null);
    setProductSearchQuery('');
  };

  const handleSelectProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProductId(productId);
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        price: product.price,
        quantity: product.quantity,
        supplier: product.supplier || '',
        category: product.category || '',
        description: product.description || '',
        cost: product.cost || 0,
        reorder_level: product.reorder_level || 0,
      });
      setProductRegistryOpen(false);
    }
  };

  const handleAddNewProduct = () => {
    setSelectedProductId(null);
    resetForm();
    setProductRegistryOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      onUpdateProduct(editingProduct.id, formData);
      setEditingProduct(null);
    } else {
      onAddProduct(formData);
    }
    resetForm();
    setShowForm(false);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      price: product.price,
      quantity: product.quantity,
      supplier: product.supplier || '',
      category: product.category || '',
      description: product.description || '',
      cost: product.cost || 0,
      reorder_level: product.reorder_level || 0,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingProduct(null);
    resetForm();
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

  const handleScan = () => {
    setScanning(true);
    // In a real implementation, this would use a barcode/QR scanner library
    // For now, we'll use a manual input approach
    const code = prompt('Enter barcode/QR code:');
    if (code) {
      setScannedCode(code);
      setFormData({ ...formData, barcode: code });
      setScanning(false);
    } else {
      setScanning(false);
    }
  };

  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    setScannedCode(code);
    setFormData({ ...formData, barcode: code });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('inventory.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('inventory.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleScan}
            className="flex items-center gap-2"
          >
            <Scan className="w-4 h-4" />
            {t('inventory.scanBarcode')}
          </Button>
          <Button
            onClick={() => {
              setEditingProduct(null);
              resetForm();
              setShowForm(!showForm);
            }}
            className="shadow-sm flex items-center gap-2"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? t('common.cancel') : t('inventory.addProduct')}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="shadow-sm animate-fade-in">
          <CardHeader>
            <CardTitle>{editingProduct ? t('inventory.editProduct') : t('inventory.addProduct')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingProduct && (
                <div className="space-y-2">
                  <Label>Product Registry</Label>
                  <Popover open={productRegistryOpen} onOpenChange={setProductRegistryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedProductId
                          ? products.find(p => p.id === selectedProductId)?.name || 'Select product...'
                          : 'Search or select from product registry...'}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search products..." 
                          value={productSearchQuery}
                          onValueChange={setProductSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="py-4 text-center text-sm">
                              <p className="mb-2">No product found in registry.</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddNewProduct}
                                className="mt-2"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add New Product to Registry
                              </Button>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredRegistryProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.id}
                                onSelect={() => handleSelectProduct(product.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProductId === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    SKU: {product.sku} {product.category && `• ${product.category}`}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                            <CommandItem
                              value="__add_new__"
                              onSelect={handleAddNewProduct}
                              className="border-t border-border mt-1 pt-2"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              <span className="font-medium">Add New Product to Registry</span>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedProductId && (
                    <p className="text-sm text-muted-foreground">
                      Editing existing product. Modify details below and save to update.
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Dog Shampoo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    required
                    placeholder="DS-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Barcode/QR Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.barcode}
                      onChange={handleBarcodeInput}
                      placeholder="Scan or enter barcode"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleScan}
                      className="flex items-center gap-2"
                    >
                      <Scan className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Shampoo, Food, Toys, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Input
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Supplier name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cost Price ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sale Price ($) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reorder Level</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: Number(e.target.value) })}
                    placeholder="Minimum stock level"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full min-h-[100px] px-3 py-2 text-sm border border-input rounded-md bg-background"
                  placeholder="Product description..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="shadow-sm">
                  {editingProduct ? t('common.edit') + ' ' + t('inventory.title') : t('inventory.addProduct')}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search products by name, SKU, barcode, category, or supplier..."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => {
          const isLowStock = product.reorder_level && product.quantity <= product.reorder_level;
          return (
            <Card key={product.id} className="shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent flex items-center justify-center rounded-lg">
                      <Package className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(product)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(product.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {product.barcode && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Scan className="w-4 h-4" />
                      <span className="font-mono">{product.barcode}</span>
                    </div>
                  )}
                  {product.category && (
                    <div className="text-muted-foreground">
                      Category: {product.category}
                    </div>
                  )}
                  {product.supplier && (
                    <div className="text-muted-foreground">
                      Supplier: {product.supplier}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <p className="text-muted-foreground">Quantity</p>
                      <p className={`text-lg font-semibold ${isLowStock ? 'text-destructive' : ''}`}>
                        {product.quantity}
                        {isLowStock && <span className="text-xs ml-1">(Low Stock)</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Price</p>
                      <p className="text-lg font-semibold">${product.price.toFixed(2)}</p>
                    </div>
                  </div>
                  {product.description && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No products found matching your search.' : 'No products yet. Add your first product above!'}
            </p>
          </CardContent>
        </Card>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Product?"
        description="This will permanently delete this product. This action cannot be undone."
      />
    </div>
  );
}
