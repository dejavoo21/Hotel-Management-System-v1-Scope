import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  mailbox?: 'onboarding' | 'support';
}

type MicrosoftToken = { accessToken: string; expiresAt: number };
let microsoftToken: MicrosoftToken | null = null;

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    throw new Error('SMTP configuration is missing');
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
    tls: {
      rejectUnauthorized: config.smtp.rejectUnauthorized,
    },
  });

  return transporter;
}

function encodeAttachmentContent(content: Buffer | string): string {
  if (Buffer.isBuffer(content)) {
    return content.toString('base64');
  }
  return Buffer.from(content).toString('base64');
}

function microsoft365Configured(): boolean {
  const { tenantId, clientId, clientSecret } = config.email.microsoft365;
  return Boolean(tenantId && clientId && clientSecret);
}

async function getMicrosoftAccessToken(): Promise<string> {
  if (microsoftToken && microsoftToken.expiresAt > Date.now() + 60_000) {
    return microsoftToken.accessToken;
  }

  const { tenantId, clientId, clientSecret } = config.email.microsoft365;
  if (!microsoft365Configured()) {
    throw new Error('Microsoft 365 email configuration is incomplete');
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !result.access_token) {
    throw new Error(
      `Microsoft identity token error: ${response.status} ${result.error_description || 'No access token returned'}`
    );
  }

  microsoftToken = {
    accessToken: result.access_token,
    expiresAt: Date.now() + (result.expires_in || 3600) * 1000,
  };
  return microsoftToken.accessToken;
}

async function sendViaMicrosoft365(payload: EmailPayload) {
  const token = await getMicrosoftAccessToken();
  const mailbox =
    payload.mailbox === 'support'
      ? config.email.microsoft365.supportMailbox
      : config.email.microsoft365.onboardingMailbox;
  const recipients = payload.to.split(',').map((item) => item.trim()).filter(Boolean);
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: payload.subject,
          body: { contentType: 'HTML', content: payload.html },
          toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
          attachments: payload.attachments?.map((attachment) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.filename,
            contentType: attachment.contentType || 'application/octet-stream',
            contentBytes: encodeAttachmentContent(attachment.content),
          })),
        },
        saveToSentItems: true,
      }),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Microsoft Graph sendMail error: ${response.status} ${detail.slice(0, 500)}`);
  }
  logger.info(`Email sent via Microsoft 365 from ${mailbox} to ${payload.to}`);
  return { accepted: true, provider: 'microsoft365', mailbox };
}

async function sendViaResend(payload: EmailPayload) {
  if (!config.email.resendApiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.email.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.email.fromAddress,
      to: payload.to.split(',').map((item) => item.trim()).filter(Boolean),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      attachments: payload.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: encodeAttachmentContent(attachment.content),
      })),
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    const errorMessage =
      (result as { message?: string; error?: { message?: string } }).error?.message ||
      (result as { message?: string }).message ||
      'Unknown Resend API error';
    throw new Error(`Resend API error: ${response.status} ${errorMessage}`);
  }

  logger.info(`Email sent via Resend to ${payload.to} (${(result as { id?: string }).id || 'no-id'})`);
  return result;
}

async function sendViaBrevo(payload: EmailPayload) {
  if (!config.email.brevoApiKey) {
    throw new Error('BREVO_API_KEY is missing');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.email.brevoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: config.email.fromName, email: config.email.fromAddress },
      replyTo: { name: config.email.fromName, email: config.email.fromAddress },
      to: payload.to
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((email) => ({ email })),
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
      attachment: payload.attachments?.map((attachment) => ({
        name: attachment.filename,
        content: encodeAttachmentContent(attachment.content),
      })),
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    const msg =
      (result as { message?: string }).message ||
      (result as { code?: string }).code ||
      'Unknown Brevo API error';
    throw new Error(`Brevo API error: ${response.status} ${msg}`);
  }

  logger.info(
    `Email sent via Brevo to ${payload.to} (${(result as { messageId?: string }).messageId || 'no-id'})`
  );
  return result;
}

export async function sendEmail(payload: EmailPayload) {
  if (config.email.provider === 'microsoft365') {
    return sendViaMicrosoft365(payload);
  }

  // Primary (for Railway): use an email API over HTTPS.
  // Automatic fallback remains available until Microsoft 365 is deliberately enabled.
  if (config.email.brevoApiKey) {
    return sendViaBrevo(payload);
  }

  if (config.email.resendApiKey) {
    return sendViaResend(payload);
  }

  if (microsoft365Configured()) {
    return sendViaMicrosoft365(payload);
  }

  const transport = getTransporter();

  const message = {
    from: config.email.fromAddress,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    attachments: payload.attachments,
  };

  const result = await transport.sendMail(message);
  logger.info(`Email sent to ${payload.to} (${result.messageId})`);
  return result;
}
