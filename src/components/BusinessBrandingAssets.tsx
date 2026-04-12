import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { isDemoMode } from '@/lib/authRouting';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, X, ZoomIn, ZoomOut, Pencil } from 'lucide-react';
import type { Settings } from '@/hooks/useSupabaseData';
import type { BusinessBrandingLayout } from '@/lib/businessBrandingLayout';
import {
  brandingLayoutToJson,
  normalizeBusinessBrandingLayout,
  parseBusinessBrandingLayout,
} from '@/lib/businessBrandingLayout';
import { TimeKioskPreview } from '@/components/TimeKioskPreview';
import { DEFAULT_GRUMI_WORDMARK_SRC } from '@/lib/marketingLogoFromTheme';
import {
  BrandingMobileHeaderChromePreview,
  BrandingSidebarCollapsedChromePreview,
  BrandingSidebarExpandedChromePreview,
} from '@/components/BusinessBrandingChromePreview';
import { BrandingIconCompact, BrandingLogoSidebarExpanded } from '@/components/BrandingMark';

type LogoTheme = 'light' | 'dark';
type BrandAsset = 'logo' | 'icon';

type EditTabLogo = 'crop' | 'appearance';
type EditTabIcon = 'crop' | 'appearance';

type EditSession =
  | {
      kind: 'upload';
      asset: BrandAsset;
      theme: LogoTheme;
      file: File;
      objectUrl: string;
    }
  | {
      kind: 'adjust';
      asset: BrandAsset;
      theme: LogoTheme;
      imageUrl: string;
    };

