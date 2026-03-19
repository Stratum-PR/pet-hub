import { useState, useEffect, useMemo } from 'react';
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
import { SidebarLogoPreview } from '@/components/SidebarLogoPreview';
import { TimeKioskPreview } from '@/components/TimeKioskPreview';
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
  const { settings, updateSetting, refetch } = useSettings();
  const [taxMode, setTaxMode] = useState<'region' | 'custom'>(TAX_MODE_REGION);
  const [taxRegion, setTaxRegion] = useState<string | null>(REGION_PUERTO_RICO);
  const [customTaxRows, setCustomTaxRows] = useState<TaxRow[]>([]);
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxSaving, setTaxSaving] = useState(false);
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  type LogoVariant = 'light' | 'dark';
  type LogoPreviewTarget = 'crop' | 'navbar' | 'kiosk';
  const [companyLogoUrlLight, setCompanyLogoUrlLight] = useState<string | null>(() =>
    typeof window !== 'undefined' && isDemoMode() ? '/pet-hub-icon.svg' : null
  );
  // Dark mode logo is optional; if missing, the app will fall back to the light logo.
  const [companyLogoUrlDark, setCompanyLogoUrlDark] = useState<string | null>(null);
  const [logoUploadVariant, setLogoUploadVariant] = useState<LogoVariant>('light');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreviewTarget, setLogoPreviewTarget] = useState<LogoPreviewTarget>('crop');
  const [cropZoomByVariant, setCropZoomByVariant] = useState<Record<LogoVariant, number>>({ light: 1, dark: 1 });
  const [navbarZoomByVariant, setNavbarZoomByVariant] = useState<Record<LogoVariant, number>>({ light: 1, dark: 1 });
  const [kioskZoomByVariant, setKioskZoomByVariant] = useState<Record<LogoVariant, number>>({ light: 1, dark: 1 });
  const [navbarSizeByVariant, setNavbarSizeByVariant] = useState<Record<LogoVariant, number>>({ light: 64, dark: 64 });
  const [kioskLogoHeightByVariant, setKioskLogoHeightByVariant] = useState<Record<LogoVariant, number>>({ light: 48, dark: 48 });
  const [navbarLogoMode, setNavbarLogoMode] = useState<'square' | 'wide'>(() => (settings.navbar_logo_mode as any) || 'square');
  const [navbarLogoSizePx, setNavbarLogoSizePx] = useState(() => settings.navbar_logo_size_px || '80');
  const [logoUploadPreview, setLogoUploadPreview] = useState<{ file: File; objectUrl: string } | null>(null);
  const [defaultLowStock, setDefaultLowStock] = useState(settings.default_low_stock_threshold || '5');
  const [exporting, setExporting] = useState(false);
  const [businessName, setBusinessName] = useState(settings.business_name || '');
  const [hoursPerDay, setHoursPerDay] = useState<Record<DayKey, DayHours>>(() => parseBusinessHours(settings.business_hours));
  const [savingBusinessInfo, setSavingBusinessInfo] = useState(false);
  const todayIso = new Date().toISOString().slice(0, 10);

  // Pay schedule settings (pay periods used by payroll reports).
  const [payScheduleAnchorDate, setPayScheduleAnchorDate] = useState(settings.pay_schedule_anchor_date || todayIso);
  const [payScheduleCadenceWeeks, setPayScheduleCadenceWeeks] = useState(settings.pay_schedule_cadence_weeks || '2');
  const [savingPaySchedule, setSavingPaySchedule] = useState(false);

  useEffect(() => {
    setDefaultLowStock(settings.default_low_stock_threshold || '5');
  }, [settings.default_low_stock_threshold]);

  useEffect(() => {
    setBusinessName(settings.business_name || '');
    setHoursPerDay(parseBusinessHours(settings.business_hours));
  }, [settings.business_name, settings.business_hours]);

  useEffect(() => {
    setPayScheduleAnchorDate(settings.pay_schedule_anchor_date || todayIso);
    setPayScheduleCadenceWeeks(settings.pay_schedule_cadence_weeks || '2');
  }, [settings.pay_schedule_anchor_date, settings.pay_schedule_cadence_weeks, todayIso]);

  useEffect(() => {
    if (!businessId) return;
    Promise.all([
      supabase.from('receipt_settings' as any).select('*').eq('business_id', businessId).maybeSingle(),
      supabase
        .from('settings' as any)
        .select('business_logo_url, business_logo_url_light, business_logo_url_dark')
        .eq('business_id', businessId)
        .maybeSingle(),
      supabase.from('businesses').select('phone, logo_url').eq('id', businessId).maybeSingle(),
    ]).then(([receiptRes, settingsRes, bizRes]) => {
      const receipt = receiptRes.data as any;
      const biz = (bizRes as any).data as any;
      const settingsRow = (settingsRes as any).data as any;
      if (receipt) {
        setReceiptHeader(receipt.header_text || '');
        setReceiptFooter(receipt.footer_text || '');
        setBusinessAddress(receipt.receipt_location || '');
      }
      setBusinessPhone(biz?.phone || receipt?.receipt_phone || '');
      // NOTE: `public.settings` is our single-row-per-business source of truth,
      // but we also keep a fallback to `businesses.logo_url` for backward compatibility.
      const legacyLogoUrl = settingsRow?.business_logo_url ?? biz?.logo_url ?? null;
      const lightLogoUrl = settingsRow?.business_logo_url_light ?? legacyLogoUrl;
      const darkLogoUrl = settingsRow?.business_logo_url_dark ?? null;

      if (isDemoMode() && !lightLogoUrl) {
        setCompanyLogoUrlLight('/pet-hub-icon.svg');
        setCompanyLogoUrlDark(null);
      } else {
        setCompanyLogoUrlLight(lightLogoUrl);
        setCompanyLogoUrlDark(darkLogoUrl);
      }
    });
  }, [businessId]);

  useEffect(() => {
    setNavbarLogoMode((settings.navbar_logo_mode as any) || 'square');
    setNavbarLogoSizePx(settings.navbar_logo_size_px || '80');
  }, [settings.navbar_logo_mode, settings.navbar_logo_size_px]);

  const [businessTimezone, setBusinessTimezone] = useState(settings.timezone || '');
  useEffect(() => {
    setBusinessTimezone(settings.timezone || '');
  }, [settings.timezone]);

  const timezoneOptions = useMemo(() => {
    const fallback = [
      'America/Puerto_Rico',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Santo_Domingo',
      'America/Bogota',
      'America/Mexico_City',
      'America/Panama',
      'Europe/London',
      'Europe/Madrid',
      'Europe/Paris',
      'UTC',
    ];

    const supportedValuesOf = (Intl as any)?.supportedValuesOf as ((key: string) => string[]) | undefined;
    const list = supportedValuesOf ? supportedValuesOf('timeZone') : fallback;
    const unique = Array.from(new Set([...(list || []), ...fallback]));
    // Ensure current value is selectable even if not in supported list.
    if (businessTimezone) unique.unshift(businessTimezone);
    return Array.from(new Set(unique)).filter(Boolean);
  }, [businessTimezone]);

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
      const nameRes = await updateSetting('business_name', businessName.trim() || '');
      if (!nameRes.ok) throw new Error(nameRes.error);
      const hoursRes = await updateSetting('business_hours', serializeBusinessHours(hoursPerDay));
      if (!hoursRes.ok) throw new Error(hoursRes.error);
      const modeRes = await updateSetting('navbar_logo_mode', navbarLogoMode);
      if (!modeRes.ok) throw new Error(modeRes.error);
      const sizeNum = Math.max(48, Math.min(120, parseInt(navbarLogoSizePx || '80', 10) || 80));
      const sizeRes = await updateSetting('navbar_logo_size_px', String(sizeNum));
      if (!sizeRes.ok) throw new Error(sizeRes.error);
      const tzRes = await updateSetting('timezone', businessTimezone.trim());
      if (!tzRes.ok) throw new Error(tzRes.error);
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
    const res = await updateSetting('default_low_stock_threshold', v);
    if (!res.ok) {
      toast.error(res.error || t('common.genericError'));
      return;
    }
    setDefaultLowStock(v);
    toast.success(t('businessSettings.lowStockSaved'));
  };

  const handleSavePaySchedule = async () => {
    if (!businessId) return;
    setSavingPaySchedule(true);
    try {
      const anchorRes = await updateSetting('pay_schedule_anchor_date', payScheduleAnchorDate);
      if (!anchorRes.ok) {
        toast.error(anchorRes.error || t('common.genericError'));
        return;
      }
      const cadenceRes = await updateSetting('pay_schedule_cadence_weeks', payScheduleCadenceWeeks);
      if (!cadenceRes.ok) {
        toast.error(cadenceRes.error || t('common.genericError'));
        return;
      }
      await refetch();
      toast.success(t('businessSettings.payScheduleSaved'));
    } catch (e: any) {
      toast.error(e?.message || t('common.genericError'));
    } finally {
      setSavingPaySchedule(false);
    }
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

  const openLogoUploadPreview = (variant: LogoVariant) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoUploadVariant(variant);
    setLogoPreviewTarget('crop');
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
      const scale = cropZoomByVariant[logoUploadVariant] ?? 1;
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
      const variant = logoUploadVariant;
      const path = `${businessId}/logo_${variant}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('business-logos').upload(path, blob, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('business-logos').getPublicUrl(path);
      if (variant === 'light') {
        // Keep legacy fields in sync with the light logo for backward compatibility.
        const { error: updateError } = await supabase
          .from('businesses' as any)
          .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', businessId);
        if (updateError) throw updateError;

        const legacyRes = await updateSetting('business_logo_url', publicUrl);
        if (!legacyRes.ok) throw new Error(legacyRes.error || 'Failed saving legacy logo setting');
      }

      const key = variant === 'light' ? 'business_logo_url_light' : 'business_logo_url_dark';
      const logoRes = await updateSetting(key, publicUrl);
      if (!logoRes.ok) throw new Error(logoRes.error || 'Failed saving logo setting');

      if (variant === 'light') setCompanyLogoUrlLight(publicUrl);
      else setCompanyLogoUrlDark(publicUrl);

      toast.success(t('businessSettings.logoUploaded'));
      closeLogoUploadPreview();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.genericError');
      if (msg.includes('schema cache') && (msg.includes('business_logo_url_dark') || msg.includes('business_logo_url_light'))) {
        toast.error(
          "Logo fields aren't available yet. Apply the latest Supabase migrations and reload the schema cache, then try again."
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async (variant: LogoVariant) => {
    if (!businessId) return;
    const companyLogoUrl = variant === 'light' ? companyLogoUrlLight : companyLogoUrlDark;
    if (!companyLogoUrl) return;
    setLogoUploading(true);
    try {
      const pathMatch = companyLogoUrl.match(/\/storage\/v1\/object\/public\/business-logos\/(.+)$/);
      const path = pathMatch ? pathMatch[1] : null;
      if (path) await supabase.storage.from('business-logos').remove([path]);

      if (variant === 'light') {
        await supabase.from('businesses').update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', businessId);
        const legacyRes = await updateSetting('business_logo_url', null);
        if (!legacyRes.ok) throw new Error(legacyRes.error || 'Failed clearing legacy logo setting');
      }

      const key = variant === 'light' ? 'business_logo_url_light' : 'business_logo_url_dark';
      const logoRes = await updateSetting(key, null);
      if (!logoRes.ok) throw new Error(logoRes.error || 'Failed clearing logo setting');

      if (variant === 'light') setCompanyLogoUrlLight(null);
      else setCompanyLogoUrlDark(null);

      setCropZoomByVariant((prev) => ({ ...prev, [variant]: 1 }));
      toast.success(t('businessSettings.logoDeleted'));
    } catch (err: unknown) {
      toast.error(t('common.genericError'));
    } finally {
      setLogoUploading(false);
    }
  };

  const adjustZoom = (dir: -1 | 1) => {
    const clamp = (v: number) => Math.max(0.5, Math.min(2, v));
    const step = 0.25 * dir;
    const variant = logoUploadVariant;
    if (logoPreviewTarget === 'crop') {
      setCropZoomByVariant((prev) => ({ ...prev, [variant]: clamp((prev[variant] ?? 1) + step) }));
      return;
    }
    if (logoPreviewTarget === 'navbar') {
      setNavbarZoomByVariant((prev) => ({ ...prev, [variant]: clamp((prev[variant] ?? 1) + step) }));
      return;
    }
    setKioskZoomByVariant((prev) => ({ ...prev, [variant]: clamp((prev[variant] ?? 1) + step) }));
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Navbar logo mode</Label>
                    <Select value={navbarLogoMode} onValueChange={(v: 'square' | 'wide') => setNavbarLogoMode(v)}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="wide">Wide (wordmark)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Navbar logo size</Label>
                    <Input
                      type="number"
                      min={48}
                      max={120}
                      value={navbarLogoSizePx}
                      onChange={(e) => setNavbarLogoSizePx(e.target.value)}
                      className="w-full max-w-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Business timezone</Label>
                    <Select value={businessTimezone || ''} onValueChange={setBusinessTimezone}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[320px]">
                        {timezoneOptions.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">This should match your business’s local time.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">Light mode</div>
                    <div className="relative flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50">
                      {(companyLogoUrlLight || (typeof window !== 'undefined' && isDemoMode())) ? (
                        <img
                          src={companyLogoUrlLight || '/pet-hub-icon.svg'}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('businessSettings.logoNoImage')}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept={ACCEPT_IMAGES}
                        className="hidden"
                        id="logo-upload-light"
                        onChange={openLogoUploadPreview('light')}
                        disabled={logoUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 w-fit"
                        onClick={() => document.getElementById('logo-upload-light')?.click()}
                        disabled={logoUploading}
                      >
                        <Upload className="h-4 w-4" />
                        {companyLogoUrlLight ? t('businessSettings.logoReplace') : t('businessSettings.logoUpload')}
                      </Button>
                      {companyLogoUrlLight && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive w-fit"
                          onClick={() => handleLogoDelete('light')}
                          disabled={logoUploading}
                        >
                          <X className="h-4 w-4" />
                          {t('businessSettings.logoDelete')}
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">{t('businessSettings.logoMax5MB')}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">Dark mode</div>
                    <div className="relative flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50">
                      {(companyLogoUrlDark || companyLogoUrlLight || (typeof window !== 'undefined' && isDemoMode())) ? (
                        <img
                          src={companyLogoUrlDark || companyLogoUrlLight || '/pet-hub-icon.svg'}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('businessSettings.logoNoImage')}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept={ACCEPT_IMAGES}
                        className="hidden"
                        id="logo-upload-dark"
                        onChange={openLogoUploadPreview('dark')}
                        disabled={logoUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 w-fit"
                        onClick={() => document.getElementById('logo-upload-dark')?.click()}
                        disabled={logoUploading}
                      >
                        <Upload className="h-4 w-4" />
                        {companyLogoUrlDark ? t('businessSettings.logoReplace') : t('businessSettings.logoUpload')}
                      </Button>
                      {companyLogoUrlDark && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive w-fit"
                          onClick={() => handleLogoDelete('dark')}
                          disabled={logoUploading}
                        >
                          <X className="h-4 w-4" />
                          {t('businessSettings.logoDelete')}
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">{t('businessSettings.logoMax5MB')}</p>
                    </div>
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
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>{t('businessSettings.logoAdjustPreview')}</DialogTitle>
              </DialogHeader>
              {logoUploadPreview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center justify-center">
                      <SidebarLogoPreview
                        logoUrl={logoUploadPreview.objectUrl}
                        zoom={navbarZoomByVariant[logoUploadVariant] ?? 1}
                        sizePx={Math.max(48, Math.min(120, parseInt(navbarLogoSizePx || '80', 10) || 80))}
                        mode={navbarLogoMode}
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-4 overflow-auto max-h-[520px]">
                      <TimeKioskPreview
                        logoUrl={logoUploadPreview.objectUrl}
                        zoom={kioskZoomByVariant[logoUploadVariant] ?? 1}
                        logoHeightPx={kioskLogoHeightByVariant[logoUploadVariant] ?? 48}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={logoPreviewTarget === 'crop' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLogoPreviewTarget('crop')}
                      >
                        Crop (saved)
                      </Button>
                      <Button
                        type="button"
                        variant={logoPreviewTarget === 'navbar' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLogoPreviewTarget('navbar')}
                      >
                        Navbar preview
                      </Button>
                      <Button
                        type="button"
                        variant={logoPreviewTarget === 'kiosk' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLogoPreviewTarget('kiosk')}
                      >
                        Punch clock preview
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => adjustZoom(-1)}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="flex-1 text-center text-sm text-muted-foreground">
                      {Math.round(
                        (logoPreviewTarget === 'crop'
                          ? cropZoomByVariant[logoUploadVariant]
                          : logoPreviewTarget === 'navbar'
                            ? navbarZoomByVariant[logoUploadVariant]
                            : kioskZoomByVariant[logoUploadVariant]) * 100
                      )}
                      %
                    </span>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => adjustZoom(1)}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Navbar logo size</div>
                        <input
                          type="range"
                          min={48}
                          max={120}
                          value={Math.max(48, Math.min(120, parseInt(navbarLogoSizePx || '80', 10) || 80))}
                          onChange={(e) => setNavbarLogoSizePx(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Punch clock logo height</div>
                        <input
                          type="range"
                          min={24}
                          max={96}
                          value={kioskLogoHeightByVariant[logoUploadVariant] ?? 48}
                          onChange={(e) =>
                            setKioskLogoHeightByVariant((prev) => ({ ...prev, [logoUploadVariant]: parseInt(e.target.value, 10) || 48 }))
                          }
                          className="w-full"
                        />
                      </div>
                    </div>
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

      {/* Pay Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessSettings.paySchedule')}</CardTitle>
          <CardDescription>{t('businessSettings.payScheduleDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('businessSettings.payScheduleAnchorDate')}</Label>
            <Input
              type="date"
              value={payScheduleAnchorDate}
              onChange={(e) => setPayScheduleAnchorDate(e.target.value)}
              className="w-56"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('businessSettings.payScheduleCadenceWeeks')}</Label>
            <Select value={payScheduleCadenceWeeks} onValueChange={setPayScheduleCadenceWeeks}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t('businessSettings.payScheduleCadenceWeeks')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t('businessSettings.cadenceEvery1Week')}</SelectItem>
                <SelectItem value="2">{t('businessSettings.cadenceEvery2Weeks')}</SelectItem>
                <SelectItem value="3">{t('businessSettings.cadenceEvery3Weeks')}</SelectItem>
                <SelectItem value="4">{t('businessSettings.cadenceEvery4Weeks')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSavePaySchedule} disabled={savingPaySchedule} className="gap-2">
            {savingPaySchedule ? t('common.saving') : t('businessSettings.payScheduleSave')}
          </Button>
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
