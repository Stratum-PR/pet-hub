export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  quantity: number;
  supplier?: string;
  category?: string;
  description?: string;
  cost?: number;
  reorder_level?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}
