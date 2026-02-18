export interface InventoryFolder {
  id: string;
  business_id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

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
  /** Folder id for organization (location, category, custom group) */
  folder_id?: string | null;
  /** Main product photo URL */
  photo_url?: string | null;
  /** Custom metadata (e.g. expiration_date, batch_number, animal_type) */
  custom_fields?: Record<string, string | number | boolean | null>;
}
