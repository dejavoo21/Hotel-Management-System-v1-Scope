import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GlobeAltIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import AuthInsightsCarousel from '@/components/auth/AuthInsightsCarousel';
import { useTheme } from '@/theme/ThemeProvider';

export type AuthLanguage = 'en-GB' | 'fr-FR';

export type AuthLayoutContext = {
  language: AuthLanguage;
  isDark: boolean;
};

export default function AuthLayout() {
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [language, setLanguage] = useState<AuthLanguage>(() => {
    try {
      return localStorage.getItem('laflo:language') === 'fr-FR' ? 'fr-FR' : 'en-GB';
    } catch {
      return 'en-GB';
    }
  });
  const { theme, setTheme } = useTheme();
  const languageSelectorRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  const languageLabel = language === 'en-GB' ? 'English (UK)' : 'Français';

  useEffect(() => {
    if (!languageMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!languageSelectorRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [languageMenuOpen]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('laflo:language', language);
    } catch {
      // The selected language remains active for this session.
    }
  }, [language]);

  return (
    <div
      className={`min-h-dvh lg:grid lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] ${
        isDark ? 'bg-[#081923]' : 'bg-[#d7ece5]'
      }`}
    >
      <aside
        className="relative hidden min-h-dvh overflow-hidden bg-[#eaf5f0] lg:flex lg:flex-col"
        aria-label="LaFlo hotel operations overview"
      >
        <img
          src="/assets/auth/laflo-hotel-login-bg-v3.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-[#5eb6a0]/10"
          aria-hidden="true"
        />

        <div className="relative z-10 flex min-h-dvh flex-col px-12 py-9 xl:px-[52px] xl:pb-10 xl:pt-14">
          <img
            src="/laflo-logo.png"
            alt="LaFlo"
            className="h-10 w-auto max-w-[154px] object-contain object-left xl:h-12 xl:max-w-[172px]"
          />

          <div className="mt-16 max-w-[510px] xl:mt-20">
            <h1 className="text-[2.8rem] font-extrabold leading-[1.08] tracking-[-0.045em] text-[#07132b] xl:text-[3.25rem]">
              Modern Hotel
              <br />
              Management,
              <br />
              <span className="text-[#079887]">Simplified.</span>
            </h1>
            <p className="mt-6 max-w-[430px] text-lg font-medium leading-8 text-[#334568] xl:text-xl">
              Everything you need to run operations,
              <br />
              delight guests, and grow your business.
            </p>
          </div>

          <div className="absolute bottom-[68px] left-[34%] w-[64%] max-w-[500px] xl:left-[44%] xl:w-[52%]">
            <AuthInsightsCarousel />
          </div>
          <div className="absolute bottom-8 left-4 text-[0.7rem] font-medium text-[#294b58]/80 xl:left-5">
            <p>© {new Date().getFullYear()} LaFlo. All rights reserved.</p>
          </div>
        </div>
      </aside>

      <section
        className={`relative min-h-dvh p-0 transition-colors duration-200 lg:p-4 ${
          isDark ? 'bg-[#081923]' : 'bg-[#d7ece5]'
        }`}
        aria-label="Authentication"
      >
        <div
          className={`auth-panel relative min-h-dvh overflow-y-auto px-7 pb-10 pt-6 transition-colors duration-200 lg:h-[calc(100dvh-2rem)] lg:min-h-0 lg:rounded-[26px] lg:px-10 lg:pb-10 lg:pt-8 xl:px-12 ${
            isDark ? 'bg-[#0f202a]' : 'bg-white'
          }`}
        >
          <div className="relative z-40 flex h-12 w-full items-center justify-end gap-4 text-sm font-semibold text-[#1f3154]">
            <div
              ref={languageSelectorRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() => setLanguageMenuOpen((open) => !open)}
                aria-expanded={languageMenuOpen}
                aria-haspopup="listbox"
                aria-controls="auth-language-menu"
                className={`flex h-12 min-w-[180px] items-center gap-3 rounded-xl border px-4 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#079887] ${
                  isDark
                    ? 'border-[#36515f] bg-[#152c37] text-slate-100 hover:border-[#5c7987]'
                    : 'border-[#c9d4e5] bg-white text-[#1f3154] hover:border-[#95a9c7]'
                }`}
              >
                <GlobeAltIcon className="h-5 w-5" aria-hidden="true" />
                <span className="flex-1 text-left">{languageLabel}</span>
                {languageMenuOpen ? (
                  <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              {languageMenuOpen && (
                <div
                  id="auth-language-menu"
                  role="listbox"
                  aria-label="Language"
                  className={`absolute right-0 top-[calc(100%+8px)] z-50 w-[190px] rounded-xl border p-2 shadow-[0_12px_30px_rgba(15,23,42,0.18)] ${
                    isDark
                      ? 'border-[#36515f] bg-[#152c37] text-slate-100'
                      : 'border-[#d7dfeb] bg-white text-[#1f3154]'
                  }`}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={language === 'en-GB'}
                    onClick={() => {
                      setLanguage('en-GB');
                      setLanguageMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#079887] ${
                      isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    <GlobeAltIcon className="h-5 w-5" aria-hidden="true" />
                    <span className="flex-1">English (UK)</span>
                    {language === 'en-GB' && <CheckIcon className="h-5 w-5" aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    role="option"
                    aria-selected={language === 'fr-FR'}
                    onClick={() => {
                      setLanguage('fr-FR');
                      setLanguageMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#079887] ${
                      isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-[#eef2ff] text-[0.58rem] font-extrabold text-[#294b8d]">FR</span>
                    <span className="flex-1">Français</span>
                    {language === 'fr-FR' && <CheckIcon className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'laflo' : 'dark')}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-pressed={isDark}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#079887] ${
                isDark ? 'bg-[#152c37] text-amber-300 hover:bg-[#1c3743]' : 'text-[#25385f] hover:bg-slate-100'
              }`}
            >
              {!isDark ? (
                <MoonIcon className="h-5 w-5" aria-hidden="true" />
              ) : (
                <SunIcon className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>

          <div
            className={`mx-auto w-full max-w-[600px] transition-[margin] duration-200 ${
              languageMenuOpen ? 'mt-[132px]' : 'mt-24'
            }`}
          >
            <Outlet context={{ language, isDark } satisfies AuthLayoutContext} />
          </div>
        </div>
      </section>
    </div>
  );
}
