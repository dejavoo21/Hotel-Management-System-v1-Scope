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

export async function sendEmail(payload: EmailPayload) {
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
