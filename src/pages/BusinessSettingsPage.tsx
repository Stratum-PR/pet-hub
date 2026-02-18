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
import { Download, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TaxAppliesTo } from '@/types/transactions';

interface TaxRow {
  id: string | null;
  label: string;
  rate: number;
  applies_to: TaxAppliesTo;
  enabled: boolean;
  sort_order: number;
}

const TAX_MODE_REGION = 'region';
const TAX_MODE_CUSTOM = 'custom';
const REGION_PUERTO_RICO = 'puerto_rico';

const PUERTO_RICO_TAXES: Omit<TaxRow, 'id'>[] = [
  { label: 'State Tax', rate: 10.5, applies_to: 'both', enabled: true, sort_order: 0 },
  { label: 'Municipal Tax', rate: 1, applies_to: 'both', enabled: true, sort_order: 1 },
];

function isPuertoRicoTaxSetup(rows: { label: string; rate: number }[]): boolean {
  if (rows.length !== 2) return false;
  const rates = [rows[0].rate, rows[1].rate].map((r) => Math.round(r * 100));
  const prRates = [10.5, 1].map((r) => Math.round(r * 100));
  const hasRate1 = rates.some((r) => r === prRates[0]);
  const hasRate2 = rates.some((r) => r === prRates[1]);
  return hasRate1 && hasRate2;
}

