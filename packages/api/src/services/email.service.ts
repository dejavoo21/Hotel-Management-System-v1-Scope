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
}

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
  // Primary (for Railway): use an email API over HTTPS.
  // Priority: Brevo (supports single Gmail sender verification) -> Resend -> SMTP (last resort)
  if (config.email.brevoApiKey) {
    return sendViaBrevo(payload);
  }

  if (config.email.resendApiKey) {
    return sendViaResend(payload);
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
