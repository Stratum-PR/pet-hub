import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useSettings } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { normalizeTaxLabelForStorage } from '@/lib/taxLabels';
import { useAuth } from '@/contexts/AuthContext';
import {
  isPublicSlugTakenByOtherBusiness,
  isReservedPublicSlug,
  isValidPublicSlugFormat,
  normalizePublicSlugInput,
  slugifyBusinessBase,
} from '@/lib/businessSlug';
import { useDemoLocalSettingsMode } from '@/hooks/useDemoLocalSettingsMode';
import { useFeatureRollout } from '@/hooks/useFeatureRollout';
import { loadDemoStored, patchDemoStored } from '@/lib/demoLocalSettings';
import { Download, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GeofencingSettings } from '@/components/GeofencingSettings';
import { KioskManagerPinSettings } from '@/components/KioskManagerPinSettings';
import { BusinessBrandingColors } from '@/components/BusinessBrandingColors';
import { BusinessTimezoneCombobox } from '@/components/BusinessTimezoneCombobox';
import { BusinessBrandingAssets } from '@/components/BusinessBrandingAssets';
import { PawStagedLoadingArea } from '@/components/PawStagedLoading';
import { devConsole } from '@/lib/clientDebug';
import type { TaxAppliesTo } from '@/types/transactions';
import {
  DAYS_OF_WEEK,
  type DayKey,
  type DayHours,
  parseBusinessHours,
  serializeBusinessHours,
} from '@/lib/businessHours';
import { DEFAULT_BUSINESS_TIMEZONE } from '@/lib/businessTimezonePicker';
import { cn } from '@/lib/utils';
import {
  buildBusinessPortalUrl,
  generateBusinessPortalQrPngDataUrl,
  generateBusinessPortalQrSvg,
  resolvePortalBaseUrl,
} from '@/lib/qrCode';

type PublicSlugCheckStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'current'
  | 'taken'
  | 'invalid'
  | 'reserved';

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
  const location = useLocation();
  const { businessSlug: routeBusinessSlug } = useParams<{ businessSlug?: string }>();
  const queryClient = useQueryClient();
  const { business } = useAuth();
  const businessId = useBusinessId();
  const demoLocalOnly = useDemoLocalSettingsMode();
  const { settings, updateSetting, saveAllSettings, refetch } = useSettings();
  const { isFeatureVisible } = useFeatureRollout();

  // Punch clock / deep links: scroll to kiosk manager PIN when navigating with #kiosk-manager-pin
  useEffect(() => {
    if (location.hash !== '#kiosk-manager-pin') return;
    const scrollToKiosk = () => {
      document.getElementById('kiosk-manager-pin')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    scrollToKiosk();
    const a = window.setTimeout(scrollToKiosk, 150);
    const b = window.setTimeout(scrollToKiosk, 500);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [location.pathname, location.hash]);
  const [taxMode, setTaxMode] = useState<'region' | 'custom'>(TAX_MODE_REGION);
  const [taxRegion, setTaxRegion] = useState<string | null>(REGION_PUERTO_RICO);
  const [customTaxRows, setCustomTaxRows] = useState<TaxRow[]>([]);
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxSaving, setTaxSaving] = useState(false);
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [mapsEmbedUrl, setMapsEmbedUrl] = useState('');
  const [defaultLowStock, setDefaultLowStock] = useState(settings.default_low_stock_threshold || '5');
  const [exporting, setExporting] = useState(false);
  const [businessName, setBusinessName] = useState(settings.business_name || '');
  const [publicSlug, setPublicSlug] = useState(business?.slug?.trim() || '');
  const [publicSlugCheck, setPublicSlugCheck] = useState<PublicSlugCheckStatus>('idle');
  const [hoursPerDay, setHoursPerDay] = useState<Record<DayKey, DayHours>>(() => parseBusinessHours(settings.business_hours));
  const [savingGeneralBusiness, setSavingGeneralBusiness] = useState(false);
  /** After slug save: brief overlay then full reload so URL and auth cache stay aligned. */
  const [refreshingPublicUrl, setRefreshingPublicUrl] = useState(false);
  const [savingBusinessHours, setSavingBusinessHours] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const todayIso = new Date().toISOString().slice(0, 10);

  // Pay schedule settings (pay periods used by payroll reports).
  const [payScheduleAnchorDate, setPayScheduleAnchorDate] = useState(settings.pay_schedule_anchor_date || todayIso);
  const [payScheduleCadenceWeeks, setPayScheduleCadenceWeeks] = useState(settings.pay_schedule_cadence_weeks || '2');
  const [payrollPdfIncludeLogo, setPayrollPdfIncludeLogo] = useState(() => settings.payroll_pdf_include_logo !== 'false');
  const [kioskWarnOffSchedule, setKioskWarnOffSchedule] = useState(() => settings.kiosk_warn_off_schedule !== 'false');
  const [allowEmployeeMobilePunch, setAllowEmployeeMobilePunch] = useState(
    () => settings.allow_employee_mobile_punch === 'true',
  );
  const [savingPaySchedule, setSavingPaySchedule] = useState(false);

  useEffect(() => {
    setDefaultLowStock(settings.default_low_stock_threshold || '5');
  }, [settings.default_low_stock_threshold]);

  useEffect(() => {
    setBusinessName(settings.business_name || '');
    setHoursPerDay(parseBusinessHours(settings.business_hours));
  }, [settings.business_name, settings.business_hours]);

  useEffect(() => {
    setPublicSlug(business?.slug?.trim() || '');
  }, [business?.slug]);

  useEffect(() => {
    if (demoLocalOnly || !businessId) {
      setPublicSlugCheck('idle');
      return;
    }
    const raw = publicSlug.trim();
    if (!raw) {
      setPublicSlugCheck('idle');
      return;
    }
    const normalized = normalizePublicSlugInput(raw);
    if (!isValidPublicSlugFormat(normalized)) {
      setPublicSlugCheck('invalid');
      return;
    }
    if (isReservedPublicSlug(normalized)) {
      setPublicSlugCheck('reserved');
      return;
    }
    const currentSlug = business?.slug?.trim() ?? '';
    if (normalized === currentSlug) {
      setPublicSlugCheck('current');
      return;
    }

    setPublicSlugCheck('checking');
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const taken = await isPublicSlugTakenByOtherBusiness(supabase, normalized, businessId);
        if (cancelled) return;
        setPublicSlugCheck(taken ? 'taken' : 'available');
      } catch {
        if (!cancelled) setPublicSlugCheck('idle');
      }
    }, 420);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [publicSlug, businessId, business?.slug, demoLocalOnly]);

  useEffect(() => {
    setPayScheduleAnchorDate(settings.pay_schedule_anchor_date || todayIso);
    setPayScheduleCadenceWeeks(settings.pay_schedule_cadence_weeks || '2');
  }, [settings.pay_schedule_anchor_date, settings.pay_schedule_cadence_weeks, todayIso]);

  useEffect(() => {
    setPayrollPdfIncludeLogo(settings.payroll_pdf_include_logo !== 'false');
  }, [settings.payroll_pdf_include_logo]);

  useEffect(() => {
    setKioskWarnOffSchedule(settings.kiosk_warn_off_schedule !== 'false');
  }, [settings.kiosk_warn_off_schedule]);

  useEffect(() => {
    setAllowEmployeeMobilePunch(settings.allow_employee_mobile_punch === 'true');
  }, [settings.allow_employee_mobile_punch]);

  useEffect(() => {
    if (!businessId) return;
    if (demoLocalOnly) {
      const s = loadDemoStored(businessId);
      if (s.receipt_header != null) setReceiptHeader(String(s.receipt_header));
      if (s.receipt_footer != null) setReceiptFooter(String(s.receipt_footer));
      if (s.business_phone != null) setBusinessPhone(String(s.business_phone));
      if (s.business_address != null) setBusinessAddress(String(s.business_address));
      return;
    }
    Promise.all([
      supabase.from('receipt_settings' as any).select('*').eq('business_id', businessId).maybeSingle(),
      supabase.from('businesses').select('phone, maps_embed_url').eq('id', businessId).maybeSingle(),
    ]).then(([receiptRes, bizRes]) => {
      const receipt = receiptRes.data as any;
      const biz = (bizRes as any).data as any;
      if (receipt) {
        setReceiptHeader(receipt.header_text || '');
        setReceiptFooter(receipt.footer_text || '');
        setBusinessAddress(receipt.receipt_location || '');
      }
      setBusinessPhone(biz?.phone || receipt?.receipt_phone || '');
      setMapsEmbedUrl(typeof biz?.maps_embed_url === 'string' ? biz.maps_embed_url : '');
    });
  }, [businessId, demoLocalOnly]);

  useEffect(() => {
    if (!businessId || demoLocalOnly) return;
    let cancelled = false;
    const loadQr = async () => {
      setQrLoading(true);
      const { data, error } = await supabase
        .from('businesses')
        .select('qr_code')
        .eq('id', businessId)
        .maybeSingle();
      if (!cancelled) {
        if (!error && data?.qr_code) {
          setQrCodeSvg(String(data.qr_code));
        } else {
          setQrCodeSvg(null);
        }
        setQrLoading(false);
      }
    };
    void loadQr();
    return () => {
      cancelled = true;
    };
  }, [businessId, demoLocalOnly]);

  const [businessTimezone, setBusinessTimezone] = useState(
    () => settings.timezone?.trim() || DEFAULT_BUSINESS_TIMEZONE
  );
  useEffect(() => {
    setBusinessTimezone(settings.timezone?.trim() || DEFAULT_BUSINESS_TIMEZONE);
  }, [settings.timezone]);

  useEffect(() => {
    if (!businessId) return;
    if (demoLocalOnly) {
      setTaxLoading(true);
      const raw = loadDemoStored(businessId).demo_tax_rows;
      try {
        if (raw) {
          const parsed = JSON.parse(raw) as TaxRow[];
          const rows = parsed.map((r) => ({
            id: r.id ?? null,
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
        } else {
          setTaxMode(TAX_MODE_REGION);
          setTaxRegion(REGION_PUERTO_RICO);
          setCustomTaxRows([]);
        }
      } catch {
        setTaxMode(TAX_MODE_REGION);
        setTaxRegion(REGION_PUERTO_RICO);
        setCustomTaxRows([]);
      }
      setTaxLoading(false);
      return;
    }
    setTaxLoading(true);
    supabase
      .from('tax_settings' as any)
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        setTaxLoading(false);
        if (error) {
          devConsole.error('[BusinessSettings] tax_settings load', error);
          toast.error(t('common.genericError'));
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
  }, [businessId, demoLocalOnly]);

  const handleSaveGeneralBusiness = async () => {
    if (!businessId) return;
    setSavingGeneralBusiness(true);
    try {
      const normalizedTimezone = businessTimezone.trim() || DEFAULT_BUSINESS_TIMEZONE;
      if (demoLocalOnly) {
        const nameRes = await updateSetting('business_name', businessName.trim() || '');
        if (!nameRes.ok) throw new Error(nameRes.error);
        const tzRes = await updateSetting('timezone', normalizedTimezone);
        if (!tzRes.ok) throw new Error(tzRes.error);
        patchDemoStored(businessId, {
          business_phone: businessPhone.trim() || undefined,
          business_address: businessAddress.trim() || undefined,
        });
        toast.success(t('businessSettings.generalBusinessSaved'));
        return;
      }
      const nameTrimmed = businessName.trim() || '';
      const nextSlug = normalizePublicSlugInput(publicSlug.trim());
      if (!isValidPublicSlugFormat(nextSlug)) {
        throw new Error(t('businessSettings.slugInvalid'));
      }
      if (isReservedPublicSlug(nextSlug)) {
        throw new Error(t('businessSettings.slugReserved'));
      }
      if (await isPublicSlugTakenByOtherBusiness(supabase, nextSlug, businessId)) {
        throw new Error(t('businessSettings.slugTaken'));
      }
      const prevSlug = business?.slug?.trim() || null;
      if (prevSlug && prevSlug !== nextSlug) {
        const { error: aliasErr } = await supabase.from('business_slug_aliases').insert({
          old_slug: prevSlug,
          business_id: businessId,
        });
        if (aliasErr && (aliasErr as { code?: string }).code !== '23505') {
          devConsole.warn('[BusinessSettings] slug alias', aliasErr);
        }
      }
      const { error: bizError } = await supabase
        .from('businesses')
        .update({
          name: nameTrimmed || undefined,
          slug: nextSlug,
          phone: businessPhone.trim() || undefined,
          maps_embed_url: mapsEmbedUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
      if (bizError) throw bizError;
      setPublicSlug(nextSlug);

      const nameRes = await updateSetting('business_name', businessName.trim() || '');
      if (!nameRes.ok) throw new Error(nameRes.error);
      const tzRes = await updateSetting('timezone', normalizedTimezone);
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

      await queryClient.invalidateQueries({ queryKey: ['business', businessId] });

      toast.success(t('businessSettings.generalBusinessSaved'));

      const slugChanged = Boolean(routeBusinessSlug && nextSlug !== routeBusinessSlug);
      if (slugChanged) {
        setRefreshingPublicUrl(true);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        await new Promise((r) => setTimeout(r, 1600));
        const prefix = `/${routeBusinessSlug}`;
        const suffix = location.pathname.startsWith(prefix)
          ? location.pathname.slice(prefix.length)
          : '/settings/business';
        const nextPath = `/${nextSlug}${suffix}${location.search}${location.hash}`;
        window.location.assign(`${window.location.origin}${nextPath}`);
        return;
      }
    } catch (e: any) {
      devConsole.error('[BusinessSettings] save general business', e);
      const code = e?.code as string | undefined;
      if (code === '23505') {
        toast.error(t('businessSettings.slugTaken'));
      } else {
        toast.error(t('common.genericError'));
      }
    } finally {
      setSavingGeneralBusiness(false);
    }
  };

  const handleSaveBusinessHours = async () => {
    if (!businessId) return;
    setSavingBusinessHours(true);
    try {
      const hoursRes = await updateSetting('business_hours', serializeBusinessHours(hoursPerDay));
      if (!hoursRes.ok) throw new Error(hoursRes.error);
      toast.success(t('businessSettings.businessHoursSaved'));
    } catch (e: any) {
      devConsole.error('[BusinessSettings] save business hours', e);
      toast.error(t('common.genericError'));
    } finally {
      setSavingBusinessHours(false);
    }
  };

  const handleSaveLowStock = async () => {
    if (!businessId) return;
    const v = String(Math.max(0, parseInt(defaultLowStock, 10) || 5));
    const res = await updateSetting('default_low_stock_threshold', v);
    if (!res.ok) {
      devConsole.warn('[BusinessSettings] default_low_stock_threshold', res.error);
      toast.error(t('common.genericError'));
      return;
    }
    setDefaultLowStock(v);
    toast.success(t('businessSettings.lowStockSaved'));
  };

  const handleKioskWarnOffScheduleChange = async (checked: boolean) => {
    if (!businessId) return;
    const prev = kioskWarnOffSchedule;
    setKioskWarnOffSchedule(checked);
    const res = await updateSetting('kiosk_warn_off_schedule', checked ? 'true' : 'false');
    if (!res.ok) {
      setKioskWarnOffSchedule(prev);
      devConsole.warn('[BusinessSettings] kiosk_warn_off_schedule', res.error);
      toast.error(t('common.genericError'));
      return;
    }
  };

  const handleAllowEmployeeMobilePunchChange = async (checked: boolean) => {
    if (!businessId) return;
    const prev = allowEmployeeMobilePunch;
    setAllowEmployeeMobilePunch(checked);
    const res = await updateSetting('allow_employee_mobile_punch', checked ? 'true' : 'false');
    if (!res.ok) {
      setAllowEmployeeMobilePunch(prev);
      devConsole.warn('[BusinessSettings] allow_employee_mobile_punch', res.error);
      toast.error(t('common.genericError'));
      return;
    }
  };

  const handleSavePaySchedule = async () => {
    if (!businessId) return;
    setSavingPaySchedule(true);
    try {
      const anchorRes = await updateSetting('pay_schedule_anchor_date', payScheduleAnchorDate);
      if (!anchorRes.ok) {
        devConsole.warn('[BusinessSettings] pay_schedule_anchor_date', anchorRes.error);
        toast.error(t('common.genericError'));
        return;
      }
      const cadenceRes = await updateSetting('pay_schedule_cadence_weeks', payScheduleCadenceWeeks);
      if (!cadenceRes.ok) {
        devConsole.warn('[BusinessSettings] pay_schedule_cadence_weeks', cadenceRes.error);
        toast.error(t('common.genericError'));
        return;
      }
      const pdfLogoRes = await updateSetting('payroll_pdf_include_logo', payrollPdfIncludeLogo ? 'true' : 'false');
      if (!pdfLogoRes.ok) {
        devConsole.warn('[BusinessSettings] payroll_pdf_include_logo', pdfLogoRes.error);
        toast.error(t('common.genericError'));
        return;
      }
      await refetch();
      toast.success(t('businessSettings.payScheduleSaved'));
    } catch (e: any) {
      devConsole.error('[BusinessSettings] save pay schedule', e);
      toast.error(t('common.genericError'));
    } finally {
      setSavingPaySchedule(false);
    }
  };

  const handleSaveReceipt = async () => {
    if (!businessId) return;
    if (demoLocalOnly) {
      patchDemoStored(businessId, {
        receipt_header: receiptHeader,
        receipt_footer: receiptFooter,
      });
      toast.success(t('businessSettings.receiptSaved'));
      return;
    }
    const { error } = await supabase.from('receipt_settings' as any).upsert(
      {
        business_id: businessId,
        header_text: receiptHeader,
        footer_text: receiptFooter,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id' }
    );
    if (error) {
      devConsole.error('[BusinessSettings] receipt_settings upsert', error);
      toast.error(t('common.genericError'));
    } else toast.success(t('businessSettings.receiptSaved'));
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
      if (demoLocalOnly) {
        const persistRows: TaxRow[] = rows.map((r, i) => ({
          ...(r as TaxRow),
          id: (r as TaxRow).id ?? null,
          label: normalizeTaxLabelForStorage((r as TaxRow).label.trim()),
          sort_order: i,
        }));
        patchDemoStored(businessId, { demo_tax_rows: JSON.stringify(persistRows) });
        toast.success(t('businessSettings.taxSaved'));
        if (taxMode === TAX_MODE_CUSTOM) {
          setCustomTaxRows(persistRows);
        } else {
          setTaxRegion(REGION_PUERTO_RICO);
        }
        return;
      }
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
      devConsole.error('[BusinessSettings] save taxes', e);
      toast.error(t('common.genericError'));
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
      devConsole.error('[BusinessSettings] export', e);
      toast.error(t('common.genericError'));
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateQrCode = async () => {
    if (!businessId || !business?.slug) return;
    setQrBusy(true);
    try {
      const svg = await generateBusinessPortalQrSvg(
        business.slug,
        settings.primary_color || null,
        resolvePortalBaseUrl(window.location.origin),
        {
          businessName: business.name,
          logoUrl: settings.business_logo_url || null,
        }
      );
      const { error } = await supabase
        .from('businesses')
        .update({
          qr_code: svg,
          qr_generated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
      if (error) throw error;
      setQrCodeSvg(svg);
      toast.success('QR del portal actualizado.');
    } catch (e: any) {
      devConsole.error('[BusinessSettings] generate QR', e);
      toast.error(t('common.genericError'));
    } finally {
      setQrBusy(false);
    }
  };

  const handleDownloadQrPng = async () => {
    if (!business?.slug) return;
    try {
      const pngDataUrl = await generateBusinessPortalQrPngDataUrl(
        business.slug,
        settings.primary_color || null,
        resolvePortalBaseUrl(window.location.origin),
        {
          businessName: business.name,
          logoUrl: settings.business_logo_url || null,
        }
      );
      const a = document.createElement('a');
      a.href = pngDataUrl;
      a.download = `${business.slug}-portal-qr.png`;
      a.click();
    } catch {
      toast.error(t('common.genericError'));
    }
  };

  const handlePrintQr = () => {
    if (!qrCodeSvg || !business?.slug) return;
    const portalUrl = buildBusinessPortalUrl(business.slug, resolvePortalBaseUrl(window.location.origin));
    const popup = window.open('', '_blank', 'width=800,height=600');
    if (!popup) return;
    popup.document.write(`
      <html>
        <head><title>QR ${business.slug}</title></head>
        <body style="font-family: sans-serif; margin: 24px;">
          <h2 style="margin-bottom: 12px;">${business.name}</h2>
          <p style="margin-bottom: 16px;">${portalUrl}</p>
          <div style="width: 320px; height: 320px;">${qrCodeSvg}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <div className="space-y-10 animate-fade-in relative">
      {refreshingPublicUrl ? (
        <div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary shrink-0" aria-hidden />
          <p className="text-sm font-medium text-foreground text-center px-6 max-w-sm">
            {t('businessSettings.refreshingPublicUrl')}
          </p>
        </div>
      ) : null}
        <section id="general" className="scroll-mt-24 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('businessSettings.sectionGeneralTitle')}</CardTitle>
              <CardDescription>{t('businessSettings.sectionGeneralDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-name">{t('businessSettings.businessName')}</Label>
                <Input id="business-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" />
              </div>
              {!demoLocalOnly && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <Label htmlFor="business-public-slug">{t('businessSettings.publicUrl')}</Label>
                      <Input
                        id="business-public-slug"
                        value={publicSlug}
                        onChange={(e) => setPublicSlug(e.target.value)}
                        placeholder="my-grooming-salon"
                        autoComplete="off"
                        spellCheck={false}
                        className={cn(
                          publicSlugCheck === 'taken' && 'border-destructive focus-visible:ring-destructive',
                          (publicSlugCheck === 'available' || publicSlugCheck === 'current') &&
                            'border-emerald-600/60 dark:border-emerald-500/50',
                          (publicSlugCheck === 'invalid' || publicSlugCheck === 'reserved') &&
                            'border-destructive focus-visible:ring-destructive',
                        )}
                        aria-invalid={
                          publicSlugCheck === 'taken' ||
                          publicSlugCheck === 'invalid' ||
                          publicSlugCheck === 'reserved'
                        }
                      />
                      <p className="text-xs text-muted-foreground">{t('businessSettings.publicUrlHint')}</p>
                      {publicSlug.trim() !== '' && publicSlugCheck !== 'idle' && (
                        <p
                          className={cn(
                            'text-xs',
                            publicSlugCheck === 'checking' && 'text-muted-foreground',
                            (publicSlugCheck === 'available' || publicSlugCheck === 'current') &&
                              'text-emerald-600 dark:text-emerald-500',
                            (publicSlugCheck === 'taken' ||
                              publicSlugCheck === 'invalid' ||
                              publicSlugCheck === 'reserved') &&
                              'text-destructive',
                          )}
                          role="status"
                          aria-live="polite"
                        >
                          {publicSlugCheck === 'checking' && t('businessSettings.slugCheckChecking')}
                          {publicSlugCheck === 'available' && t('businessSettings.slugCheckAvailable')}
                          {publicSlugCheck === 'current' && t('businessSettings.slugCheckCurrent')}
                          {publicSlugCheck === 'taken' && t('businessSettings.slugTaken')}
                          {publicSlugCheck === 'invalid' && t('businessSettings.slugCheckInvalidShort')}
                          {publicSlugCheck === 'reserved' && t('businessSettings.slugCheckReservedShort')}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setPublicSlug(slugifyBusinessBase(businessName))}
                    >
                      {t('businessSettings.slugSuggestFromName')}
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="business-phone">{t('businessSettings.phone')}</Label>
                <Input id="business-phone" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="(787) 555-5555" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-address">{t('businessSettings.address')}</Label>
                <Input id="business-address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="Trujillo Alto, Puerto Rico" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maps-embed-url">{t('businessSettings.mapsEmbedUrl')}</Label>
                <Input
                  id="maps-embed-url"
                  value={mapsEmbedUrl}
                  onChange={(e) => setMapsEmbedUrl(e.target.value)}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                />
                <p className="text-xs text-muted-foreground">{t('businessSettings.mapsEmbedUrlHint')}</p>
              </div>
              <div className="space-y-2">
                <Label className="block text-xs text-muted-foreground">{t('businessSettings.timezoneLabel')}</Label>
                <BusinessTimezoneCombobox value={businessTimezone} onChange={setBusinessTimezone} />
                <p className="text-xs text-muted-foreground">{t('businessSettings.timezoneHint')}</p>
              </div>
              <Button
                onClick={handleSaveGeneralBusiness}
                disabled={
                  savingGeneralBusiness ||
                  refreshingPublicUrl ||
                  (!demoLocalOnly &&
                    (publicSlugCheck === 'checking' ||
                      publicSlugCheck === 'taken' ||
                      publicSlugCheck === 'invalid' ||
                      publicSlugCheck === 'reserved'))
                }
              >
                {savingGeneralBusiness || refreshingPublicUrl ? t('common.saving') : t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="business-hours" className="scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>{t('businessSettings.sectionHoursTitle')}</CardTitle>
              <CardDescription>{t('businessSettings.sectionHoursDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border divide-y divide-border max-w-xl">
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
              <Button onClick={handleSaveBusinessHours} disabled={savingBusinessHours}>
                {savingBusinessHours ? t('common.saving') : t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="branding" className="scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>{t('businessSettings.sectionBrandingTitle')}</CardTitle>
              <CardDescription>{t('businessSettings.sectionBrandingDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>{t('businessSettings.companyLogo')}</Label>
                <BusinessBrandingAssets
                  businessId={businessId}
                  demoLocalOnly={demoLocalOnly}
                  settings={settings}
                  updateSetting={updateSetting}
                  refetch={refetch}
                />
              </div>
              <div className="border-t border-border pt-6">
                <Label className="text-base font-medium">{t('businessSettings.colorPaletteSection')}</Label>
                <p className="text-sm text-muted-foreground mb-4">{t('businessSettings.colorPaletteSectionDescription')}</p>
                <BusinessBrandingColors
                  primaryColorInitial={settings.primary_color}
                  secondaryColorInitial={settings.secondary_color}
                  onSaveSettings={(partial) => saveAllSettings(partial)}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="portal-qr" className="scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>QR del Portal de Clientes</CardTitle>
              <CardDescription>
                Comparte el acceso directo a {business?.slug ? `/${business.slug}/portal` : 'tu portal'}. Si cambias el color principal o el logo del negocio, vuelve a generar el QR para reflejar la marca.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-border bg-card">
                  {qrLoading ? (
                    <span className="text-xs text-muted-foreground">Cargando QR...</span>
                  ) : qrCodeSvg ? (
                    <div
                      className="h-40 w-40 [&>svg]:h-full [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Aun no generado</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    Enlace: {business?.slug ? buildBusinessPortalUrl(business.slug, resolvePortalBaseUrl(window.location.origin)) : 'pendiente'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleGenerateQrCode} disabled={!business?.slug || qrBusy}>
                      {qrBusy ? t('common.saving') : 'Generar / Actualizar QR'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownloadQrPng}
                      disabled={!business?.slug}
                    >
                      Descargar PNG
                    </Button>
                    <Button variant="outline" onClick={handlePrintQr} disabled={!qrCodeSvg}>
                      Imprimir
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="inventory" className="scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>{t('businessSettings.sectionInventoryTitle')}</CardTitle>
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
        </section>

        <section id="payroll" className="scroll-mt-24 space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('businessSettings.sectionPayrollTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('businessSettings.sectionPayrollDescription')}</p>
          </div>

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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 max-w-xl">
                <div className="space-y-0.5">
                  <Label htmlFor="payroll-pdf-logo">{t('businessSettings.payrollPdfIncludeLogo')}</Label>
                  <p className="text-sm text-muted-foreground">{t('businessSettings.payrollPdfIncludeLogoDescription')}</p>
                </div>
                <Switch
                  id="payroll-pdf-logo"
                  checked={payrollPdfIncludeLogo}
                  onCheckedChange={setPayrollPdfIncludeLogo}
                />
              </div>
              <Button onClick={handleSavePaySchedule} disabled={savingPaySchedule} className="gap-2">
                {savingPaySchedule ? t('common.saving') : t('businessSettings.payScheduleSave')}
              </Button>
            </CardContent>
          </Card>

          {demoLocalOnly ? (
            <p className="text-sm text-muted-foreground max-w-xl">{t('businessSettings.demoKioskGeofenceNote')}</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('businessSettings.punchClockHeading')}</CardTitle>
                  <CardDescription>{t('businessSettings.punchClockDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="kiosk-warn-off-schedule">{t('businessSettings.kioskWarnOffScheduleEnabledLabel')}</Label>
                      <p className="text-sm text-muted-foreground">{t('businessSettings.kioskWarnOffScheduleDescription')}</p>
                    </div>
                    <Switch
                      id="kiosk-warn-off-schedule"
                      checked={kioskWarnOffSchedule}
                      onCheckedChange={handleKioskWarnOffScheduleChange}
                    />
                  </div>
                  {isFeatureVisible('employee_mobile_punch') && (
                    <div className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 border-t border-border pt-6">
                      <div className="space-y-0.5">
                        <Label htmlFor="allow-employee-mobile-punch">
                          {t('businessSettings.allowEmployeeMobilePunchEnabledLabel')}
                        </Label>
                        <p className="text-sm text-muted-foreground">{t('businessSettings.allowEmployeeMobilePunchDescription')}</p>
                      </div>
                      <Switch
                        id="allow-employee-mobile-punch"
                        checked={allowEmployeeMobilePunch}
                        onCheckedChange={handleAllowEmployeeMobilePunchChange}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <div id="kiosk-manager-pin" className="scroll-mt-24 space-y-3">
                <h3 className="text-sm font-semibold">{t('businessSettings.kioskManagerHeading')}</h3>
                <KioskManagerPinSettings />
              </div>

              {isFeatureVisible('geofencing_settings') || isFeatureVisible('geofencing') ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">{t('businessSettings.geofencingHeading')}</h3>
                  <GeofencingSettings />
                </div>
              ) : null}
            </>
          )}
        </section>

      {(isFeatureVisible('tax_settings') || isFeatureVisible('receipt_personalization')) && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {isFeatureVisible('tax_settings') && (
      <section id="tax" className="scroll-mt-24 min-w-0">
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
                <div className="relative min-h-[200px] py-4">
                  <PawStagedLoadingArea label={t('common.loading')} compact size="sm" />
                </div>
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
      </section>
      )}

      {isFeatureVisible('receipt_personalization') && (
      <section id="receipts" className="scroll-mt-24 min-w-0">
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
      </section>
      )}
      </div>
      )}

      {isFeatureVisible('payment_configuration') && (
      <section id="payments" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle>{t('businessSettings.paymentsTitle')}</CardTitle>
          <CardDescription>{t('businessSettings.paymentsDescription')}</CardDescription>
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
      </section>
      )}

      <section id="data-export" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle>{t('businessSettings.sectionDataExportTitle')}</CardTitle>
            <CardDescription>{t('businessSettings.dataExportDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={exporting} className="gap-2">
              <Download className="w-4 h-4" />
              {exporting ? t('common.saving') : t('businessSettings.downloadData')}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