interface BusinessBrandingAssetsProps {
  businessId: string | null;
  demoLocalOnly: boolean;
  settings: Settings;
  updateSetting: (
    key: string,
    value: string | null | BusinessBrandingLayout
  ) => Promise<{ ok: boolean; error?: string }>;
  refetch: () => Promise<void> | void;
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif';

function layoutClone(layout: BusinessBrandingLayout): BusinessBrandingLayout {
  return parseBusinessBrandingLayout(brandingLayoutToJson(layout), undefined);
}

export function BusinessBrandingAssets({
  businessId,
  demoLocalOnly,
  settings,
  updateSetting,
  refetch,
}: BusinessBrandingAssetsProps) {
  const [logoLight, setLogoLight] = useState<string | null>(() =>
    typeof window !== 'undefined' && isDemoMode() ? DEFAULT_GRUMI_WORDMARK_SRC : null
  );
  const [logoDark, setLogoDark] = useState<string | null>(null);
  const [iconLight, setIconLight] = useState<string | null>(null);
  const [iconDark, setIconDark] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editSession, setEditSession] = useState<EditSession | null>(null);
  const [editTabLogo, setEditTabLogo] = useState<EditTabLogo>('crop');
  const [editTabIcon, setEditTabIcon] = useState<EditTabIcon>('crop');
  const [draftLayout, setDraftLayout] = useState<BusinessBrandingLayout>(() =>
    layoutClone(settings.business_branding_layout)
  );
  const [cropZoom, setCropZoom] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    if (demoLocalOnly) return;
    Promise.all([
      supabase
        .from('settings' as any)
        .select(
          'business_logo_url, business_logo_url_light, business_logo_url_dark, business_icon_url_light, business_icon_url_dark'
        )
        .eq('business_id', businessId)
        .maybeSingle(),
      supabase.from('businesses').select('logo_url').eq('id', businessId).maybeSingle(),
    ]).then(([settingsRes, bizRes]) => {
      const row = (settingsRes as any).data as any;
      const biz = (bizRes as any).data as any;
      const legacyLogoUrl = row?.business_logo_url ?? biz?.logo_url ?? null;
      const lightLogoUrl = row?.business_logo_url_light ?? legacyLogoUrl;
      const darkLogoUrl = row?.business_logo_url_dark ?? null;
      const iLight = row?.business_icon_url_light ?? null;
      const iDark = row?.business_icon_url_dark ?? null;
      if (isDemoMode() && !lightLogoUrl) {
        setLogoLight(DEFAULT_GRUMI_WORDMARK_SRC);
        setLogoDark(null);
      } else {
        setLogoLight(lightLogoUrl);
        setLogoDark(darkLogoUrl);
      }
      setIconLight(iLight);
      setIconDark(iDark);
    });
  }, [businessId, demoLocalOnly]);

  useEffect(() => {
    if (!businessId || !demoLocalOnly) return;
    const light = settings.business_logo_url_light ?? settings.business_logo_url;
    const dark = settings.business_logo_url_dark;
    const il = settings.business_icon_url_light;
    const id = settings.business_icon_url_dark;
    if (isDemoMode() && !light) {
      setLogoLight(DEFAULT_GRUMI_WORDMARK_SRC);
      setLogoDark(null);
    } else {
      setLogoLight(light ?? null);
      setLogoDark(dark ?? null);
    }
    setIconLight(il ?? null);
    setIconDark(id ?? null);
  }, [
    businessId,
    demoLocalOnly,
    settings.business_logo_url,
    settings.business_logo_url_light,
    settings.business_logo_url_dark,
    settings.business_icon_url_light,
    settings.business_icon_url_dark,
  ]);

  const closeEditor = useCallback(() => {
    if (editSession?.kind === 'upload') URL.revokeObjectURL(editSession.objectUrl);
    setEditSession(null);
    setEditOpen(false);
    setCropZoom(1);
  }, [editSession]);

  const openUpload = (asset: BrandAsset, theme: LogoTheme) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setDraftLayout(layoutClone(settings.business_branding_layout));
    setEditTabLogo('crop');
    setEditTabIcon('crop');
    setCropZoom(1);
    setEditSession({ kind: 'upload', asset, theme, file, objectUrl: URL.createObjectURL(file) });
    setEditOpen(true);
  };

  const openAdjust = (asset: BrandAsset, theme: LogoTheme) => {
    const url = resolveUrl(asset, theme);
    if (!url) {
      toast.error(t('businessSettings.brandingEditNeedImage'));
      return;
    }
    setDraftLayout(layoutClone(settings.business_branding_layout));
    setEditTabLogo('appearance');
    setEditTabIcon('appearance');
    setCropZoom(1);
    setEditSession({ kind: 'adjust', asset, theme, imageUrl: url });
    setEditOpen(true);
  };

  function resolveUrl(asset: BrandAsset, theme: LogoTheme): string | null {
    if (asset === 'logo') {
      if (theme === 'light') return logoLight;
      return logoDark || logoLight;
    }
    if (theme === 'light') return iconLight;
    return iconDark || iconLight;
  }

  function previewUrlForSession(): string | null {
    if (!editSession) return null;
    if (editSession.kind === 'upload') return editSession.objectUrl;
    return editSession.imageUrl;
  }

  const storagePath = (asset: BrandAsset, theme: LogoTheme, ext: string) =>
    `${businessId}/${asset}_${theme}.${ext}`;

  const persistLayout = async (layout: BusinessBrandingLayout) => {
    const res = await updateSetting('business_branding_layout', normalizeBusinessBrandingLayout(layout));
    if (!res.ok) throw new Error(res.error || 'layout');
  };

  const confirmEditor = async () => {
    if (!editSession || !businessId) return;
    const pu = previewUrlForSession();
    if (!pu) return;
    setSaving(true);
    try {
      let layoutToSave = normalizeBusinessBrandingLayout(draftLayout);

      if (editSession.kind === 'upload') {
        const { file, objectUrl } = editSession;
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const el = new Image();
          el.onload = () => res(el);
          el.onerror = rej;
          el.src = objectUrl;
        });
        const scale = cropZoom;
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2d');
        ctx.drawImage(img, 0, 0, w, h);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, file.type || 'image/png', 0.92)
        );
        if (!blob) throw new Error('toBlob failed');

        if (demoLocalOnly) {
          const dataUrl = canvas.toDataURL(file.type || 'image/png', 0.92);
          const { asset, theme } = editSession;
          if (asset === 'logo' && theme === 'light') {
            const lr = await updateSetting('business_logo_url', dataUrl);
            if (!lr.ok) throw new Error(lr.error);
            const l2 = await updateSetting('business_logo_url_light', dataUrl);
            if (!l2.ok) throw new Error(l2.error);
            setLogoLight(dataUrl);
          } else if (asset === 'logo' && theme === 'dark') {
            const dr = await updateSetting('business_logo_url_dark', dataUrl);
            if (!dr.ok) throw new Error(dr.error);
            setLogoDark(dataUrl);
          } else if (asset === 'icon' && theme === 'light') {
            const ir = await updateSetting('business_icon_url_light', dataUrl);
            if (!ir.ok) throw new Error(ir.error);
            setIconLight(dataUrl);
          } else {
            const ir = await updateSetting('business_icon_url_dark', dataUrl);
            if (!ir.ok) throw new Error(ir.error);
            setIconDark(dataUrl);
          }
          await persistLayout(layoutToSave);
          toast.success(t('businessSettings.logoUploaded'));
          closeEditor();
          await refetch();
          return;
        }

        const ext = file.name.split('.').pop() || 'png';
        const path = storagePath(editSession.asset, editSession.theme, ext);
        const { error: uploadError } = await supabase.storage
          .from('business-logos')
          .upload(path, blob, { cacheControl: '3600', upsert: true });
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from('business-logos').getPublicUrl(path);

        const { asset, theme } = editSession;
        if (asset === 'logo' && theme === 'light') {
          await supabase
            .from('businesses' as any)
            .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
            .eq('id', businessId);
          const legacyRes = await updateSetting('business_logo_url', publicUrl);
          if (!legacyRes.ok) throw new Error(legacyRes.error);
          const lightRes = await updateSetting('business_logo_url_light', publicUrl);
          if (!lightRes.ok) throw new Error(lightRes.error);
          setLogoLight(publicUrl);
        } else if (asset === 'logo' && theme === 'dark') {
          const r = await updateSetting('business_logo_url_dark', publicUrl);
          if (!r.ok) throw new Error(r.error);
          setLogoDark(publicUrl);
        } else if (asset === 'icon' && theme === 'light') {
          const r = await updateSetting('business_icon_url_light', publicUrl);
          if (!r.ok) throw new Error(r.error);
          setIconLight(publicUrl);
        } else {
          const r = await updateSetting('business_icon_url_dark', publicUrl);
          if (!r.ok) throw new Error(r.error);
          setIconDark(publicUrl);
        }

        await persistLayout(layoutToSave);
        toast.success(t('businessSettings.logoUploaded'));
      } else {
        await persistLayout(layoutToSave);
        toast.success(t('businessSettings.brandingLayoutSaved'));
      }

      closeEditor();
      await refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.genericError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (asset: BrandAsset, theme: LogoTheme) => {
    if (!businessId) return;
    const url = resolveUrl(asset, theme);
    if (!url) return;
    setSaving(true);
    try {
      if (demoLocalOnly) {
        if (asset === 'logo' && theme === 'light') {
          await updateSetting('business_logo_url', null);
          await updateSetting('business_logo_url_light', null);
          setLogoLight(isDemoMode() ? DEFAULT_GRUMI_WORDMARK_SRC : null);
        } else if (asset === 'logo' && theme === 'dark') {
          await updateSetting('business_logo_url_dark', null);
          setLogoDark(null);
        } else if (asset === 'icon' && theme === 'light') {
          await updateSetting('business_icon_url_light', null);
          setIconLight(null);
        } else {
          await updateSetting('business_icon_url_dark', null);
          setIconDark(null);
        }
        toast.success(t('businessSettings.logoDeleted'));
        await refetch();
        return;
      }
      const pathMatch = url.match(/\/storage\/v1\/object\/public\/business-logos\/(.+)$/);
      const path = pathMatch ? pathMatch[1] : null;
      if (path) await supabase.storage.from('business-logos').remove([path]);

      if (asset === 'logo' && theme === 'light') {
        await supabase.from('businesses').update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', businessId);
        await updateSetting('business_logo_url', null);
        await updateSetting('business_logo_url_light', null);
        setLogoLight(null);
      } else if (asset === 'logo' && theme === 'dark') {
        await updateSetting('business_logo_url_dark', null);
        setLogoDark(null);
      } else if (asset === 'icon' && theme === 'light') {
        await updateSetting('business_icon_url_light', null);
        setIconLight(null);
      } else {
        await updateSetting('business_icon_url_dark', null);
        setIconDark(null);
      }
      toast.success(t('businessSettings.logoDeleted'));
      await refetch();
    } catch {
      toast.error(t('common.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const adjustCropZoom = (dir: -1 | 1) => {
    setCropZoom((z) => Math.max(0.25, Math.min(3, z + dir * 0.25)));
  };

  const previewSrc = previewUrlForSession();

  const renderAssetBlock = (
    asset: BrandAsset,
    theme: LogoTheme,
    label: string,
    thumbUrl: string | null,
    fallbackThumb: string | null,
    inputId: string
  ) => {
    const show = thumbUrl || fallbackThumb;
    const canDelete = asset === 'logo' && theme === 'light' ? !!thumbUrl && !isDemoMode() : !!thumbUrl;
    const displaySrc = thumbUrl || fallbackThumb || '';

    return (
      <div className="space-y-2 rounded-lg border border-border/80 p-3 bg-muted/20">
        <div className="text-sm font-medium">{label}</div>
        <div className="relative flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50">
          {show ? (
            <img src={displaySrc} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">{t('businessSettings.logoNoImage')}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="file"
            accept={ACCEPT_IMAGES}
            className="hidden"
            id={inputId}
            onChange={openUpload(asset, theme)}
            disabled={saving || !businessId}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => document.getElementById(inputId)?.click()}
            disabled={saving || !businessId}
          >
            <Upload className="h-4 w-4" />
            {thumbUrl ? t('businessSettings.logoReplace') : t('businessSettings.logoUpload')}
          </Button>
          {thumbUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => openAdjust(asset, theme)}
              disabled={saving}
            >
              <Pencil className="h-4 w-4" />
              {t('common.edit')}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={() => void handleDelete(asset, theme)}
              disabled={saving}
            >
              <X className="h-4 w-4" />
              {t('businessSettings.logoDelete')}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t('businessSettings.logoMax5MB')}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-base">{t('businessSettings.brandingLightSection')}</Label>
        <p className="text-sm text-muted-foreground">{t('businessSettings.brandingLightSectionHint')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderAssetBlock(
            'logo',
            'light',
            t('businessSettings.brandingLogo'),
            logoLight,
            typeof window !== 'undefined' && isDemoMode() ? DEFAULT_GRUMI_WORDMARK_SRC : null,
            'brand-upload-logo-light'
          )}
          {renderAssetBlock('icon', 'light', t('businessSettings.brandingIcon'), iconLight, null, 'brand-upload-icon-light')}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <Label className="text-base">{t('businessSettings.brandingDarkSection')}</Label>
        <p className="text-sm text-muted-foreground">{t('businessSettings.brandingDarkSectionHint')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderAssetBlock(
            'logo',
            'dark',
            t('businessSettings.brandingLogoDark'),
            logoDark,
            logoLight,
            'brand-upload-logo-dark'
          )}
          {renderAssetBlock(
            'icon',
            'dark',
            t('businessSettings.brandingIconDark'),
            iconDark,
            iconLight,
            'brand-upload-icon-dark'
          )}
        </div>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('businessSettings.brandingAdjustTitle')}</DialogTitle>
          </DialogHeader>
          {editSession && previewSrc ? (
            <div className="space-y-4">
              {editSession.asset === 'logo' ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {editSession.kind === 'upload' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={editTabLogo === 'crop' ? 'default' : 'outline'}
                        onClick={() => setEditTabLogo('crop')}
                      >
                        {t('businessSettings.brandingTabCrop')}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={editTabLogo === 'appearance' ? 'default' : 'outline'}
                      onClick={() => setEditTabLogo('appearance')}
                    >
                      {t('businessSettings.brandingTabAppearance')}
                    </Button>
                  </div>

                  {editTabLogo === 'crop' && editSession.kind === 'upload' ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-6 flex flex-col items-center gap-3">
                      <div
                        className="overflow-hidden rounded-md border bg-background"
                        style={{
                          width: Math.min(320, Math.round(240 * cropZoom)),
                          height: Math.min(320, Math.round(240 * cropZoom)),
                        }}
                      >
                        <img
                          src={previewSrc}
                          alt=""
                          className="h-full w-full object-contain"
                          style={{ transform: `scale(${cropZoom})`, transformOrigin: 'center' }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="icon" variant="outline" onClick={() => adjustCropZoom(-1)}>
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground w-16 text-center">{Math.round(cropZoom * 100)}%</span>
                        <Button type="button" size="icon" variant="outline" onClick={() => adjustCropZoom(1)}>
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center max-w-md">{t('businessSettings.brandingCropHint')}</p>
                    </div>
                  ) : null}

                  {editTabLogo === 'appearance' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          {t('businessSettings.brandingPreviewSidebarExpanded')}
                        </div>
                        <div className="flex justify-center">
                          <BrandingSidebarExpandedChromePreview>
                            <BrandingLogoSidebarExpanded
                              logoUrl={previewSrc}
                              layout={draftLayout.logo.sidebarExpanded}
                            />
                          </BrandingSidebarExpandedChromePreview>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <label className="text-xs space-y-1">
                            <span className="text-muted-foreground">{t('businessSettings.brandingZoom')}</span>
                            <input
                              type="range"
                              min={25}
                              max={300}
                              value={Math.round(draftLayout.logo.sidebarExpanded.zoom * 100)}
                              onChange={(e) =>
                                setDraftLayout((prev) => ({
                                  ...prev,
                                  logo: {
                                    ...prev.logo,
                                    sidebarExpanded: {
                                      ...prev.logo.sidebarExpanded,
                                      zoom: parseInt(e.target.value, 10) / 100,
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </label>
                          <label className="text-xs space-y-1">
                            <span className="text-muted-foreground">{t('businessSettings.brandingHeightPx')}</span>
                            <input
                              type="range"
                              min={32}
                              max={160}
                              value={draftLayout.logo.sidebarExpanded.heightPx}
                              onChange={(e) =>
                                setDraftLayout((prev) => ({
                                  ...prev,
                                  logo: {
                                    ...prev.logo,
                                    sidebarExpanded: {
                                      ...prev.logo.sidebarExpanded,
                                      heightPx: parseInt(e.target.value, 10) || 80,
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </label>
                          <label className="text-xs space-y-1">
                            <span className="text-muted-foreground">{t('businessSettings.brandingMaxWidthPx')}</span>
                            <input
                              type="range"
                              min={32}
                              max={360}
                              value={draftLayout.logo.sidebarExpanded.maxWidthPx ?? draftLayout.logo.sidebarExpanded.heightPx}
                              onChange={(e) =>
                                setDraftLayout((prev) => ({
                                  ...prev,
                                  logo: {
                                    ...prev.logo,
                                    sidebarExpanded: {
                                      ...prev.logo.sidebarExpanded,
                                      maxWidthPx: parseInt(e.target.value, 10) || 80,
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          {t('businessSettings.brandingPreviewKiosk')}
                        </div>
                        <TimeKioskPreview logoUrl={previewSrc} layout={draftLayout.logo.kiosk} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-xs space-y-1">
                            <span className="text-muted-foreground">{t('businessSettings.brandingZoom')}</span>
                            <input
                              type="range"
                              min={25}
                              max={300}
                              value={Math.round(draftLayout.logo.kiosk.zoom * 100)}
                              onChange={(e) =>
                                setDraftLayout((prev) => ({
                                  ...prev,
                                  logo: {
                                    ...prev.logo,
                                    kiosk: {
                                      ...prev.logo.kiosk,
                                      zoom: parseInt(e.target.value, 10) / 100,
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </label>
                          <label className="text-xs space-y-1">
                            <span className="text-muted-foreground">{t('businessSettings.brandingKioskHeightPx')}</span>
                            <input
                              type="range"
                              min={24}
                              max={120}
                              value={draftLayout.logo.kiosk.heightPx}
                              onChange={(e) =>
                                setDraftLayout((prev) => ({
                                  ...prev,
                                  logo: {
                                    ...prev.logo,
                                    kiosk: {
                                      ...prev.logo.kiosk,
                                      heightPx: parseInt(e.target.value, 10) || 48,
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {editSession.kind === 'upload' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={editTabIcon === 'crop' ? 'default' : 'outline'}
                        onClick={() => setEditTabIcon('crop')}
                      >
                        {t('businessSettings.brandingTabCrop')}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={editTabIcon === 'appearance' ? 'default' : 'outline'}
                      onClick={() => setEditTabIcon('appearance')}
                    >
                      {t('businessSettings.brandingTabAppearance')}
                    </Button>
                  </div>

                  {editTabIcon === 'crop' && editSession.kind === 'upload' ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-6 flex flex-col items-center gap-3">
                      <div
                        className="overflow-hidden rounded-md border bg-background"
                        style={{
                          width: Math.min(280, Math.round(200 * cropZoom)),
                          height: Math.min(280, Math.round(200 * cropZoom)),
                        }}
                      >
                        <img
                          src={previewSrc}
                          alt=""
                          className="h-full w-full object-contain"
                          style={{ transform: `scale(${cropZoom})`, transformOrigin: 'center' }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="icon" variant="outline" onClick={() => adjustCropZoom(-1)}>
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground w-16 text-center">{Math.round(cropZoom * 100)}%</span>
                        <Button type="button" size="icon" variant="outline" onClick={() => adjustCropZoom(1)}>
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center max-w-md">{t('businessSettings.brandingCropHint')}</p>
                    </div>
                  ) : null}

                  {editTabIcon === 'appearance' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          {t('businessSettings.brandingPreviewCollapsed')}
                        </div>
                        <div className="flex justify-center">
                          <BrandingSidebarCollapsedChromePreview>
                            <BrandingIconCompact
                              imageUrl={previewSrc}
                              layout={draftLayout.icon.sidebarCollapsed}
                            />
                          </BrandingSidebarCollapsedChromePreview>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-xs space-y-1">
                            <span className="text-muted-foreground">{t('businessSettings.brandingZoom')}</span>
                            <input
                              type="range"
                              min={25}
                              max={300}
                              value={Math.round(draftLayout.icon.sidebarCollapsed.zoom * 100)}
                              onChange={(e) =>
                                setDraftLayout((prev) => ({
                                  ...prev,
                                  icon: {
                                    ...prev.icon,
                                    sidebarCollapsed: {
                                      ...prev.icon.sidebarCollapsed,
                                      zoom: parseInt(e.target.value, 10) / 100,
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </label>
                          <label className="text-xs space-y-1">
                            <span className="text-muted-foreground">{t('businessSettings.brandingSizePx')}</span>
                            <input
                              type="range"
                              min={24}
                              max={72}
                              value={draftLayout.icon.sidebarCollapsed.sizePx}
                              onChange={(e) =>
                                setDraftLayout((prev) => ({
                                  ...prev,
                                  icon: {
                                    ...prev.icon,
                                    sidebarCollapsed: {
                                      ...prev.icon.sidebarCollapsed,
                                      sizePx: parseInt(e.target.value, 10) || 40,
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          {t('businessSettings.brandingPreviewMobile')}
                        </div>
                        <BrandingMobileHeaderChromePreview>
                          <BrandingIconCompact imageUrl={previewSrc} layout={draftLayout.icon.mobile} />
                          <span className="text-sm truncate text-sidebar-foreground">…</span>
                        </BrandingMobileHeaderChromePreview>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-xs space-y-1">
                            <span className="text-muted-foreground">{t('businessSettings.brandingZoom')}</span>
                            <input
                              type="range"
                              min={25}
                              max={300}
                              value={Math.round(draftLayout.icon.mobile.zoom * 100)}
                              onChange={(e) =>
                                setDraftLayout((prev) => ({
                                  ...prev,
                                  icon: {
                                    ...prev.icon,
                                    mobile: {
                                      ...prev.icon.mobile,
                                      zoom: parseInt(e.target.value, 10) / 100,
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </label>
                          <label className="text-xs space-y-1">
                            <span className="text-muted-foreground">{t('businessSettings.brandingSizePx')}</span>
                            <input
                              type="range"
                              min={24}
                              max={72}
                              value={draftLayout.icon.mobile.sizePx}
                              onChange={(e) =>
                                setDraftLayout((prev) => ({
                                  ...prev,
                                  icon: {
                                    ...prev.icon,
                                    mobile: {
                                      ...prev.icon.mobile,
                                      sizePx: parseInt(e.target.value, 10) || 36,
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void confirmEditor()} disabled={saving || !previewSrc}>
              {saving ? t('common.saving') : t('businessSettings.logoUseThis')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
