import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { t, type Language } from '@/lib/translations';
import { Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '168 60% 45%';
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6; break;
    }
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  return `${h} ${s}% ${l}%`;
}

function hslToHex(hsl: string): string {
  try {
    const hslValue = hsl.replace(/hsl\(|\)/g, '').trim();
    const parts = hslValue.split(/\s+/).map((v) => parseFloat(v.replace('%', '')));
    const h = (parts[0] ?? 0) / 360;
    const s = (parts[1] ?? 0) / 100;
    const l = (parts[2] ?? 0) / 100;
    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return '#000000';
  }
}

function hslToRgb(hsl: string): { r: number; g: number; b: number } {
  const hex = hslToHex(hsl);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function rgbStringToHsl(rgb: string): string | null {
  const nums = rgb
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((n) => Number(n));
  if (nums.length !== 3 || nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  const [r, g, b] = nums;
  const toHex = (c: number) => {
    const hex = Math.round(c).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return hexToHsl(hex);
}

const THEME_PRESETS = [
  { id: 'ocean', name: 'Ocean', primary: '#0077B6', secondary: '#90E0EF' },
  { id: 'forest', name: 'Forest', primary: '#2D6A4F', secondary: '#B7E4C7' },
  { id: 'sunset', name: 'Sunset', primary: '#E76F51', secondary: '#F4A261' },
  { id: 'midnight', name: 'Midnight', primary: '#1B1B2F', secondary: '#E94560' },
  { id: 'lavender', name: 'Lavender', primary: '#7B2D8B', secondary: '#DDA0DD' },
  { id: 'slate', name: 'Slate', primary: '#334155', secondary: '#94A3B8' },
];

interface AccountSettingsProps {
  settings: Settings;
  onSaveSettings: (s: Partial<Settings>) => Promise<boolean>;
}

export function AccountSettings({ settings, onSaveSettings }: AccountSettingsProps) {
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [pendingLanguage, setPendingLanguage] = useState<Language>(language);
  useEffect(() => { setPendingLanguage(language); }, [language]);
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color || '168 60% 45%');
  const [secondaryColor, setSecondaryColor] = useState(settings.secondary_color || '200 55% 55%');
  const [primaryRgb, setPrimaryRgb] = useState(() => {
    const { r, g, b } = hslToRgb(settings.primary_color || '168 60% 45%');
    return `${r}, ${g}, ${b}`;
  });
  const [secondaryRgb, setSecondaryRgb] = useState(() => {
    const { r, g, b } = hslToRgb(settings.secondary_color || '200 55% 55%');
    return `${r}, ${g}, ${b}`;
  });
  const [primaryHex, setPrimaryHex] = useState(() => hslToHex(settings.primary_color || '168 60% 45%'));
  const [secondaryHex, setSecondaryHex] = useState(() => hslToHex(settings.secondary_color || '200 55% 55%'));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingColor, setSavingColor] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const primaryColorInputRef = useRef<HTMLInputElement | null>(null);
  const secondaryColorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const { r, g, b } = hslToRgb(primaryColor);
    setPrimaryRgb(`${r}, ${g}, ${b}`);
  }, [primaryColor]);

  useEffect(() => {
    const { r, g, b } = hslToRgb(secondaryColor);
    setSecondaryRgb(`${r}, ${g}, ${b}`);
  }, [secondaryColor]);

  useEffect(() => {
    setPrimaryHex(hslToHex(primaryColor));
  }, [primaryColor]);

  useEffect(() => {
    setSecondaryHex(hslToHex(secondaryColor));
  }, [secondaryColor]);

  const applyPreview = (primary: string, secondary: string) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', primary.replace(/hsl\(|\)/g, '').trim());
    root.style.setProperty('--secondary', secondary.replace(/hsl\(|\)/g, '').trim());
  };

  const applyHexFromInputs = (): { primary: string; secondary: string } => {
    let p = primaryColor;
    let s = secondaryColor;
    const rawP = primaryHex.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(rawP)) {
      p = hexToHsl('#' + rawP);
    } else if (/^[0-9a-fA-F]{3}$/.test(rawP)) {
      const r = rawP[0] + rawP[0], g = rawP[1] + rawP[1], b = rawP[2] + rawP[2];
      p = hexToHsl('#' + r + g + b);
    }
    const rawS = secondaryHex.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(rawS)) {
      s = hexToHsl('#' + rawS);
    } else if (/^[0-9a-fA-F]{3}$/.test(rawS)) {
      const r = rawS[0] + rawS[0], g = rawS[1] + rawS[1], b = rawS[2] + rawS[2];
      s = hexToHsl('#' + r + g + b);
    }
    return { primary: p, secondary: s };
  };

  const handleSaveColor = async (e: React.FormEvent) => {
    e.preventDefault();
    const { primary: p, secondary: s } = applyHexFromInputs();
    setPrimaryColor(p);
    setSecondaryColor(s);
    setSavingColor(true);
    const ok = await onSaveSettings({ primary_color: p, secondary_color: s });
    setSavingColor(false);
    if (ok) {
      applyPreview(p, s);
      toast.success(t('accountSettings.colorSaved'));
      setSelectedThemeId(null);
    } else toast.error(t('common.genericError'));
  };

  const handleThemePreview = (preset: (typeof THEME_PRESETS)[0]) => {
    const primaryHsl = hexToHsl(preset.primary);
    const secondaryHsl = hexToHsl(preset.secondary);
    setPrimaryColor(primaryHsl);
    setSecondaryColor(secondaryHsl);
    setSelectedThemeId(preset.id);
    applyPreview(primaryHsl, secondaryHsl);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      toast.error(t('accountSettings.currentPasswordRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('accountSettings.passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('accountSettings.passwordTooShort'));
      return;
    }
    setChangingPassword(true);
    // Verify current password server-side by re-authenticating
    const credentials: Record<string, string> = { email: user?.email ?? '' };
    credentials['password'] = currentPassword;
    const { error: signInError } = await supabase.auth.signInWithPassword(credentials as Parameters<typeof supabase.auth.signInWithPassword>[0]);
    if (signInError) {
      setChangingPassword(false);
      toast.error(signInError.message);
      return;
    }
    const updatePayload: Record<string, string> = {};
    updatePayload['password'] = newPassword;
    const { error } = await supabase.auth.updateUser(updatePayload as Parameters<typeof supabase.auth.updateUser>[0]);
    setChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    if (error) toast.error(error.message);
    else toast.success(t('accountSettings.passwordUpdated'));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('nav.accountSettings')}</h1>
        <p className="text-muted-foreground mt-1">{t('accountSettings.description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('accountSettings.language')}</CardTitle>
          <CardDescription>{t('accountSettings.languageDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={pendingLanguage} onValueChange={(value: Language) => setPendingLanguage(value)}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder={t('accountSettings.selectLanguage')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🇺🇸</span>
                  <span>English</span>
                </div>
              </SelectItem>
              <SelectItem value="es">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🇵🇷</span>
                  <span>Español</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setLanguage(pendingLanguage);
              toast.success(t('accountSettings.languageSavedRefresh'));
              setTimeout(() => window.location.reload(), 1500);
            }}
          >
            {t('accountSettings.saveLanguage')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('accountSettings.colorPalette')}</CardTitle>
          <CardDescription>{t('accountSettings.colorPaletteDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="picker">
            <TabsList>
              <TabsTrigger value="picker">{t('accountSettings.colorPicker')}</TabsTrigger>
              <TabsTrigger value="themes">{t('accountSettings.standardThemes')}</TabsTrigger>
            </TabsList>
            <TabsContent value="picker" className="pt-4">
              <form onSubmit={handleSaveColor} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('accountSettings.primaryColor')}</Label>
                    <div className="flex items-center gap-3">
                      <input
                        ref={primaryColorInputRef}
                        type="color"
                        aria-hidden
                        className="sr-only"
                        value={hslToHex(primaryColor)}
                        onChange={(e) => {
                          const hsl = hexToHsl(e.target.value);
                          setPrimaryColor(hsl);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => primaryColorInputRef.current?.click()}
                        className="w-12 h-12 rounded-lg border-2 border-border shadow-sm hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                        style={{ backgroundColor: `hsl(${primaryColor})` }}
                        aria-label={t('accountSettings.primaryColor')}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-8 shrink-0">RGB</span>
                        <Input
                          type="text"
                          value={primaryRgb}
                          onChange={(e) => setPrimaryRgb(e.target.value)}
                          onBlur={() => {
                            const hsl = rgbStringToHsl(primaryRgb);
                            if (hsl) {
                              setPrimaryColor(hsl);
                            } else {
                              const { r, g, b } = hslToRgb(primaryColor);
                              setPrimaryRgb(`${r}, ${g}, ${b}`);
                            }
                          }}
                          placeholder="255, 128, 0"
                          className="font-mono w-32 shrink-0 min-w-[7rem]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-8 shrink-0">HEX</span>
                        <Input
                          type="text"
                          placeholder="#HEX"
                          className="font-mono w-24 shrink-0"
                          value={primaryHex}
                          onChange={(e) => setPrimaryHex(e.target.value)}
                          onBlur={() => {
                            const raw = primaryHex.trim().replace(/^#/, '');
                            if (/^[0-9a-fA-F]{3}$/.test(raw)) {
                              const r = raw[0] + raw[0], g = raw[1] + raw[1], b = raw[2] + raw[2];
                              const hsl = hexToHsl('#' + r + g + b);
                              setPrimaryColor(hsl);
                            } else if (/^[0-9a-fA-F]{6}$/.test(raw)) {
                              const hsl = hexToHsl('#' + raw);
                              setPrimaryColor(hsl);
                            } else {
                              setPrimaryHex(hslToHex(primaryColor));
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('accountSettings.secondaryColor')}</Label>
                    <div className="flex items-center gap-3">
                      <input
                        ref={secondaryColorInputRef}
                        type="color"
                        aria-hidden
                        className="sr-only"
                        value={hslToHex(secondaryColor)}
                        onChange={(e) => {
                          const hsl = hexToHsl(e.target.value);
                          setSecondaryColor(hsl);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => secondaryColorInputRef.current?.click()}
                        className="w-12 h-12 rounded-lg border-2 border-border shadow-sm hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                        style={{ backgroundColor: `hsl(${secondaryColor})` }}
                        aria-label={t('accountSettings.secondaryColor')}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-8 shrink-0">RGB</span>
                        <Input
                          type="text"
                          value={secondaryRgb}
                          onChange={(e) => setSecondaryRgb(e.target.value)}
                          onBlur={() => {
                            const hsl = rgbStringToHsl(secondaryRgb);
                            if (hsl) {
                              setSecondaryColor(hsl);
                            } else {
                              const { r, g, b } = hslToRgb(secondaryColor);
                              setSecondaryRgb(`${r}, ${g}, ${b}`);
                            }
                          }}
                          placeholder="255, 128, 0"
                          className="font-mono w-32 shrink-0 min-w-[7rem]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-8 shrink-0">HEX</span>
                        <Input
                          type="text"
                          placeholder="#HEX"
                          className="font-mono w-24 shrink-0"
                          value={secondaryHex}
                          onChange={(e) => setSecondaryHex(e.target.value)}
                          onBlur={() => {
                            const raw = secondaryHex.trim().replace(/^#/, '');
                            if (/^[0-9a-fA-F]{3}$/.test(raw)) {
                              const r = raw[0] + raw[0], g = raw[1] + raw[1], b = raw[2] + raw[2];
                              const hsl = hexToHsl('#' + r + g + b);
                              setSecondaryColor(hsl);
                            } else if (/^[0-9a-fA-F]{6}$/.test(raw)) {
                              const hsl = hexToHsl('#' + raw);
                              setSecondaryColor(hsl);
                            } else {
                              setSecondaryHex(hslToHex(secondaryColor));
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <Button type="submit" disabled={savingColor}>
                  {savingColor ? t('common.saving') : t('common.save')}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="themes" className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleThemePreview(preset)}
                    className={`flex flex-col rounded-lg border-2 p-3 text-left transition-colors hover:border-primary/50 ${
                      selectedThemeId === preset.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                    }`}
                  >
                    <div className="flex gap-1 mb-2">
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: preset.primary }} />
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: preset.secondary }} />
                    </div>
                    <span className="font-medium text-sm">{preset.name}</span>
                    {selectedThemeId === preset.id && (
                      <span className="flex items-center gap-1 text-xs text-primary mt-1">
                        <Check className="w-3 h-3" /> Preview applied
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Click a theme to preview. Click Save below to apply and save.
              </p>
              <Button
                className="mt-2"
                onClick={() => {
                  setSavingColor(true);
                  onSaveSettings({ primary_color: primaryColor, secondary_color: secondaryColor }).then((ok) => {
                    setSavingColor(false);
                    if (ok) {
                      toast.success(t('accountSettings.colorSaved'));
                      setSelectedThemeId(null);
                    } else toast.error(t('common.genericError'));
                  });
                }}
                disabled={savingColor}
              >
                {savingColor ? t('common.saving') : t('common.save')}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('accountSettings.changePassword')}</CardTitle>
          <CardDescription>{t('accountSettings.changePasswordDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('accountSettings.currentPassword')}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('accountSettings.newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('accountSettings.confirmPassword')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? t('common.saving') : t('accountSettings.updatePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
