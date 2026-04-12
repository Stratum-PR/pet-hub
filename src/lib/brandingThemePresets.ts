import { DEFAULT_PRIMARY_HEX, DEFAULT_SECONDARY_HEX } from '@/lib/defaultThemeColors';

/** Standard themes in Business Settings → Color palette (keep in sync with marketing logo assets in `public/`). */
export interface BrandingThemePreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

export const BRANDING_THEME_PRESETS: BrandingThemePreset[] = [
  { id: 'pet-hub', name: 'Grumi', primary: DEFAULT_PRIMARY_HEX, secondary: DEFAULT_SECONDARY_HEX },
  { id: 'ocean', name: 'Ocean', primary: '#0077B6', secondary: '#90E0EF' },
  { id: 'forest', name: 'Forest', primary: '#2D6A4F', secondary: '#B7E4C7' },
  { id: 'sunset', name: 'Sunset', primary: '#E76F51', secondary: '#F4A261' },
  { id: 'midnight', name: 'Midnight', primary: '#1B1B2F', secondary: '#E94560' },
  { id: 'lavender', name: 'Lavender', primary: '#7B2D8B', secondary: '#DDA0DD' },
  { id: 'slate', name: 'Slate', primary: '#334155', secondary: '#94A3B8' },
];
