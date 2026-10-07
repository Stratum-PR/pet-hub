import { FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/translations';

/** Marks a sale charged in test mode (ATH Móvil simulator): no real money, not counted as revenue. */
export function TestSaleBadge({ className }: { className?: string }) {
  return (
    <Badge
      title={t('transactions.testSaleHint')}
      className={`gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100 ${className ?? ''}`}
    >
      <FlaskConical className="h-3 w-3" /> {t('transactions.testSale')}
    </Badge>
  );
}