export function BusinessSettingsPage() {
  const businessId = useBusinessId();
  const { settings, updateSetting } = useSettings();
  const [taxMode, setTaxMode] = useState<'region' | 'custom'>(TAX_MODE_REGION);
  const [taxRegion, setTaxRegion] = useState<string | null>(REGION_PUERTO_RICO);
  const [customTaxRows, setCustomTaxRows] = useState<TaxRow[]>([]);
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxSaving, setTaxSaving] = useState(false);
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

  useEffect(() => {
    if (!businessId) return;
    setTaxLoading(true);
    supabase
      .from('tax_settings' as any)
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        setTaxLoading(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        const rows = (data || []).map((r: any) => ({
          id: r.id,
          label: r.label || '',
          rate: Number(r.rate) || 0,
          applies_to: (r.applies_to || 'both') as TaxAppliesTo,
          enabled: r.enabled !== false,
          sort_order: r.sort_order ?? 0,
        }));
        if (isPuertoRicoTaxSetup(rows)) {
          setTaxMode(TAX_MODE_REGION);
          setTaxRegion(REGION_PUERTO_RICO);
        } else {
          setTaxMode(TAX_MODE_CUSTOM);
          setCustomTaxRows(rows);
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

  const handleSaveTaxes = async () => {
    if (!businessId) return;
    const rows = taxMode === TAX_MODE_REGION && taxRegion === REGION_PUERTO_RICO ? PUERTO_RICO_TAXES : customTaxRows.filter((r) => r.label.trim());
    if (rows.length === 0) {
      toast.error(t('businessSettings.taxSaveEmpty'));
      return;
    }
    setTaxSaving(true);
    try {
      await supabase.from('tax_settings' as any).delete().eq('business_id', businessId);
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as TaxRow;
        await supabase.from('tax_settings' as any).insert({
          business_id: businessId,
          label: row.label.trim(),
          rate: Math.min(100, Math.max(0, Number(row.rate))),
          applies_to: row.applies_to || 'both',
          enabled: true,
          sort_order: i,
        });
      }
      toast.success(t('businessSettings.taxSaved'));
      if (taxMode === TAX_MODE_REGION) {
        setTaxRegion(REGION_PUERTO_RICO);
      } else {
        const { data } = await supabase.from('tax_settings' as any).select('*').eq('business_id', businessId).order('sort_order', { ascending: true });
        setCustomTaxRows(
          (data || []).map((r: any) => ({
            id: r.id,
            label: r.label || '',
            rate: Number(r.rate) || 0,
            applies_to: (r.applies_to || 'both') as TaxAppliesTo,
            enabled: r.enabled !== false,
            sort_order: r.sort_order ?? 0,
          }))
        );
      }
    } catch (e: any) {
      toast.error(e?.message || t('common.genericError'));
    } finally {
      setTaxSaving(false);
    }
  };

  const updateCustomTaxRow = (index: number, patch: Partial<TaxRow>) => {
    setCustomTaxRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addAnotherTax = () => {
    setCustomTaxRows((prev) => [...prev, { id: null, label: '', rate: 0, applies_to: 'both', enabled: true, sort_order: prev.length }]);
  };

  const removeCustomTaxRow = (index: number) => {
    setCustomTaxRows((prev) => prev.filter((_, i) => i !== index));
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
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>{t('businessSettings.taxMode')}</Label>
              <Select value={taxMode} onValueChange={(v: 'region' | 'custom') => setTaxMode(v)}>
                <SelectTrigger className="w-full min-w-[140px] max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TAX_MODE_REGION}>{t('businessSettings.taxModeRegion')}</SelectItem>
                  <SelectItem value={TAX_MODE_CUSTOM}>{t('businessSettings.taxModeCustom')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {taxMode === TAX_MODE_REGION && (
              <div className="space-y-2">
                <Label>{t('businessSettings.taxRegion')}</Label>
                <Select value={taxRegion ?? ''} onValueChange={setTaxRegion}>
                  <SelectTrigger className="w-full min-w-[140px] max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={REGION_PUERTO_RICO}>{t('businessSettings.taxRegionPuertoRico')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {taxMode === TAX_MODE_REGION && taxRegion === REGION_PUERTO_RICO && (
                <div className="space-y-3">
                  {PUERTO_RICO_TAXES.map((row, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
                      <span className="text-sm font-medium min-w-[140px]">{row.label}</span>
                      <span className="text-sm text-muted-foreground">{row.rate}%</span>
                      <Select value={row.applies_to} disabled>
                        <SelectTrigger className="w-[240px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">{t('businessSettings.taxAppliesBoth')}</SelectItem>
                          <SelectItem value="service">{t('businessSettings.taxAppliesService')}</SelectItem>
                          <SelectItem value="product">{t('businessSettings.taxAppliesProduct')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
          )}

          {taxMode === TAX_MODE_CUSTOM && (
            <>
              {taxLoading ? (
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : (
                <div className="space-y-3">
                  {customTaxRows.map((row, index) => (
                    <div key={row.id ?? `new-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
                      <Input
                        placeholder={t('businessSettings.taxNamePlaceholder')}
                        value={row.label}
                        onChange={(e) => updateCustomTaxRow(index, { label: e.target.value })}
                        className="max-w-[180px]"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        placeholder="%"
                        value={row.rate || ''}
                        onChange={(e) => updateCustomTaxRow(index, { rate: parseFloat(e.target.value) || 0 })}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <Select
                        value={row.applies_to}
                        onValueChange={(v: TaxAppliesTo) => updateCustomTaxRow(index, { applies_to: v })}
                      >
                        <SelectTrigger className="w-[240px] min-w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">{t('businessSettings.taxAppliesBoth')}</SelectItem>
                          <SelectItem value="service">{t('businessSettings.taxAppliesService')}</SelectItem>
                          <SelectItem value="product">{t('businessSettings.taxAppliesProduct')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCustomTaxRow(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addAnotherTax} className="gap-1">
                    <Plus className="w-4 h-4" />
                    {t('businessSettings.taxAddAnother')}
                  </Button>
                  {customTaxRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('businessSettings.taxCustomNone')}</p>
                  )}
                </div>
              )}
            </>
          )}

          <Button onClick={handleSaveTaxes} disabled={taxSaving || taxLoading}>
            {taxSaving ? t('common.saving') : t('common.save')}
          </Button>
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
