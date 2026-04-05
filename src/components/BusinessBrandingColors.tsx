import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import {
  DEFAULT_PRIMARY_COLOR_HSL,
  DEFAULT_SECONDARY_COLOR_HSL,
  DEFAULT_PRIMARY_HEX,
  DEFAULT_SECONDARY_HEX,
} from '@/lib/defaultThemeColors';
import { hexToHsl, hslToHex, hslToRgb, rgbStringToHsl } from '@/lib/colorFormat';
import { Check } from 'lucide-react';

const THEME_PRESETS = [
  { id: 'pet-hub', name: 'Grumi', primary: DEFAULT_PRIMARY_HEX, secondary: DEFAULT_SECONDARY_HEX },
  { id: 'ocean', name: 'Ocean', primary: '#0077B6', secondary: '#90E0EF' },
  { id: 'forest', name: 'Forest', primary: '#2D6A4F', secondary: '#B7E4C7' },
  { id: 'sunset', name: 'Sunset', primary: '#E76F51', secondary: '#F4A261' },
  { id: 'midnight', name: 'Midnight', primary: '#1B1B2F', secondary: '#E94560' },
  { id: 'lavender', name: 'Lavender', primary: '#7B2D8B', secondary: '#DDA0DD' },
  { id: 'slate', name: 'Slate', primary: '#334155', secondary: '#94A3B8' },
];

function applyPreview(primary: string, secondary: string) {
  const root = document.documentElement;
  root.style.setProperty('--primary', primary.replace(/hsl\(|\)/g, '').trim());
  root.style.setProperty('--secondary', secondary.replace(/hsl\(|\)/g, '').trim());
}

interface BusinessBrandingColorsProps {
  primaryColorInitial: string;
  secondaryColorInitial: string;
  onSaveSettings: (s: { primary_color: string; secondary_color: string }) => Promise<{ ok: boolean; error?: string }>;
}

export function BusinessBrandingColors({
  primaryColorInitial,
  secondaryColorInitial,
  onSaveSettings,
}: BusinessBrandingColorsProps) {
  const [primaryColor, setPrimaryColor] = useState(primaryColorInitial || DEFAULT_PRIMARY_COLOR_HSL);
  const [secondaryColor, setSecondaryColor] = useState(secondaryColorInitial || DEFAULT_SECONDARY_COLOR_HSL);
  const [primaryRgb, setPrimaryRgb] = useState(() => {
    const { r, g, b } = hslToRgb(primaryColorInitial || DEFAULT_PRIMARY_COLOR_HSL);
    return `${r}, ${g}, ${b}`;
  });
  const [secondaryRgb, setSecondaryRgb] = useState(() => {
    const { r, g, b } = hslToRgb(secondaryColorInitial || DEFAULT_SECONDARY_COLOR_HSL);
    return `${r}, ${g}, ${b}`;
  });
  const [primaryHex, setPrimaryHex] = useState(() => hslToHex(primaryColorInitial || DEFAULT_PRIMARY_COLOR_HSL));
  const [secondaryHex, setSecondaryHex] = useState(() => hslToHex(secondaryColorInitial || DEFAULT_SECONDARY_COLOR_HSL));
  const [savingColor, setSavingColor] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const primaryColorInputRef = useRef<HTMLInputElement | null>(null);
  const secondaryColorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPrimaryColor(primaryColorInitial || DEFAULT_PRIMARY_COLOR_HSL);
    setSecondaryColor(secondaryColorInitial || DEFAULT_SECONDARY_COLOR_HSL);
  }, [primaryColorInitial, secondaryColorInitial]);

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

  const applyHexFromInputs = (): { primary: string; secondary: string } => {
    let p = primaryColor;
    let s = secondaryColor;
    const rawP = primaryHex.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(rawP)) {
      p = hexToHsl('#' + rawP);
    } else if (/^[0-9a-fA-F]{3}$/.test(rawP)) {
      const r = rawP[0] + rawP[0],
        g = rawP[1] + rawP[1],
        b = rawP[2] + rawP[2];
      p = hexToHsl('#' + r + g + b);
    }
    const rawS = secondaryHex.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(rawS)) {
      s = hexToHsl('#' + rawS);
    } else if (/^[0-9a-fA-F]{3}$/.test(rawS)) {
      const r = rawS[0] + rawS[0],
        g = rawS[1] + rawS[1],
        b = rawS[2] + rawS[2];
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
    const result = await onSaveSettings({ primary_color: p, secondary_color: s });
    setSavingColor(false);
    if (result.ok) {
      applyPreview(p, s);
      toast.success(t('businessSettings.brandingColorsSaved'));
      setSelectedThemeId(null);
    } else toast.error(result.error || t('common.genericError'));
  };

  const handleThemePreview = (preset: (typeof THEME_PRESETS)[0]) => {
    const primaryHsl = hexToHsl(preset.primary);
    const secondaryHsl = hexToHsl(preset.secondary);
    setPrimaryColor(primaryHsl);
    setSecondaryColor(secondaryHsl);
    setSelectedThemeId(preset.id);
    applyPreview(primaryHsl, secondaryHsl);
  };

  return (
    <div className="space-y-4">
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
                <div className="flex items-center gap-3 flex-wrap">
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
                          const r = raw[0] + raw[0],
                            g = raw[1] + raw[1],
                            b = raw[2] + raw[2];
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
                <div className="flex items-center gap-3 flex-wrap">
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
                          const r = raw[0] + raw[0],
                            g = raw[1] + raw[1],
                            b = raw[2] + raw[2];
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
                    <Check className="w-3 h-3" /> {t('businessSettings.brandingThemePreviewApplied')}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">{t('businessSettings.brandingThemeHint')}</p>
          <Button
            className="mt-2"
            type="button"
            onClick={() => {
              setSavingColor(true);
              onSaveSettings({ primary_color: primaryColor, secondary_color: secondaryColor }).then((result) => {
                setSavingColor(false);
                if (result.ok) {
                  applyPreview(primaryColor, secondaryColor);
                  toast.success(t('businessSettings.brandingColorsSaved'));
                  setSelectedThemeId(null);
                } else toast.error(result.error || t('common.genericError'));
              });
            }}
            disabled={savingColor}
          >
            {savingColor ? t('common.saving') : t('common.save')}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
