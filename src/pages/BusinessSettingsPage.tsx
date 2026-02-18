import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useSettings } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Tax presets with optional breakdown (e.g. PR: state + municipal). */
const TAX_PRESETS = [
  {
    id: 'pr',
    label: 'Puerto Rico',
    totalRate: 11.5,
    breakdown: [
      { label: 'State (IVU)', rate: 10.5 },
      { label: 'Municipal', rate: 1 },
    ],
  },
  { id: 'us', label: 'US (varies by state)', totalRate: 0, breakdown: [] },
  { id: 'intl', label: 'International (VAT)', totalRate: 0, breakdown: [] },
];

/** Per-state/territory tax breakdown for display. */
const TAX_BREAKDOWN_BY_REGION: { region: string; taxes: { label: string; rate: number }[] }[] = [
  { region: 'Puerto Rico', taxes: [{ label: 'State (IVU)', rate: 10.5 }, { label: 'Municipal', rate: 1 }] },
  { region: 'Alabama', taxes: [{ label: 'State sales tax', rate: 4 }] },
  { region: 'Alaska', taxes: [{ label: 'No state sales tax', rate: 0 }] },
  { region: 'California', taxes: [{ label: 'State', rate: 7.25 }] },
  { region: 'Florida', taxes: [{ label: 'State', rate: 6 }] },
  { region: 'Texas', taxes: [{ label: 'State', rate: 6.25 }] },
  { region: 'New York', taxes: [{ label: 'State', rate: 4 }] },
  { region: 'Other US states', taxes: [{ label: 'Varies by state/local', rate: 0 }] },
];

