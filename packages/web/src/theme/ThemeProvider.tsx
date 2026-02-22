import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const THEMES = ['laflo', 'ocean', 'amber', 'dark'] as const;
export type ThemeName = (typeof THEMES)[number];

const THEME_STORAGE_KEY = 'laflo:theme';

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: readonly ThemeName[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemeName = (value: string | null): value is ThemeName =>
  !!value && THEMES.includes(value as ThemeName);

const resolveInitialTheme = (): ThemeName => {
  if (typeof window === 'undefined') return 'laflo';
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeName(storedTheme)) return storedTheme;
  return 'laflo';
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => resolveInitialTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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
