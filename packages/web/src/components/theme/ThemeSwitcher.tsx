import { useTheme, type ThemeName } from '@/theme/ThemeProvider';

const THEME_LABELS: Record<ThemeName, string> = {
  laflo: 'LaFlo Green',
  ocean: 'Ocean Blue',
  amber: 'Amber Sunset',
  dark: 'Dark Mode',
};

export default function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {themes.map((option) => {
        const selected = option === theme;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
              selected
                ? 'border-primary-500 bg-primary-solid/10 text-primary-700'
                : 'border-border bg-card text-text-muted hover:border-primary-400/50 hover:text-text-main'
            }`}
          >
            <div className="font-medium text-text-main">{THEME_LABELS[option]}</div>
            <div className="mt-1 text-xs text-text-muted">Primary accents and contrast tokens</div>
          </button>
        );
      })}
    </div>
  );
}
