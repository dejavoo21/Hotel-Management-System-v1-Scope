export const APPEARANCE_STORAGE_KEY = 'laflo:appearance';
export const THEMES = ['laflo', 'ocean', 'amber', 'dark'] as const;
export const BACKGROUNDS = ['mist', 'linen', 'glow', 'dusk', 'sand', 'tide'] as const;

export type ThemeName = (typeof THEMES)[number];
export type BackgroundName = (typeof BACKGROUNDS)[number];

export type AppearancePreferences = {
  theme: ThemeName;
  background: BackgroundName;
};

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: 'laflo',
  background: 'mist',
};

const isThemeName = (value: unknown): value is ThemeName =>
  typeof value === 'string' && THEMES.includes(value as ThemeName);

const isBackgroundName = (value: unknown): value is BackgroundName =>
  typeof value === 'string' && BACKGROUNDS.includes(value as BackgroundName);

export function readAppearancePreferences(): AppearancePreferences {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}') as {
      theme?: unknown;
      background?: unknown;
    };
    const legacyTheme = window.localStorage.getItem('laflo:theme');

    return {
      theme: isThemeName(parsed.theme)
        ? parsed.theme
        : isThemeName(legacyTheme)
          ? legacyTheme
          : DEFAULT_APPEARANCE.theme,
      background: isBackgroundName(parsed.background)
        ? parsed.background
        : DEFAULT_APPEARANCE.background,
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
}
