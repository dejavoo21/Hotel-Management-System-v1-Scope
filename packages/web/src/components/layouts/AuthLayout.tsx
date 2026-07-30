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

export default function AuthLayout() {
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [language, setLanguage] = useState<'en-GB' | 'fr-FR'>('en-GB');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('laflo-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const languageSelectorRef = useRef<HTMLDivElement>(null);

  const languageLabel = language === 'en-GB' ? 'English (UK)' : 'Français';

  useEffect(() => {
    if (!languageMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!languageSelectorRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [languageMenuOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('laflo-theme', theme);
    } catch {
      // Ignore storage failures; the in-memory theme still works.
    }
  }, [theme]);

  return (
    <div className="min-h-dvh bg-[#d7ece5] lg:grid lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]">
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
          <div className="absolute bottom-8 left-0 text-[0.7rem] font-medium text-[#294b58]/80">
            <p>© {new Date().getFullYear()} LaFlo. All rights reserved.</p>
          </div>
        </div>
      </aside>

      <section className="relative min-h-dvh bg-[#d7ece5] p-0 lg:p-4" aria-label="Authentication">
        <div className="relative min-h-dvh overflow-y-auto bg-white px-7 pb-10 pt-6 lg:h-[calc(100dvh-2rem)] lg:min-h-0 lg:rounded-[26px] lg:px-10 lg:pb-10 lg:pt-8 xl:px-12">
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
                className="flex h-12 min-w-[180px] items-center gap-3 rounded-xl border border-[#c9d4e5] bg-white px-4 text-[#1f3154] shadow-sm transition hover:border-[#95a9c7] focus:outline-none focus:ring-2 focus:ring-[#079887]"
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
                  role="listbox"
                  aria-label="Language"
                  className="absolute right-0 top-[calc(100%+8px)] z-50 w-[190px] rounded-xl border border-[#d7dfeb] bg-white p-2 shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={language === 'en-GB'}
                    onClick={() => {
                      setLanguage('en-GB');
                      setLanguageMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#079887]"
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
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#079887]"
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
              onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              aria-pressed={theme === 'dark'}
              className="rounded-full p-1.5 text-[#25385f] transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#079887]"
            >
              {theme === 'light' ? (
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
            <Outlet />
          </div>
        </div>
      </section>
    </div>
  );
}
