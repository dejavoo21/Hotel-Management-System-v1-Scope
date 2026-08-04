import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { THEMES, readAppearancePreferences, type ThemeName } from './appearance';

export { THEMES, type ThemeName } from './appearance';

const THEME_STORAGE_KEY = 'laflo:theme';

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: readonly ThemeName[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const resolveInitialTheme = (): ThemeName => {
  if (typeof window === 'undefined') return 'laflo';
  return readAppearancePreferences().theme;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => resolveInitialTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.body.dataset.bg = readAppearancePreferences().background;
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themes: THEMES,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
