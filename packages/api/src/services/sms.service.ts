import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

export interface SmsPayload {
  to: string;
  message: string;
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, '');
}

export async function sendSms(payload: SmsPayload) {
  const to = normalizePhone(payload.to);
  const from = config.sms.fromPhone;
  const sid = config.sms.twilioAccountSid;
  const token = config.sms.twilioAuthToken;

  if (!sid || !token || !from) {
    logger.info(`[SMS_MOCK] To ${to}: ${payload.message}`);
    return { success: true, mocked: true };
  }

  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: payload.message,
  });

  const credentials = Buffer.from(`${sid}:${token}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    }
  );

  const result = await response.json();
  if (!response.ok) {
    const message =
      (result as { message?: string; detail?: string }).message ||
      (result as { detail?: string }).detail ||
      'Unknown Twilio error';
    throw new Error(`Twilio SMS error: ${response.status} ${message}`);
  }

  logger.info(`SMS sent to ${to}`);
  return { success: true, mocked: false };
}

