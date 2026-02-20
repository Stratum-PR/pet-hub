import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Palette, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings } from '@/hooks/useSupabaseData';
import { Services } from '@/pages/Services';
import { Service } from '@/types';
import { toast } from 'sonner';

interface AdminProps {
  settings: Settings;
  onSaveSettings: (settings: Settings) => Promise<boolean>;
  services: Service[];
  onAddService: (service: Omit<Service, 'id' | 'created_at'>) => void;
  onUpdateService: (id: string, service: Partial<Service>) => void;
  onDeleteService: (id: string) => void;
}

export function Admin({ 
  settings,
  onSaveSettings,
  services,
  onAddService,
  onUpdateService,
  onDeleteService
}: AdminProps) {
  const location = useLocation();
  const defaultTab = location.state?.tab || 'personalization';
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);
  
  const [settingsFormData, setSettingsFormData] = useState({
    business_name: settings.business_name,
    business_hours: settings.business_hours,
    primary_color: settings.primary_color || '168 60% 45%',
    secondary_color: settings.secondary_color || '200 55% 55%',
  });

  const [savingSettings, setSavingSettings] = useState(false);

  // Update form when settings change
  useEffect(() => {
    setSettingsFormData({
      business_name: settings.business_name,
      business_hours: settings.business_hours,
      primary_color: settings.primary_color || '168 60% 45%',
      secondary_color: settings.secondary_color || '200 55% 55%',
    });
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const success = await onSaveSettings(settingsFormData);
    setSavingSettings(false);
    
    if (success) {
      toast.success('Settings saved successfully!');
      // Apply colors immediately
      const root = document.documentElement;
      const primaryValue = settingsFormData.primary_color.replace(/hsl\(|\)/g, '').trim();
      const secondaryValue = settingsFormData.secondary_color.replace(/hsl\(|\)/g, '').trim();
      root.style.setProperty('--primary', primaryValue);
      root.style.setProperty('--secondary', secondaryValue);
    } else {
      toast.error('Failed to save settings. Please try again.');
    }
  };

  // Helper function to convert HSL to hex for color input
  const hslToHex = (hsl: string): string => {
    if (hsl.startsWith('#')) return hsl;
    // Handle both formats: "168 60% 45%" and "hsl(168, 60%, 45%)"
    let match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    if (!match) {
      match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    }
    if (!match) return '#3b82f6';
    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - c / 2;
    
    let r = 0, g = 0, b = 0;
    if (h < 1/6) { r = c; g = x; }
    else if (h < 2/6) { r = x; g = c; }
    else if (h < 3/6) { g = c; b = x; }
    else if (h < 4/6) { g = x; b = c; }
    else if (h < 5/6) { r = x; b = c; }
    else { r = c; b = x; }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Helper function to convert hex to HSL (returns format: "168 60% 45%")
  const hexToHsl = (hex: string): string => {
    if (!hex.startsWith('#')) {
      // Assume it's already HSL format, ensure it's in the right format
      if (hex.includes('hsl(')) {
        return hex.replace(/hsl\(|\)/g, '').trim();
      }
      return hex;
    }
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const handleColorChange = (colorType: 'primary' | 'secondary', hexValue: string) => {
    const hslValue = hexToHsl(hexValue);
    setSettingsFormData({
      ...settingsFormData,
      [colorType === 'primary' ? 'primary_color' : 'secondary_color']: hslValue,
    });
    // Apply immediately for preview
    const root = document.documentElement;
    root.style.setProperty(`--${colorType}`, hslValue);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="personalization" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Personalization
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Services
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="personalization" className="space-y-6 mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Business Personalization</CardTitle>
              <CardDescription>Configure your business preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input 
                    value={settingsFormData.business_name}
                    onChange={(e) => setSettingsFormData({ ...settingsFormData, business_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Hours</Label>
                  <Input 
                    value={settingsFormData.business_hours}
                    onChange={(e) => setSettingsFormData({ ...settingsFormData, business_hours: e.target.value })}
                  />
                </div>
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Color Customization</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primary-color">Primary Color</Label>
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
                            // Handle both formats
                            const hslValue = e.target.value.replace(/hsl\(|\)/g, '').trim();
                            root.style.setProperty('--primary', hslValue);
                          }}
                          placeholder="168 60% 45%"
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Main brand color used throughout the app
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondary-color">Secondary Color</Label>
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
                            // Handle both formats
                            const hslValue = e.target.value.replace(/hsl\(|\)/g, '').trim();
                            root.style.setProperty('--secondary', hslValue);
                          }}
                          placeholder="200 55% 55%"
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Secondary accent color for highlights and accents
                      </p>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="mt-4 shadow-sm" disabled={savingSettings}>
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="services" className="mt-6">
          <Services
            services={services}
            onAddService={onAddService}
            onUpdateService={onUpdateService}
            onDeleteService={onDeleteService}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
