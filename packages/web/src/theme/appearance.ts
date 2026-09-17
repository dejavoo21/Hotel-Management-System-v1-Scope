export const APPEARANCE_STORAGE_KEY = 'laflo:appearance';
export const THEMES = [
  'laflo-professional',
  'ocean-blue',
  'amber-sunset',
  'forest-green',
  'slate-purple',
  'midnight-dark',
  'warm-charcoal',
] as const;
export const BACKGROUNDS = ['mist-gradient', 'linen-pattern', 'soft-glow', 'dusk-horizon', 'sand-wash', 'tide-lines'] as const;

export type ThemeName = (typeof THEMES)[number];
export type BackgroundName = (typeof BACKGROUNDS)[number];

export type AppearancePreferences = {
  theme: ThemeName;
  background: BackgroundName;
};

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: 'laflo-professional',
  background: 'mist-gradient',
};

const LEGACY_THEMES: Record<string, ThemeName> = {
  laflo: 'laflo-professional',
  'laflo-green': 'laflo-professional',
  ocean: 'ocean-blue',
  amber: 'amber-sunset',
  dark: 'midnight-dark',
  'dark-mode': 'midnight-dark',
};

const LEGACY_BACKGROUNDS: Record<string, BackgroundName> = {
  mist: 'mist-gradient',
  linen: 'linen-pattern',
  glow: 'soft-glow',
  dusk: 'dusk-horizon',
  sand: 'sand-wash',
  tide: 'tide-lines',
};

const isThemeName = (value: unknown): value is ThemeName =>
  typeof value === 'string' && THEMES.includes(value as ThemeName);

const isBackgroundName = (value: unknown): value is BackgroundName =>
  typeof value === 'string' && BACKGROUNDS.includes(value as BackgroundName);

const normalizeTheme = (value: unknown): ThemeName | undefined =>
  isThemeName(value) ? value : typeof value === 'string' ? LEGACY_THEMES[value] : undefined;

const normalizeBackground = (value: unknown): BackgroundName | undefined =>
  isBackgroundName(value)
    ? value
    : typeof value === 'string'
      ? LEGACY_BACKGROUNDS[value]
      : undefined;

export function readAppearancePreferences(): AppearancePreferences {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}') as {
      theme?: unknown;
      background?: unknown;
    };
    const legacyTheme = window.localStorage.getItem('laflo-theme') ?? window.localStorage.getItem('laflo:theme');
    const legacyBackground = window.localStorage.getItem('laflo-background');

    return {
      theme: normalizeTheme(parsed.theme) ?? normalizeTheme(legacyTheme) ?? DEFAULT_APPEARANCE.theme,
      background: normalizeBackground(parsed.background) ?? normalizeBackground(legacyBackground) ?? DEFAULT_APPEARANCE.background,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearancePreferences(preferences: AppearancePreferences) {
  window.localStorage.setItem(
    APPEARANCE_STORAGE_KEY,
    JSON.stringify({ version: 1, ...preferences })
  );
  window.localStorage.setItem('laflo-theme', preferences.theme);
  window.localStorage.setItem('laflo-background', preferences.background);
}
