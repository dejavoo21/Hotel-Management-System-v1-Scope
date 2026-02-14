import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4010', 10),
  apiUrl: process.env.API_URL || 'http://localhost:4010',
  appUrl: process.env.APP_URL || 'http://localhost:4212',
  demoMode: process.env.DEMO_MODE === 'true',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  // Email (Resend)
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    brevoApiKey: process.env.BREVO_API_KEY || '',
    fromName: process.env.EMAIL_FROM_NAME || 'LaFlo',
    fromAddress: process.env.EMAIL_FROM || 'noreply@hotelos.com',
  },
  accessRequestNotifyEmails: process.env.ACCESS_REQUEST_NOTIFY_EMAILS
    ? process.env.ACCESS_REQUEST_NOTIFY_EMAILS.split(',').map((email) => email.trim()).filter(Boolean)
    : [],
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    rejectUnauthorized:
      process.env.SMTP_TLS_REJECT_UNAUTHORIZED === undefined
        ? true
        : process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true',
  },
  imap: {
    host: process.env.IMAP_HOST || '',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: process.env.IMAP_SECURE !== 'false',
    user: process.env.IMAP_USER || '',
    pass: process.env.IMAP_PASS || '',
    mailbox: process.env.IMAP_MAILBOX || 'INBOX',
    pollIntervalMs: parseInt(process.env.IMAP_POLL_INTERVAL_MS || '30000', 10),
  },
  clamav: {
    enabled: process.env.CLAMAV_ENABLED === 'true',
    path: process.env.CLAMAV_PATH || 'clamscan',
    timeoutMs: parseInt(process.env.CLAMAV_TIMEOUT_MS || '15000', 10),
    maxBytes: parseInt(process.env.CLAMAV_MAX_BYTES || `${10 * 1024 * 1024}`, 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
      : ['http://localhost:3000', 'http://localhost:4212'],
    credentials: true,
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
  },
} as const;

// Validation
export function validateConfig(): void {
  const required = ['databaseUrl'];

  if (config.nodeEnv === 'production') {
    required.push('jwt.secret', 'jwt.refreshSecret');
  }

  for (const key of required) {
    const keys = key.split('.');
    let value: unknown = config;
    for (const k of keys) {
      value = (value as Record<string, unknown>)[k];
    }
    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
  }
}

export default config;
