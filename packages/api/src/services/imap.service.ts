import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { mockAccessRequests, mockAccessRequestReplies, saveDemoStore, broadcastAccessRequests } from '../demo/demoRoutes.js';

const REQUEST_ID_REGEX = /AR-([a-z0-9]+)/i;

type ImapMessage = {
  uid: number;
  source: Buffer;
};

function extractRequestId(subject?: string | null, bodyText?: string | null, bodyHtml?: string | null) {
  const sources = [subject, bodyText, bodyHtml].filter(Boolean).join(' ');
  const match = sources.match(REQUEST_ID_REGEX);
  return match ? match[1] : null;
}

function mapAttachments(
  attachments: {
    filename?: string;
    contentType?: string;
    size?: number;
    content?: Buffer;
  }[]
) {
  return attachments.map((attachment) => ({
    filename: attachment.filename || 'attachment',
    contentType: attachment.contentType || 'application/octet-stream',
    size: attachment.size || 0,
    contentBase64: attachment.content ? attachment.content.toString('base64') : null,
    hasContent: Boolean(attachment.content),
  }));
}

async function processMessage(message: ImapMessage): Promise<boolean> {
  const parsed = await simpleParser(message.source);
  const messageId = parsed.messageId || `${parsed.date?.getTime() || Date.now()}-${message.uid}`;
  const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
  const subject = parsed.subject || '';
  const bodyText = parsed.text || '';
  const bodyHtml = parsed.html ? String(parsed.html) : '';

  const requestId = extractRequestId(subject, bodyText, bodyHtml);
  
  // DEMO MODE: Use mock data
  if (config.demoMode) {
    let accessRequest: any = null;
    
    // First try to match by request ID
    if (requestId) {
      accessRequest = mockAccessRequests.find((r: any) => r.id === requestId);
      if (accessRequest) {
        logger.info('Found request ID in email', { requestId, subject, fromEmail });
      }
    }
    
    // If no match by ID, try to match by email address for requests that are waiting for info
    if (!accessRequest && fromEmail) {
      accessRequest = mockAccessRequests.find((r: any) => 
        r.email?.toLowerCase() === fromEmail && 
        (r.status === 'NEEDS_INFO' || r.status === 'INFO_REQUESTED')
      );
      if (accessRequest) {
        logger.info('Matched email reply by sender email address', { 
          accessRequestId: accessRequest.id, 
          fromEmail, 
          subject 
        });
      }
    }
    
    if (!accessRequest) {
      logger.debug('No matching access request found for email', { fromEmail, subject, requestId });
      return false;
    }

    // Check for existing reply with same messageId
    const existing = mockAccessRequestReplies.find((r: any) => r.messageId === messageId);
    if (existing) {
      logger.debug('Reply already processed', { messageId });
      return true;
    }

    const attachments = mapAttachments(parsed.attachments || []);

    // Create the reply
    const newReply = {
      id: `reply-${Date.now()}`,
      accessRequestId: accessRequest.id,
      fromEmail,
      subject,
      bodyText,
      bodyHtml,
      attachments,
      messageId,
      receivedAt: (parsed.date || new Date()).toISOString(),
      createdAt: new Date().toISOString(),
    };

    mockAccessRequestReplies.push(newReply);

    // Update access request status
    accessRequest.status = 'INFO_RECEIVED';
    accessRequest.lastReplyAt = (parsed.date || new Date()).toISOString();

    saveDemoStore();
    broadcastAccessRequests();

    logger.info('Email reply processed and matched to access request (DEMO MODE)', {
      requestId: accessRequest.id,
      fromEmail,
      subject,
    });

    return true;
  }

  // Production mode: Use Prisma
  const accessRequest = await prisma.accessRequest.findFirst({ where: { id: requestId } });
  if (!accessRequest) {
    logger.warn('Access request not found for ID', { requestId });
    return false;
  }

  const existing = await prisma.accessRequestReply.findUnique({ where: { messageId } });
  if (existing) {
    return true;
  }

  const attachments = mapAttachments(parsed.attachments || []);

  await prisma.$transaction([
    prisma.accessRequestReply.create({
      data: {
        accessRequestId: accessRequest.id,
        fromEmail,
        subject,
        bodyText,
        bodyHtml,
        attachments,
        messageId,
        receivedAt: parsed.date || new Date(),
      },
    }),
    prisma.accessRequest.update({
      where: { id: accessRequest.id },
      data: { status: 'INFO_RECEIVED', lastReplyAt: parsed.date || new Date() },
    }),
  ]);

  return true;
}

async function fetchNewMessages(client: ImapFlow): Promise<number> {
  const mailbox = await client.getMailboxLock(config.imap.mailbox);
  let processed = 0;

  try {
    const unseen = await client.search({ unseen: true });
    if (!unseen.length) {
      return 0;
    }

    for (const uid of unseen) {
      const fetched = await client.fetchOne(uid, { source: true });
      if (!fetched?.source) {
        continue;
      }
      const didProcess = await processMessage({ uid, source: fetched.source });
      if (didProcess) {
        processed += 1;
      }
      await client.messageFlagsAdd(uid, ['\\Seen']);
    }
  } finally {
    mailbox.release();
  }

  return processed;
}

// Scan recent emails (including already read ones) to catch any missed replies
async function scanRecentEmails(client: ImapFlow): Promise<number> {
  logger.info('Starting scan of recent emails to catch missed replies...');
  
  let processed = 0;

  try {
    // Get the mailbox status first
    const status = await client.status(config.imap.mailbox, { messages: true });
    const totalMessages = status.messages || 0;
    
    if (totalMessages === 0) {
      logger.info('No messages in mailbox to scan');
      return 0;
    }

    const startSeq = Math.max(1, totalMessages - 49);
    const range = `${startSeq}:*`;
    
    logger.info(`Scanning messages ${startSeq} to ${totalMessages}...`);
    
    // Now get the lock and fetch
    const mailbox = await client.getMailboxLock(config.imap.mailbox);
    
    try {
      for await (const msg of client.fetch(range, { source: true })) {
        if (!msg?.source) continue;
        
        const didProcess = await processMessage({ uid: msg.uid, source: msg.source });
        if (didProcess) {
          processed += 1;
        }
      }
    } finally {
      mailbox.release();
    }
    
    if (processed > 0) {
      logger.info(`Found ${processed} missed replies during startup scan`);
    } else {
      logger.info('No missed replies found in recent emails');
    }
  } catch (error) {
    logger.error('Error scanning recent emails', error);
  }

  return processed;
}

export async function startImapPolling(): Promise<void> {
  if (!config.imap.host || !config.imap.user || !config.imap.pass) {
    logger.warn('IMAP configuration missing; skipping inbox polling.');
    return;
  }

  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: {
      user: config.imap.user,
      pass: config.imap.pass,
    },
  });

  client.on('error', (error) => {
    logger.error('IMAP connection error', error);
  });

  await client.connect();
  logger.info('IMAP polling connected');

  // On startup, scan recent emails to catch any missed replies
  if (config.demoMode) {
    await scanRecentEmails(client);
  }

  const poll = async () => {
    try {
      const processed = await fetchNewMessages(client);
      if (processed > 0) {
        logger.info(`Processed ${processed} access request replies.`);
      }
    } catch (error) {
      logger.error('IMAP polling error', error);
    }
  };

  await poll();
  setInterval(poll, config.imap.pollIntervalMs);
}
