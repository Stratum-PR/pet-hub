import { useState, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings } from '@/hooks/useSupabaseData';
import { toast } from 'sonner';
import { t, Language } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';

interface PersonalizationProps {
  settings: Settings;
  onSaveSettings: (settings: Settings) => Promise<boolean>;
}

export function Personalization({ 
  settings,
  onSaveSettings,
}: PersonalizationProps) {
  const { language, setLanguage } = useLanguage();
  
  const [settingsFormData, setSettingsFormData] = useState({
    business_name: settings.business_name,
    business_hours: settings.business_hours,
    primary_color: settings.primary_color || '168 60% 45%',
    secondary_color: settings.secondary_color || '200 55% 55%',
    language: language,
  });

  const [savingSettings, setSavingSettings] = useState(false);

  // Update form when settings change
  useEffect(() => {
    setSettingsFormData({
      business_name: settings.business_name,
      business_hours: settings.business_hours,
      primary_color: settings.primary_color || '168 60% 45%',
      secondary_color: settings.secondary_color || '200 55% 55%',
      language: language,
    });
  }, [settings, language]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setSettingsFormData({ ...settingsFormData, language: lang });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const success = await onSaveSettings(settingsFormData);
    setSavingSettings(false);
    
    if (success) {
      toast.success(t('personalization.settingsSaved'));
      // Apply colors immediately
      const root = document.documentElement;
      const primaryValue = settingsFormData.primary_color.replace(/hsl\(|\)/g, '').trim();
      const secondaryValue = settingsFormData.secondary_color.replace(/hsl\(|\)/g, '').trim();
      root.style.setProperty('--primary', primaryValue);
      root.style.setProperty('--secondary', secondaryValue);
    } else {
      toast.error(t('personalization.settingsError'));
    }
  };

  // Helper function to convert HSL to hex for color input
  const hslToHex = (hsl: string): string => {
    try {
      // Remove 'hsl(' and ')' if present
      const hslValue = hsl.replace(/hsl\(|\)/g, '').trim();
      const parts = hslValue.split(' ').map(v => parseFloat(v));
      const h = parts[0] || 0;
      const s = parts[1] || 0;
      const l = parts[2] || 0;
      
      const hNorm = h / 360;
      const sNorm = s / 100;
      const lNorm = l / 100;

      let r, g, b;
      if (sNorm === 0) {
        r = g = b = lNorm;
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };

        const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
        const p = 2 * lNorm - q;
        r = hue2rgb(p, q, hNorm + 1/3);
        g = hue2rgb(p, q, hNorm);
        b = hue2rgb(p, q, hNorm - 1/3);
      }

      const toHex = (c: number) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };

      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch {
      return '#000000';
    }
  };

  const handleColorChange = (colorType: 'primary' | 'secondary', hexValue: string) => {
    // Convert hex to HSL
    const r = parseInt(hexValue.slice(1, 3), 16) / 255;
    const g = parseInt(hexValue.slice(3, 5), 16) / 255;
    const b = parseInt(hexValue.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    const hslValue = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    
    setSettingsFormData({
      ...settingsFormData,
      [colorType === 'primary' ? 'primary_color' : 'secondary_color']: hslValue,
    });

    const root = document.documentElement;
    root.style.setProperty(`--${colorType}`, hslValue);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('personalization.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('personalization.description')}
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t('personalization.title')}</CardTitle>
          <CardDescription>{t('personalization.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('personalization.businessName')}</Label>
              <Input 
                value={settingsFormData.business_name}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, business_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('personalization.businessHours')}</Label>
              <Input 
                value={settingsFormData.business_hours}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, business_hours: e.target.value })}
              />
            </div>
            
            {/* Language Selection */}
            <div className="space-y-2">
              <Label>{t('personalization.language')}</Label>
              <Select value={language} onValueChange={(value: Language) => handleLanguageChange(value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('personalization.selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🇺🇸</span>
                      <span>English</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="es">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🇵🇷</span>
                      <span>Español</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">{t('personalization.colorCustomization')}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary-color">{t('personalization.primaryColor')}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="primary-color"
                      type="color"
                      value={hslToHex(settingsFormData.primary_color)}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="w-16 h-10 rounded border border-border cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={settingsFormData.primary_color}
                      onChange={(e) => {
                        setSettingsFormData({ ...settingsFormData, primary_color: e.target.value });
                        const root = document.documentElement;
                        const hslValue = e.target.value.replace(/hsl\(|\)/g, '').trim();
                        root.style.setProperty('--primary', hslValue);
                      }}
                      placeholder="168 60% 45%"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('personalization.primaryColorDesc')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary-color">{t('personalization.secondaryColor')}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="secondary-color"
                      type="color"
                      value={hslToHex(settingsFormData.secondary_color)}
                      onChange={(e) => handleColorChange('secondary', e.target.value)}
                      className="w-16 h-10 rounded border border-border cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={settingsFormData.secondary_color}
                      onChange={(e) => {
                        setSettingsFormData({ ...settingsFormData, secondary_color: e.target.value });
                        const root = document.documentElement;
                        const hslValue = e.target.value.replace(/hsl\(|\)/g, '').trim();
                        root.style.setProperty('--secondary', hslValue);
                      }}
                      placeholder="200 55% 55%"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('personalization.secondaryColorDesc')}
                  </p>
                </div>
              </div>
            </div>
            <Button type="submit" className="mt-4 shadow-sm" disabled={savingSettings}>
              {savingSettings ? t('personalization.saving') : t('personalization.saveSettings')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
