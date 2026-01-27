import { useState } from 'react';
import { Product } from '@/types/inventory';

// Inventory functionality is disabled - products table doesn't exist in database
// This hook provides stub functions to prevent build errors
export function useInventory() {
  const [products] = useState<Product[]>([]);
  const loading = false;

  const addProduct = async (_productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    console.warn('Inventory functionality is disabled - products table does not exist');
    return null;
  };

  const updateProduct = async (_id: string, _productData: Partial<Product>) => {
    console.warn('Inventory functionality is disabled - products table does not exist');
    return null;
  };

  const deleteProduct = async (_id: string) => {
    console.warn('Inventory functionality is disabled - products table does not exist');
    return false;
  };

  const refetch = async () => {
    console.warn('Inventory functionality is disabled - products table does not exist');
  };

  return { products, loading, addProduct, updateProduct, deleteProduct, refetch };
}
