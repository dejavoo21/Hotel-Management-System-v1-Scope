import { Check, Eye, Palette, RotateCcw, Save } from 'lucide-react';
import type { ThemeName } from '@/theme/ThemeProvider';
import type { BackgroundName } from '@/theme/appearance';

type AppearancePanelProps = {
  theme: ThemeName;
  background: BackgroundName;
  isDirty: boolean;
  onThemeChange: (theme: ThemeName) => void;
  onBackgroundChange: (background: BackgroundName) => void;
  onSave: () => void;
  onReset: () => void;
};

const themeOptions: Array<{
  value: ThemeName;
  label: string;
  description: string;
  colors: string[];
}> = [
  {
    value: 'laflo-green',
    label: 'LaFlo Green',
    description: 'Fresh, clean and balanced.',
    colors: ['#075e54', '#0f8f7d', '#54b897', '#b9ddcf', '#e8f4ef'],
  },
  {
    value: 'ocean-blue',
    label: 'Ocean Blue',
    description: 'Calm, professional and reliable.',
    colors: ['#0369a1', '#0284c7', '#0ea5e9', '#7dd3fc', '#d7eefb'],
  },
  {
    value: 'amber-sunset',
    label: 'Amber Sunset',
    description: 'Warm, welcoming and vibrant.',
    colors: ['#9a4b08', '#d97706', '#f59e0b', '#f8c477', '#f7e5cf'],
  },
  {
    value: 'dark-mode',
    label: 'Dark Mode',
    description: 'Sleek, modern and easy on the eyes.',
    colors: ['#05080d', '#111827', '#374151', '#6b7280', '#b5bbc3'],
  },
];

const backgroundOptions: Array<{ value: BackgroundName; label: string }> = [
  { value: 'mist-gradient', label: 'Mist Gradient' },
  { value: 'linen-pattern', label: 'Linen Pattern' },
  { value: 'soft-glow', label: 'Soft Glow' },
  { value: 'dusk-horizon', label: 'Dusk Horizon' },
  { value: 'sand-wash', label: 'Sand Wash' },
  { value: 'tide-lines', label: 'Tide Lines' },
];

const themeLabel = (value: ThemeName) =>
  themeOptions.find((option) => option.value === value)?.label ?? value;

const backgroundLabel = (value: BackgroundName) =>
  backgroundOptions.find((option) => option.value === value)?.label ?? value;

function ThemePreview({ colors, dark }: { colors: string[]; dark: boolean }) {
  return (
    <div
      className={`flex h-24 overflow-hidden rounded-xl border ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}
      aria-hidden="true"
    >
      <div className="w-8 p-2" style={{ backgroundColor: colors[0] }}>
        <div className="h-3 w-3 rounded bg-white/90" />
        <div className="mt-3 space-y-1.5">
          <div className="h-1 w-3 rounded bg-white/25" />
          <div className="h-1 w-3 rounded bg-white/25" />
          <div className="h-1 w-3 rounded bg-white/25" />
        </div>
      </div>
      <div className="flex-1 p-3">
        <div className={`h-2 w-20 rounded ${dark ? 'bg-slate-600' : 'bg-slate-200'}`} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="h-8 rounded" style={{ backgroundColor: `${colors[2]}24` }} />
          <div className="flex h-8 items-center gap-2 rounded px-2" style={{ backgroundColor: `${colors[3]}35` }}>
            <div className="h-3 w-3 rounded" style={{ backgroundColor: colors[2] }} />
            <div className="h-1.5 flex-1 rounded" style={{ backgroundColor: `${colors[2]}80` }} />
          </div>
        </div>
        <div className="mt-3 h-1.5 w-24 rounded" style={{ backgroundColor: `${colors[1]}70` }} />
      </div>
    </div>
  );
}

export default function AppearancePanel({
  theme,
  background,
  isDirty,
  onThemeChange,
  onBackgroundChange,
  onSave,
  onReset,
}: AppearancePanelProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="appearance-title">
      <div className="px-5 py-6 sm:px-7 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <Palette className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 id="appearance-title" className="text-xl font-bold tracking-tight text-text-main">
                Appearance
              </h2>
              <p className="mt-1 text-sm text-text-muted">Customize the look and feel of your workspace.</p>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-3 rounded-full bg-primary-50 px-4 py-2.5 text-sm text-text-main ring-1 ring-primary-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-primary-700">
              <Eye className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              Current appearance:{' '}
              <strong className="font-semibold text-primary-700">
                {themeLabel(theme)} + {backgroundLabel(background)}
              </strong>
            </span>
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-semibold text-text-main">Theme</h3>
          <p className="mt-1 text-sm text-text-muted">Choose a color theme for your workspace.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4" role="radiogroup" aria-label="Color theme">
            {themeOptions.map((option) => {
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onThemeChange(option.value)}
                  className={`group relative rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                    selected
                      ? 'border-primary-500 bg-primary-50/40 shadow-sm ring-1 ring-primary-500/20'
                      : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md'
                  }`}
                >
                  {selected && (
                    <span className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary-solid text-white shadow-sm">
                      <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                    </span>
                  )}
                  <ThemePreview colors={option.colors} dark={option.value === 'dark-mode'} />
                  <div className="mt-4 flex gap-2" aria-hidden="true">
                    {option.colors.map((color) => (
                      <span key={color} className="h-4 w-4 rounded-full ring-1 ring-black/5" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <p className={`mt-3 font-semibold ${selected ? 'text-primary-700' : 'text-text-main'}`}>{option.label}</p>
                  <p className="mt-1 text-sm text-text-muted">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-semibold text-text-main">Background</h3>
          <p className="mt-1 text-sm text-text-muted">Choose a background style for your workspace.</p>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6" role="radiogroup" aria-label="Workspace background">
            {backgroundOptions.map((option) => {
              const selected = background === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onBackgroundChange(option.value)}
                  className={`group relative rounded-2xl border p-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                    selected
                      ? 'border-primary-600 bg-primary-50/40 shadow-sm ring-1 ring-primary-500/20'
                      : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md'
                  }`}
                >
                  {selected && (
                    <span className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary-700 text-white shadow-sm">
                      <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                    </span>
                  )}
                  <span className={`appearance-background-preview appearance-background-preview--${option.value}`} aria-hidden="true" />
                  <span className={`mt-3 block text-sm font-semibold ${selected ? 'text-primary-700' : 'text-text-main'}`}>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-bg/60 px-5 py-4 sm:flex-row sm:items-center sm:px-7 lg:px-8">
        <button type="button" className="btn-primary min-h-11 sm:min-w-44" onClick={onSave} disabled={!isDirty}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Save appearance
        </button>
        <button type="button" className="btn-secondary min-h-11 sm:min-w-40" onClick={onReset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset to default
        </button>
        {!isDirty && <span className="text-xs text-text-muted sm:ml-auto">Your appearance is saved.</span>}
      </div>
    </section>
  );
}
