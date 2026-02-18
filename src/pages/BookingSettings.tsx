import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { t } from '@/lib/translations';

export function BookingSettings() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('nav.bookingSettings')}</h1>
        <p className="text-muted-foreground mt-1">{t('bookingSettings.description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('bookingSettings.availability')}</CardTitle>
          <CardDescription>{t('bookingSettings.availabilityDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('bookingSettings.bookingWindow')}</Label>
              <Input placeholder="e.g. 30 days" disabled />
            </div>
            <div className="space-y-2">
              <Label>{t('bookingSettings.bufferTime')}</Label>
              <Input placeholder="e.g. 15 min" disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('bookingSettings.options')}</CardTitle>
          <CardDescription>{t('bookingSettings.optionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <Label className="text-base font-medium">{t('bookingSettings.allowOutsideHours')}</Label>
              <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSettings.allowOutsideHoursDescription')}</p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <Label className="text-base font-medium">{t('bookingSettings.allowSameDay')}</Label>
              <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSettings.allowSameDayDescription')}</p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <Label className="text-base font-medium">{t('bookingSettings.requireDeposit')}</Label>
              <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSettings.requireDepositDescription')}</p>
            </div>
            <Switch disabled />
          </div>
          <p className="text-sm text-muted-foreground">{t('bookingSettings.comingSoon')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
