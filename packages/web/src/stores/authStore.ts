import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/services/auth';
import type { User, LoginCredentials, LoginResponse } from '@/types';

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
    purpose?: 'LOGIN' | 'ACCESS_REVALIDATION'
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
        const response = await authService.login(credentials);

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

        return response;
      },

      loginWithOtp: async (
        email: string,
        code: string,
        purpose: 'LOGIN' | 'ACCESS_REVALIDATION' = 'LOGIN'
      ) => {
        const response = await authService.verifyOtp(email, code, purpose);

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

        return response;
      },

      verify2FA: async (code: string) => {
        const { pendingEmail, pendingPassword } = get();
        if (!pendingEmail || !pendingPassword) throw new Error('No pending login');

        const response = await authService.login({
          email: pendingEmail,
          password: pendingPassword,
          twoFactorCode: code,
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
