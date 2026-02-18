import { useState, useEffect } from 'react';
import { Product } from '@/types/inventory';
import { useBusinessId } from './useBusinessId';
import { supabase } from '@/integrations/supabase/client';

function uuidv4(): string {
  if (typeof crypto !== 'undefined') {
    const anyCrypto = crypto as unknown as { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array };
    if (typeof anyCrypto.randomUUID === 'function') return anyCrypto.randomUUID();
    if (typeof anyCrypto.getRandomValues === 'function') {
      const buf = new Uint8Array(16);
      anyCrypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      const b = Array.from(buf, (x) => x.toString(16).padStart(2, '0'));
      return `${b[0]}${b[1]}${b[2]}${b[3]}-${b[4]}${b[5]}-${b[6]}${b[7]}-${b[8]}${b[9]}-${b[10]}${b[11]}${b[12]}${b[13]}${b[14]}${b[15]}`;
    }
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-4${s4().slice(1)}-${((8 + Math.random() * 4) | 0).toString(16)}${s4().slice(1)}-${s4()}${s4()}${s4()}`;
}

function mapRowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.product_name,
    sku: row.sku,
    barcode: row.barcode || '',
    price: Number(row.retail_price ?? 0),
    quantity: Number(row.quantity_on_hand ?? 0),
    supplier: row.supplier || '',
    category: row.category || '',
    description: row.description || '',
    cost: row.cost_price ? Number(row.cost_price) : 0,
    reorder_level: row.reorder_level ? Number(row.reorder_level) : 0,
    notes: row.notes || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    folder_id: row.folder_id ?? null,
    photo_url: row.photo_url ?? null,
    custom_fields: row.custom_fields && typeof row.custom_fields === 'object' ? row.custom_fields : undefined,
  };
}

export interface StockMovementRow {
  id: string;
  product_id: string;
  quantity: number;
  movement_type: string;
  supplier?: string | null;
  created_at: string;
}

export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();

  const fetchStockMovements = async () => {
    if (!businessId) return;
    const { data, error } = await supabase
      .from('inventory_stock_movements' as any)
      .select('id, product_id, quantity, movement_type, supplier, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (!error && data) setStockMovements((data as any[]) as StockMovementRow[]);
  };

  const fetchProducts = async () => {
    if (!businessId) return;
    const { data, error } = await supabase
      .from('inventory' as any)
      .select('*')
      .eq('business_id', businessId)
      .order('product_name', { ascending: true });
    if (error) {
      setProducts([]);
      return;
    }
    setProducts((data || []).map(mapRowToProduct));
  };

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchProducts(), fetchStockMovements()]).finally(() => setLoading(false));
  }, [businessId]);

  const addProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;
    const payload: any = {
      business_id: businessId,
      sku: productData.sku,
      product_name: productData.name,
      description: productData.description || null,
      category: productData.category || null,
      brand: null,
      cost_price: productData.cost ?? null,
      retail_price: productData.price,
      sale_price: null,
      quantity_on_hand: productData.quantity,
      reorder_level: productData.reorder_level ?? 0,
      reorder_quantity: 0,
      unit_of_measure: 'unit',
      barcode: productData.barcode || null,
      supplier: productData.supplier || null,
      notes: productData.notes || null,
      is_active: true,
      folder_id: null,
      photo_url: productData.photo_url ?? null,
      custom_fields: productData.custom_fields ?? {},
    };
    const { data, error } = await supabase
      .from('inventory' as any)
      .insert({ id: uuidv4(), ...payload })
      .select()
      .single();
    if (!error && data) {
      const mapped = mapRowToProduct(data);
      setProducts((prev) => [...prev, mapped].sort((a, b) => a.name.localeCompare(b.name)));
      return mapped;
    }
    return null;
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    if (!businessId) return null;
    const patch: any = { updated_at: new Date().toISOString() };
    if (productData.name !== undefined) patch.product_name = productData.name;
    if (productData.sku !== undefined) patch.sku = productData.sku;
    if (productData.description !== undefined) patch.description = productData.description;
    if (productData.category !== undefined) patch.category = productData.category;
    if (productData.cost !== undefined) patch.cost_price = productData.cost;
    if (productData.price !== undefined) patch.retail_price = productData.price;
    if (productData.quantity !== undefined) patch.quantity_on_hand = productData.quantity;
    if (productData.reorder_level !== undefined) patch.reorder_level = productData.reorder_level;
    if (productData.barcode !== undefined) patch.barcode = productData.barcode;
    if (productData.supplier !== undefined) patch.supplier = productData.supplier;
    if (productData.notes !== undefined) patch.notes = productData.notes;
    if (productData.photo_url !== undefined) patch.photo_url = productData.photo_url;
    if (productData.custom_fields !== undefined) patch.custom_fields = productData.custom_fields;

    const { data, error } = await supabase
      .from('inventory' as any)
      .update(patch)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    if (!error && data) {
      const mapped = mapRowToProduct(data);
      setProducts((prev) => prev.map((p) => (p.id === id ? mapped : p)));
      return mapped;
    }
    return null;
  };

  const deleteProduct = async (id: string) => {
    if (!businessId) return false;
    const { error } = await supabase
      .from('inventory' as any)
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);
    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      return true;
    }
    return false;
  };

  const refetch = async () => {
    await Promise.all([fetchProducts(), fetchStockMovements()]);
  };

  const uploadProductPhoto = async (productId: string, file: File): Promise<string | null> => {
    if (!businessId) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const filePath = `${businessId}/${productId}/${fileName}`;
    const { error } = await supabase.storage.from('product-photos').upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (error) {
      console.error('[useInventory] upload error:', error);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from('product-photos').getPublicUrl(filePath);
    return publicUrl;
  };

  return {
    products,
    stockMovements,
    loading,
    uploadProductPhoto,
    addProduct,
    updateProduct,
    deleteProduct,
    refetch,
  };
}
