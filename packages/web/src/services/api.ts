import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';

// In development, use relative path to go through Vite proxy
// In production, use the configured API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = String(originalRequest?.url || '');
    const isPublicAuthRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/otp/') ||
      requestUrl.includes('/auth/password/') ||
      requestUrl.includes('/auth/2fa/verify-backup');

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry && !isPublicAuthRequest) {
      originalRequest._retry = true;

      try {
        const { refreshToken } = useAuthStore.getState();
        if (!refreshToken) {
          return Promise.reject(error);
        }

        // Try to refresh the token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

        // Update store with new tokens
        useAuthStore.setState({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        });

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined;
        // Only force logout when refresh token is actually invalid/unauthorized.
        if (status === 401 || status === 403) {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API error helper
export interface ApiError {
  message: string;
  errorCode?: string;
  errors?: { field: string; message: string }[];
}

export function getApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const rawMessage = String(data?.message || data?.error || '').trim();
    const normalized = rawMessage.toLowerCase();
    let message = rawMessage || 'We could not complete that request. Please try again.';

    if (normalized.includes('pending approval')) {
      message = 'Your access request is pending approval.';
    } else if (normalized.includes('password not set') || normalized.includes('setup is incomplete')) {
      message = 'Your account is approved, but your password has not been set.';
    } else if (normalized.includes('not approved') || normalized.includes('rejected')) {
      message = 'Your access request was rejected.';
    } else if (normalized.includes('disabled') || normalized.includes('inactive')) {
      message = 'Your account is disabled. Contact an administrator.';
    } else if (normalized.includes('invalid email or password') || normalized.includes('invalid credentials')) {
      message = 'Invalid email or password.';
    } else if (normalized.includes('verification code') && normalized.includes('expired')) {
      message = 'Verification code expired. Request a new code.';
    } else if (normalized.includes('password') && normalized.includes('do not match')) {
      message = 'Passwords do not match.';
    }
    return {
      message,
      errorCode: data?.errorCode,
      errors: data?.errors,
    };
  }
  if (error instanceof Error && error.message) {
    return { message: error.message };
  }
  return { message: 'We could not complete that request. Please try again.' };
}

export default api;
