import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types/inventory';
import { useBusinessId } from './useBusinessId';

export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const businessId = useBusinessId();

  const fetchProducts = async () => {
    if (!businessId) {
      console.warn('[useInventory] No businessId, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('[useInventory] Fetching inventory for businessId:', businessId);

    const { data, error } = await supabase
      .from('inventory' as any)
      .select('*')
      .eq('business_id', businessId)
      .order('product_name', { ascending: true });
    
    if (error) {
      console.error('[useInventory] Error fetching inventory:', error);
      setProducts([]);
      setLoading(false);
      return;
    }

    if (data) {
      const mapped = (data as any[]).map((row) => ({
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
      })) as Product[];
      setProducts(mapped);
    } else {
      setProducts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [businessId]);

  const addProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    if (!businessId) return null;

    const payload = {
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
    };

    const { data, error } = await supabase
      .from('inventory' as any)
      .insert(payload)
      .select()
      .single();
    
    if (!error && data) {
      const mapped: Product = {
        id: data.id,
        name: data.product_name,
        sku: data.sku,
        barcode: data.barcode || '',
        price: Number(data.retail_price ?? 0),
        quantity: Number(data.quantity_on_hand ?? 0),
        supplier: data.supplier || '',
        category: data.category || '',
        description: data.description || '',
        cost: data.cost_price ? Number(data.cost_price) : 0,
        reorder_level: data.reorder_level ? Number(data.reorder_level) : 0,
        notes: data.notes || '',
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setProducts([...products, mapped].sort((a, b) => a.name.localeCompare(b.name)));
      return mapped;
    }
    return null;
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    if (!businessId) return null;

    const patch: any = {
      updated_at: new Date().toISOString(),
    };

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

    const { data, error } = await supabase
      .from('inventory' as any)
      .update(patch)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    
    if (!error && data) {
      const mapped: Product = {
        id: data.id,
        name: data.product_name,
        sku: data.sku,
        barcode: data.barcode || '',
        price: Number(data.retail_price ?? 0),
        quantity: Number(data.quantity_on_hand ?? 0),
        supplier: data.supplier || '',
        category: data.category || '',
        description: data.description || '',
        cost: data.cost_price ? Number(data.cost_price) : 0,
        reorder_level: data.reorder_level ? Number(data.reorder_level) : 0,
        notes: data.notes || '',
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setProducts(products.map(p => p.id === id ? mapped : p));
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
      setProducts(products.filter(p => p.id !== id));
      return true;
    }
    return false;
  };

  return { products, loading, addProduct, updateProduct, deleteProduct, refetch: fetchProducts };
}
