import api from './api';
import type { LoginCredentials, LoginResponse, User } from '@/types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post('/auth/login', credentials);
    return response.data.data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken });
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data.data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data.data;
  },

  async setup2FA(): Promise<{ secret: string; qrCode: string }> {
    const response = await api.post('/auth/2fa/setup');
    const data = response.data.data || {};
    // Demo API returns `qrCodeUrl`; production returns `qrCode` (data URL).
    return {
      secret: data.secret,
      qrCode: data.qrCode || data.qrCodeUrl || data.qrCodeURL || '',
    };
  },

  async enable2FA(code: string): Promise<{ backupCodes: string[] }> {
    const response = await api.post('/auth/2fa/verify', { code });
    return response.data.data;
  },

  async disable2FA(code: string): Promise<void> {
    await api.post('/auth/2fa/disable', { code });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.patch('/auth/password', { currentPassword, newPassword });
  },

  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/password/request', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/password/reset', { token, newPassword });
  },

  async requestOtp(email: string): Promise<void> {
    await api.post('/auth/otp/request', { email, purpose: 'LOGIN' });
  },

  async requestOtpForPurpose(
    email: string,
    purpose: 'LOGIN' | 'ACCESS_REVALIDATION',
    channel: 'EMAIL' | 'SMS' = 'EMAIL',
    phone?: string
  ): Promise<void> {
    await api.post('/auth/otp/request', { email, purpose, channel, phone });
  },

  async verifyOtp(
    email: string,
    code: string,
    purpose: 'LOGIN' | 'ACCESS_REVALIDATION' = 'LOGIN'
  ): Promise<LoginResponse> {
    const response = await api.post('/auth/otp/verify', { email, code, purpose });
    return response.data.data;
  },
};

export default authService;
