import { Product } from '@/types/inventory';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { format } from 'date-fns';

export interface StockMovement {
  product_id: string;
  quantity: number;
  movement_type: string;
  supplier?: string | null;
  created_at: string;
}

interface InventoryProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockMovements: StockMovement[];
  isLowStock: (p: Product) => boolean;
  onGenerateBarcode?: (product: Product) => void;
}

export function InventoryProductDetailModal({
  product,
  open,
  onOpenChange,
  stockMovements,
  isLowStock,
  onGenerateBarcode,
}: InventoryProductDetailModalProps) {
  if (!product) return null;

  const low = isLowStock(product);
  const movements = stockMovements.filter((m) => m.product_id === product.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-24 h-24 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {product.photo_url ? (
                <img
                  src={product.photo_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-lg truncate">{product.name}</h2>
              <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    low
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-green-500/15 text-green-700 dark:text-green-400'
                  )}
                >
                  {low ? t('inventory.lowStock') : t('inventory.inStock')}
                </span>
                <span className="text-sm font-medium">
                  {t('inventory.stock')}: {product.quantity}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('inventory.barcode')}</h3>
            {product.barcode ? (
              <p className="font-mono text-sm">{product.barcode}</p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('inventory.noBarcode')}</span>
                {onGenerateBarcode && (
                  <button
                    type="button"
                    onClick={() => onGenerateBarcode(product)}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('inventory.generateBarcode')}
                  </button>
                )}
              </div>
            )}
          </div>

          {product.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('inventory.productDescription')}</h3>
              <p className="text-sm">{product.description}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('inventory.orderHistory')}</h3>
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('inventory.noOrderHistory')}</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {movements.map((m) => (
                  <li key={m.created_at + m.quantity} className="flex justify-between text-sm border-b border-border pb-1">
                    <span>
                      {format(new Date(m.created_at), 'MMM d, yyyy')} · {m.movement_type} +{m.quantity}
                      {m.supplier ? ` (${m.supplier})` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