export function BusinessSettingsPage() {
  const businessId = useBusinessId();
  const { settings, updateSetting } = useSettings();
  const [taxPreset, setTaxPreset] = useState('pr');
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [defaultLowStock, setDefaultLowStock] = useState(settings.default_low_stock_threshold || '5');
  const [exporting, setExporting] = useState(false);
  const [businessName, setBusinessName] = useState(settings.business_name || '');
  const [businessHours, setBusinessHours] = useState(settings.business_hours || '');
  const [savingBusinessInfo, setSavingBusinessInfo] = useState(false);

  useEffect(() => {
    setDefaultLowStock(settings.default_low_stock_threshold || '5');
  }, [settings.default_low_stock_threshold]);

  useEffect(() => {
    setBusinessName(settings.business_name || '');
    setBusinessHours(settings.business_hours || '');
  }, [settings.business_name, settings.business_hours]);

  useEffect(() => {
    if (!businessId) return;
    supabase
      .from('receipt_settings' as any)
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setReceiptHeader((data as any).header_text || '');
          setReceiptFooter((data as any).footer_text || '');
        }
      });
  }, [businessId]);

  const handleSaveBusinessInfo = async () => {
    if (!businessId) return;
    setSavingBusinessInfo(true);
    try {
      const { error: bizError } = await supabase.from('businesses').update({ name: businessName.trim() || undefined, updated_at: new Date().toISOString() }).eq('id', businessId);
      if (bizError) throw bizError;
      await updateSetting('business_name', businessName.trim() || '');
      await updateSetting('business_hours', businessHours.trim() || '');
      toast.success(t('businessSettings.businessInfoSaved'));
    } catch (e: any) {
      toast.error(e?.message || t('common.genericError'));
    } finally {
      setSavingBusinessInfo(false);
    }
  };

  const handleSaveLowStock = async () => {
    if (!businessId) return;
    const v = String(Math.max(0, parseInt(defaultLowStock, 10) || 5));
    await updateSetting('default_low_stock_threshold', v);
    setDefaultLowStock(v);
    toast.success(t('businessSettings.lowStockSaved'));
  };

  const handleSaveReceipt = async () => {
    if (!businessId) return;
    const { error } = await supabase.from('receipt_settings' as any).upsert(
      {
        business_id: businessId,
        header_text: receiptHeader,
        footer_text: receiptFooter,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id' }
    );
    if (error) toast.error(error.message);
    else toast.success(t('businessSettings.receiptSaved'));
  };

  const handleExport = async () => {
    if (!businessId) return;
    setExporting(true);
    try {
      const [inv, clients, appointments] = await Promise.all([
        supabase.from('inventory').select('*').eq('business_id', businessId),
        supabase.from('clients').select('*').eq('business_id', businessId),
        supabase.from('appointments').select('*').eq('business_id', businessId),
      ]);
      const csv = (data: any[], name: string) => {
        if (!data.length) return '';
        const keys = Object.keys(data[0]);
        return [name, keys.join(','), ...data.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
      };
      const content = [
        csv(inv.data || [], 'Products'),
        csv(clients.data || [], 'Customers'),
        csv(appointments.data || [], 'Appointments'),
      ].join('\n\n');
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `business-data-${businessId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('businessSettings.exportSuccess'));
    } catch (e) {
      toast.error(t('common.genericError'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('nav.businessSettings')}</h1>
        <p className="text-muted-foreground mt-1">{t('businessSettings.description')}</p>
      </div>

      {/* Business name & hours at top – editable */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business-name">{t('businessSettings.businessName')}</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Business name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-hours">{t('businessSettings.businessHours')}</Label>
              <Input
                id="business-hours"
                value={businessHours}
                onChange={(e) => setBusinessHours(e.target.value)}
                placeholder="e.g. 9:00 AM - 6:00 PM"
              />
            </div>
          </div>
          <Button className="mt-4" onClick={handleSaveBusinessInfo} disabled={savingBusinessInfo}>
            {savingBusinessInfo ? t('common.saving') : t('common.save')}
          </Button>
        </CardContent>
      </Card>

      {/* Tax */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessSettings.taxConfiguration')}</CardTitle>
          <CardDescription>{t('businessSettings.taxConfigurationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('businessSettings.taxPreset')}</Label>
            <Select value={taxPreset} onValueChange={setTaxPreset}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.breakdown.length ? `${p.label} (${p.breakdown.map((b) => `${b.label} ${b.rate}%`).join(' + ')})` : p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Breakdown by state / territory</p>
            <ul className="text-sm space-y-1.5">
              {TAX_BREAKDOWN_BY_REGION.map((row) => (
                <li key={row.region} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{row.region}:</span>
                  <span className="text-muted-foreground">
                    {row.taxes.length ? row.taxes.map((t) => `${t.label} ${t.rate}%`).join(', ') : 'Varies'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">{t('businessSettings.taxCustomComingSoon')}</p>
        </CardContent>
      </Card>

      {/* Receipt */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessSettings.receiptCustomization')}</CardTitle>
          <CardDescription>{t('businessSettings.receiptCustomizationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('businessSettings.receiptHeader')}</Label>
            <Textarea value={receiptHeader} onChange={(e) => setReceiptHeader(e.target.value)} placeholder={t('businessSettings.receiptHeaderPlaceholder')} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>{t('businessSettings.receiptFooter')}</Label>
            <Textarea value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} placeholder={t('businessSettings.receiptFooterPlaceholder')} rows={3} />
          </div>
          <Button onClick={handleSaveReceipt}>{t('common.save')}</Button>
        </CardContent>
      </Card>

      {/* Payment setup - placeholder cards */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessSettings.paymentSetup')}</CardTitle>
          <CardDescription>{t('businessSettings.paymentSetupDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'stripe', name: 'Stripe', logo: 'https://dashboard.stripe.com/favicon.ico', comingSoon: true },
              { id: 'ath', name: 'ATH Móvil', logo: 'https://ath.business/favicon.ico', comingSoon: true },
              { id: 'paypal', name: 'PayPal', logo: 'https://www.paypal.com/favicon.ico', comingSoon: true },
            ].map((provider) => (
              <div
                key={provider.id}
                className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/30 p-6 opacity-90"
              >
                {provider.logo ? (
                  <img src={provider.logo} alt="" className="w-12 h-12 object-contain mb-2" />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs font-medium mb-2">
                    {provider.name.slice(0, 2)}
                  </div>
                )}
                <span className="font-medium">{provider.name}</span>
                {provider.comingSoon && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    Coming Soon
                  </Badge>
                )}
                <Button variant="outline" size="sm" className="mt-3 w-full max-w-[120px]" disabled>
                  Set Up
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Global low-stock */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessSettings.lowStockGlobal')}</CardTitle>
          <CardDescription>{t('businessSettings.lowStockGlobalDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>{t('businessSettings.defaultLowStock')}</Label>
            <Input
              type="number"
              min={0}
              value={defaultLowStock}
              onChange={(e) => setDefaultLowStock(e.target.value)}
              className="w-24"
            />
          </div>
          <Button onClick={handleSaveLowStock}>{t('common.save')}</Button>
        </CardContent>
      </Card>

      {/* Data export */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessSettings.dataExport')}</CardTitle>
          <CardDescription>{t('businessSettings.dataExportDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            <Download className="w-4 h-4" />
            {exporting ? t('common.saving') : t('businessSettings.downloadData')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
