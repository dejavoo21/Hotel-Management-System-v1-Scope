import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import './index.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const isProd = import.meta.env.PROD;
const FORCE_PWA_RESET = true;

async function resetServiceWorkerCachesOnce(): Promise<void> {
  if (!isProd || !FORCE_PWA_RESET || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const resetFlag = 'laflo:pwa-reset-v2';
  if (sessionStorage.getItem(resetFlag) === 'done') {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    sessionStorage.setItem(resetFlag, 'done');
    window.location.reload();
  } catch {
    // Ignore reset failures; app will continue with standard SW flow.
  }
}

// PWA (service worker) registration. We auto-update + reload to avoid users getting stuck on old builds.
if (isProd && !FORCE_PWA_RESET) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
  });
}

void resetServiceWorkerCachesOnce();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                borderRadius: '0.75rem',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#f8fafc',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#f8fafc',
                },
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
