export const CUSTOM_BRANDING_PRESET = 'custom';
export const DEFAULT_TOP_BAR_PRESET = 'deutschland';
export const DEFAULT_HERO_TITLE_PRESET = 'deutschland';

export type BrandingPresetOption = {
  id: string;
  label: string;
  description: string;
  colors?: readonly string[];
};

export const TOP_BAR_PRESET_OPTIONS: BrandingPresetOption[] = [
  {
    id: 'deutschland',
    label: 'Deutschland',
    description: 'Die bisherige Schwarz-Rot-Gold-Kombination.',
    colors: ['#000000', '#CC0000', '#DDAA00'],
  },
  {
    id: 'justapps',
    label: 'JustApps',
    description: 'Blau-Gold als neutralere Plattform-Variante.',
    colors: ['#004B76', '#1A6DA3', '#DDAA00'],
  },
  {
    id: 'ozean',
    label: 'Ozean',
    description: 'Kuehle Blau- und Cyan-Tone fuer einen sachlichen Auftritt.',
    colors: ['#0F172A', '#155E75', '#67E8F9'],
  },
  {
    id: CUSTOM_BRANDING_PRESET,
    label: 'Benutzerdefiniert',
    description: 'Eigene Farben fuer individuelle Deployments.',
  },
];

export const HERO_TITLE_PRESET_OPTIONS: BrandingPresetOption[] = [
  {
    id: 'deutschland',
    label: 'Deutschland',
    description: 'Entspricht dem bisherigen Hero-Verlauf.',
    colors: ['var(--accent)', '#CC0000', '#DDAA00'],
  },
  {
    id: 'justapps',
    label: 'JustApps',
    description: 'Blau-Gold-Verlauf passend zum Branding.',
    colors: ['#004B76', 'var(--accent)', '#DDAA00'],
  },
  {
    id: 'sonnenaufgang',
    label: 'Sonnenaufgang',
    description: 'Warmer Verlauf fuer aufmerksamkeitsstarke Startseiten.',
    colors: ['#9A3412', '#EA580C', '#FACC15'],
  },
  {
    id: CUSTOM_BRANDING_PRESET,
    label: 'Benutzerdefiniert',
    description: 'Eigene Verlaufsfarben fuer den Hero-Titel.',
  },
];

function normalizeColorList(colors: string[] | undefined) {
  if (!Array.isArray(colors)) return [];

  return colors
    .slice(0, 3)
    .map((color) => (typeof color === 'string' ? color.trim() : ''));
}

function getPresetColors(options: BrandingPresetOption[], presetId: string, fallbackPresetId: string) {
  const matched = options.find((option) => option.id === presetId && Array.isArray(option.colors));
  if (matched?.colors && matched.colors.length > 0) return [...matched.colors];

  const fallback = options.find((option) => option.id === fallbackPresetId && Array.isArray(option.colors));
  return fallback?.colors ? [...fallback.colors] : [];
}

export function normalizeBrandColorList(colors: string[] | undefined) {
  return normalizeColorList(colors);
}

export function resolveTopBarColors(presetId: string, customColors: string[] | undefined) {
  const normalizedCustomColors = normalizeColorList(customColors);
  if (presetId === CUSTOM_BRANDING_PRESET && normalizedCustomColors.length === 3 && normalizedCustomColors.every(Boolean)) {
    return normalizedCustomColors;
  }

  return getPresetColors(TOP_BAR_PRESET_OPTIONS, presetId, DEFAULT_TOP_BAR_PRESET);
}

export function resolveHeroTitleColors(presetId: string, customColors: string[] | undefined) {
  const normalizedCustomColors = normalizeColorList(customColors);
  if (presetId === CUSTOM_BRANDING_PRESET && normalizedCustomColors.length === 3 && normalizedCustomColors.every(Boolean)) {
    return normalizedCustomColors;
  }

  return getPresetColors(HERO_TITLE_PRESET_OPTIONS, presetId, DEFAULT_HERO_TITLE_PRESET);
}

export function seedCustomBrandColors(customColors: string[] | undefined, fallbackColors: string[]) {
  const normalizedCustomColors = normalizeColorList(customColors);
  return fallbackColors.map((color, index) => normalizedCustomColors[index] || color).slice(0, 3);
}