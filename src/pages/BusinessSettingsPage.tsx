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
import { normalizeTaxLabelForStorage } from '@/lib/taxLabels';
import { isDemoMode } from '@/lib/authRouting';
import { Download, Plus, Trash2, Upload, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GeofencingSettings } from '@/components/GeofencingSettings';
import { KioskManagerPinSettings } from '@/components/KioskManagerPinSettings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { TaxAppliesTo } from '@/types/transactions';
import {
  DAYS_OF_WEEK,
  type DayKey,
  type DayHours,
  parseBusinessHours,
  serializeBusinessHours,
} from '@/lib/businessHours';

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
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(() =>
    typeof window !== 'undefined' && isDemoMode() ? '/pet-hub-icon.svg' : null
  );
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreviewZoom, setLogoPreviewZoom] = useState(1);
  const [logoUploadPreview, setLogoUploadPreview] = useState<{ file: File; objectUrl: string } | null>(null);
  const [defaultLowStock, setDefaultLowStock] = useState(settings.default_low_stock_threshold || '5');
  const [exporting, setExporting] = useState(false);
  const [businessName, setBusinessName] = useState(settings.business_name || '');
  const [hoursPerDay, setHoursPerDay] = useState<Record<DayKey, DayHours>>(() => parseBusinessHours(settings.business_hours));
  const [savingBusinessInfo, setSavingBusinessInfo] = useState(false);

  useEffect(() => {
    setDefaultLowStock(settings.default_low_stock_threshold || '5');
  }, [settings.default_low_stock_threshold]);

  useEffect(() => {
    setBusinessName(settings.business_name || '');
    setHoursPerDay(parseBusinessHours(settings.business_hours));
  }, [settings.business_name, settings.business_hours]);

  useEffect(() => {
    if (!businessId) return;
    Promise.all([
      supabase.from('receipt_settings' as any).select('*').eq('business_id', businessId).maybeSingle(),
      supabase.from('businesses').select('phone, logo_url').eq('id', businessId).maybeSingle(),
    ]).then(([receiptRes, bizRes]) => {
      const receipt = receiptRes.data as any;
      const biz = bizRes.data as any;
      if (receipt) {
        setReceiptHeader(receipt.header_text || '');
        setReceiptFooter(receipt.footer_text || '');
        setBusinessAddress(receipt.receipt_location || '');
      }
      setBusinessPhone(biz?.phone || receipt?.receipt_phone || '');
      const logoUrl = biz?.logo_url || null;
      if (isDemoMode() && !logoUrl) {
        setCompanyLogoUrl('/pet-hub-icon.svg');
      } else {
        setCompanyLogoUrl(logoUrl);
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
          label: normalizeTaxLabelForStorage(r.label || ''),
          rate: Number(r.rate) || 0,
          applies_to: (r.applies_to || 'both') as TaxAppliesTo,
          enabled: r.enabled !== false,
          sort_order: r.sort_order ?? 0,
        }));
        if (rows.length === 0) {
          setTaxMode(TAX_MODE_REGION);
          setTaxRegion(REGION_PUERTO_RICO);
          setCustomTaxRows([]);
        } else if (isPuertoRicoTaxSetup(rows)) {
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
      const { error: bizError } = await supabase
        .from('businesses')
        .update({
          name: businessName.trim() || undefined,
          phone: businessPhone.trim() || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
      if (bizError) throw bizError;
      await updateSetting('business_name', businessName.trim() || '');
      await updateSetting('business_hours', serializeBusinessHours(hoursPerDay));
      await supabase.from('receipt_settings' as any).upsert(
        {
          business_id: businessId,
          receipt_phone: businessPhone.trim() || null,
          receipt_location: businessAddress.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' }
      );
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

  const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB
  const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif';

  const openLogoUploadPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !businessId) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('businessSettings.logoImageOnly'));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t('businessSettings.logoMax5MBError'));
      return;
    }
    setLogoUploadPreview({ file, objectUrl: URL.createObjectURL(file) });
    setLogoPreviewZoom(1);
  };

  const closeLogoUploadPreview = () => {
    if (logoUploadPreview) URL.revokeObjectURL(logoUploadPreview.objectUrl);
    setLogoUploadPreview(null);
  };

  const confirmLogoUpload = async () => {
    if (!logoUploadPreview || !businessId) return;
    setLogoUploading(true);
    try {
      const { file, objectUrl } = logoUploadPreview;
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = rej;
        el.src = objectUrl;
      });
      const scale = logoPreviewZoom;
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2d');
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type || 'image/png', 0.92));
      if (!blob) throw new Error('toBlob failed');
      const ext = file.name.split('.').pop() || 'png';
      const path = `${businessId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('business-logos').upload(path, blob, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('business-logos').getPublicUrl(path);
      const { error: updateError } = await supabase.from('businesses' as any).update({ logo_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', businessId);
      if (updateError) throw updateError;
      setCompanyLogoUrl(publicUrl);
      toast.success(t('businessSettings.logoUploaded'));
      closeLogoUploadPreview();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!businessId || !companyLogoUrl) return;
    setLogoUploading(true);
    try {
      const pathMatch = companyLogoUrl.match(/\/storage\/v1\/object\/public\/business-logos\/(.+)$/);
      const path = pathMatch ? pathMatch[1] : null;
      if (path) await supabase.storage.from('business-logos').remove([path]);
      await supabase.from('businesses').update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', businessId);
      setCompanyLogoUrl(null);
      setLogoPreviewZoom(1);
      toast.success(t('businessSettings.logoDeleted'));
    } catch (err: unknown) {
      toast.error(t('common.genericError'));
    } finally {
      setLogoUploading(false);
    }
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
          label: normalizeTaxLabelForStorage(row.label.trim()),
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
            label: normalizeTaxLabelForStorage(r.label || ''),
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
      {/* Business info: column 1 = name, phone, address, logo; column 2 = business hours (same height or less) */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* First column: name, phone, address, logo */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-name">{t('businessSettings.businessName')}</Label>
                <Input id="business-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-phone">{t('businessSettings.phone')}</Label>
                <Input id="business-phone" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="(787) 555-5555" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-address">{t('businessSettings.address')}</Label>
                <Input id="business-address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="Trujillo Alto, Puerto Rico" />
              </div>
              <div className="space-y-3">
                <Label>{t('businessSettings.companyLogo')}</Label>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="relative flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50">
                    {(companyLogoUrl || (typeof window !== 'undefined' && isDemoMode())) ? (
                      <img
                        src={companyLogoUrl || '/pet-hub-icon.svg'}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('businessSettings.logoNoImage')}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input type="file" accept={ACCEPT_IMAGES} className="hidden" id="logo-upload" onChange={openLogoUploadPreview} disabled={logoUploading} />
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => document.getElementById('logo-upload')?.click()} disabled={logoUploading}>
                      <Upload className="h-4 w-4" />
                      {companyLogoUrl ? t('businessSettings.logoReplace') : t('businessSettings.logoUpload')}
                    </Button>
                    {companyLogoUrl && (
                      <Button type="button" variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={handleLogoDelete} disabled={logoUploading}>
                        <X className="h-4 w-4" />
                        {t('businessSettings.logoDelete')}
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">{t('businessSettings.logoMax5MB')}</p>
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveBusinessInfo} disabled={savingBusinessInfo}>
                {savingBusinessInfo ? t('common.saving') : t('common.save')}
              </Button>
            </div>

            {/* Second column: business hours as compact list */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t('businessSettings.businessHours')}</Label>
              <div className="rounded-md border border-border divide-y divide-border">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="flex items-center gap-2 py-1.5 px-2 min-w-0">
                    <span className="w-20 shrink-0 text-xs font-medium capitalize">{t(`businessSettings.day.${day}`) || day}</span>
                    <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={!!hoursPerDay[day]?.closed}
                        onChange={(e) =>
                          setHoursPerDay((prev) => ({
                            ...prev,
                            [day]: { ...prev[day], closed: e.target.checked, open: prev[day]?.open ?? '09:00', close: prev[day]?.close ?? '18:00' },
                          }))
                        }
                        className="rounded size-3"
                      />
                      {t('businessSettings.closed')}
                    </label>
                    {!hoursPerDay[day]?.closed && (
                      <>
                        <Input type="time" step={900} className="h-7 w-28 min-w-0 text-xs" value={hoursPerDay[day]?.open ?? '09:00'} onChange={(e) => setHoursPerDay((prev) => ({ ...prev, [day]: { ...prev[day], open: e.target.value, close: prev[day]?.close ?? '18:00', closed: false } }))} />
                        <span className="text-muted-foreground text-xs">–</span>
                        <Input type="time" step={900} className="h-7 w-28 min-w-0 text-xs" value={hoursPerDay[day]?.close ?? '18:00'} onChange={(e) => setHoursPerDay((prev) => ({ ...prev, [day]: { ...prev[day], close: e.target.value, open: prev[day]?.open ?? '09:00', closed: false } }))} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Logo upload preview dialog: zoom to adjust margins, then confirm */}
          <Dialog open={!!logoUploadPreview} onOpenChange={(open) => !open && closeLogoUploadPreview()}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('businessSettings.logoAdjustPreview')}</DialogTitle>
              </DialogHeader>
              {logoUploadPreview && (
                <div className="space-y-4">
                  <div className="flex justify-center rounded-lg border border-border bg-muted/30 p-4">
                    <img
                      src={logoUploadPreview.objectUrl}
                      alt=""
                      className="max-h-64 w-full object-contain transition-transform"
                      style={{ transform: `scale(${logoPreviewZoom})` }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setLogoPreviewZoom((z) => Math.max(0.5, z - 0.25))}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="flex-1 text-center text-sm text-muted-foreground">{Math.round(logoPreviewZoom * 100)}%</span>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setLogoPreviewZoom((z) => Math.min(2, z + 0.25))}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={closeLogoUploadPreview}>{t('common.cancel')}</Button>
                <Button onClick={confirmLogoUpload} disabled={logoUploading}>{logoUploading ? t('common.saving') : t('businessSettings.logoUseThis')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Tax and Receipt side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>

      {/* Payment setup - placeholder cards */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessSettings.paymentSetup')}</CardTitle>
          <CardDescription>{t('businessSettings.paymentSetupDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'stripe', type: 'stripe' as const, comingSoon: true },
              { id: 'ath', type: 'ath' as const, comingSoon: true },
              { id: 'paypal', type: 'paypal' as const, comingSoon: true },
            ].map((provider) => (
              <div
                key={provider.id}
                className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/30 p-8 opacity-90"
              >
                {provider.type === 'stripe' && (
                  <span className="text-3xl font-semibold mb-3" style={{ color: '#635bff' }}>Stripe</span>
                )}
                {provider.type === 'ath' && (
                  <img src="https://ath.business/images/marketing/logos-section/ath-movil-bg-white.png" alt="ATH Móvil" className="h-14 w-auto object-contain mb-3" />
                )}
                {provider.type === 'paypal' && (
                  <span className="text-3xl font-semibold mb-3" style={{ color: '#003087' }}>PayPal</span>
                )}
                {provider.comingSoon && (
                  <Badge variant="secondary" className="mt-3 text-xs">
                    Coming Soon
                  </Badge>
                )}
                <Button variant="outline" size="sm" className="mt-4 w-full max-w-[120px]" disabled>
                  Set Up
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time Kiosk Settings */}
      <div className="space-y-6">
        <KioskManagerPinSettings />
        <GeofencingSettings />
      </div>

      {/* Low stock and Data export side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
    </div>
  );
}
