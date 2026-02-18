import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/translations';

export function Billing() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('billing.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('billing.description')}</p>
      </div>

      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('billing.currentPlan')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border-2 border-primary/30 bg-primary/10 px-4 py-4 text-center">
            <p className="text-2xl font-bold tracking-tight text-primary">{t('billing.standardPlan')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('billing.renewalPlaceholder')}</p>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">{t('billing.upgradeDowngrade')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('billing.invoiceHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">{t('billing.date')}</th>
                <th className="text-left py-2">{t('billing.amount')}</th>
                <th className="text-left py-2">{t('billing.status')}</th>
                <th className="text-left py-2">{t('billing.download')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b text-muted-foreground">
                <td colSpan={4} className="py-6 text-center">{t('billing.noInvoices')}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
