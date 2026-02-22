import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/services/auth';
import type { User, LoginCredentials, LoginResponse } from '@/types';

const TRUSTED_DEVICE_KEY_PREFIX = 'laflo:trusted-device:';
const getTrustedDeviceKey = (email: string) =>
  `${TRUSTED_DEVICE_KEY_PREFIX}${email.trim().toLowerCase()}`;
const getTrustedDeviceToken = (email: string) => {
  try {
    return localStorage.getItem(getTrustedDeviceKey(email));
  } catch {
    return null;
  }
};
const saveTrustedDeviceToken = (email: string, token?: string) => {
  if (!token) return;
  try {
    localStorage.setItem(getTrustedDeviceKey(email), token);
  } catch {
    // ignore storage failures
  }
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresTwoFactor: boolean;
  requiresOtpRevalidation: boolean;
  pendingEmail: string | null;
  pendingPassword: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  loginWithOtp: (
    email: string,
    code: string,
    purpose?: 'LOGIN' | 'ACCESS_REVALIDATION',
    rememberDevice?: boolean
  ) => Promise<LoginResponse>;
  verify2FA: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  setUser: (user: User) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      requiresTwoFactor: false,
      requiresOtpRevalidation: false,
      pendingEmail: null,
      pendingPassword: null,

      login: async (credentials: LoginCredentials) => {
        const trustedDeviceToken =
          credentials.trustedDeviceToken || getTrustedDeviceToken(credentials.email) || undefined;
        const response = await authService.login({
          ...credentials,
          trustedDeviceToken,
        });

        if (response.requiresTwoFactor) {
          set({
            requiresTwoFactor: true,
            requiresOtpRevalidation: false,
            pendingEmail: credentials.email,
            pendingPassword: credentials.password,
          });
          return response;
        }

        if (response.requiresOtpRevalidation) {
          set({
            requiresTwoFactor: false,
            requiresOtpRevalidation: true,
            pendingEmail: credentials.email,
            pendingPassword: credentials.password,
          });
          return response;
        }

        if (response.requiresPasswordChange) {
          set({
            user: response.user || null,
            accessToken: response.accessToken || null,
            refreshToken: response.refreshToken || null,
            isAuthenticated: Boolean(response.accessToken),
            requiresTwoFactor: false,
            requiresOtpRevalidation: false,
            pendingEmail: null,
            pendingPassword: null,
          });
          return response;
        }

        set({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          isAuthenticated: true,
          requiresTwoFactor: false,
          requiresOtpRevalidation: false,
          pendingEmail: null,
          pendingPassword: null,
        });
        saveTrustedDeviceToken(credentials.email, response.trustedDeviceToken);

        return response;
      },

      loginWithOtp: async (
        email: string,
        code: string,
        purpose: 'LOGIN' | 'ACCESS_REVALIDATION' = 'LOGIN',
        rememberDevice: boolean = false
      ) => {
        const response = await authService.verifyOtp(email, code, purpose, rememberDevice);

        if (response.requiresTwoFactor) {
          set({
            requiresTwoFactor: true,
            requiresOtpRevalidation: false,
            pendingEmail: email,
            pendingPassword: null,
          });
          return response;
        }

        set({
          user: response.user || null,
          accessToken: response.accessToken || null,
          refreshToken: response.refreshToken || null,
          isAuthenticated: Boolean(response.accessToken),
          requiresTwoFactor: false,
          requiresOtpRevalidation: false,
          pendingEmail: null,
          pendingPassword: null,
        });
        saveTrustedDeviceToken(email, response.trustedDeviceToken);

        return response;
      },

      verify2FA: async (code: string) => {
        const { pendingEmail, pendingPassword } = get();
        if (!pendingEmail || !pendingPassword) throw new Error('No pending login');

        const response = await authService.login({
          email: pendingEmail,
          password: pendingPassword,
          twoFactorCode: code,
          trustedDeviceToken: getTrustedDeviceToken(pendingEmail) || undefined,
        });

        if (response.requiresOtpRevalidation) {
          set({
            requiresTwoFactor: false,
            requiresOtpRevalidation: true,
            pendingEmail,
            pendingPassword,
          });
          return;
        }

        set({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          isAuthenticated: true,
          requiresTwoFactor: false,
          requiresOtpRevalidation: false,
          pendingEmail: null,
          pendingPassword: null,
        });
        saveTrustedDeviceToken(pendingEmail, response.trustedDeviceToken);
      },

      logout: async () => {
        const { refreshToken } = get();

        try {
          if (refreshToken) {
            await authService.logout(refreshToken);
          }
        } catch {
          // Ignore logout errors
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          requiresTwoFactor: false,
          requiresOtpRevalidation: false,
          pendingEmail: null,
          pendingPassword: null,
        });
      },

      refreshTokens: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          set({ isAuthenticated: false, isLoading: false });
          return;
        }

        try {
          const response = await authService.refreshToken(refreshToken);
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
        } catch {
          // Token refresh failed, logout
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
        }
      },

      setUser: (user: User) => set({ user }),

      initialize: async () => {
        const { accessToken, refreshToken } = get();

        if (!accessToken && !refreshToken) {
          set({ isLoading: false });
          return;
        }

        try {
          // Try to get current user
          const user = await authService.getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          // Try to refresh tokens
          if (refreshToken) {
            try {
              await get().refreshTokens();
              const user = await authService.getCurrentUser();
              set({ user, isAuthenticated: true, isLoading: false });
            } catch {
              set({
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false,
                requiresOtpRevalidation: false,
                isLoading: false,
              });
            }
          } else {
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              requiresOtpRevalidation: false,
              isLoading: false,
            });
          }
        }
      },
    }),
    {
      name: 'hotelos-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Initialize auth state on app load
useAuthStore.getState().initialize();
