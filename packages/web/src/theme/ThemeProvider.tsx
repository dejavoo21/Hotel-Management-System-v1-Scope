import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BACKGROUNDS,
  THEMES,
  readAppearancePreferences,
  type BackgroundName,
  type ThemeName,
} from './appearance';

export { THEMES, type ThemeName } from './appearance';

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  background: BackgroundName;
  setBackground: (background: BackgroundName) => void;
  themes: readonly ThemeName[];
  backgrounds: readonly BackgroundName[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const resolveInitialTheme = (): ThemeName => {
  if (typeof window === 'undefined') return 'laflo-professional';
  return readAppearancePreferences().theme;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => resolveInitialTheme());
  const [background, setBackground] = useState<BackgroundName>(() =>
    readAppearancePreferences().background
  );

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-background', background);
    document.body.dataset.background = background;
  }, [background]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      background,
      setBackground,
      themes: THEMES,
      backgrounds: BACKGROUNDS,
    }),
    [background, theme]
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
