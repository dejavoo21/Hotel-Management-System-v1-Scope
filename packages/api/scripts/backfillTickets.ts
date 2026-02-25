/**
 * Backfill Tickets for Existing Conversations
 *
 * This script creates tickets for all conversations that don't have one.
 * Run this after deploying the Ticket + SLA feature.
 *
 * Usage:
 *   npx ts-node scripts/backfillTickets.ts
 *   # or via npm:
 *   npm run backfill:tickets
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Keyword classification rules (same as ticket.service.ts)
const KEYWORD_RULES: Array<{
  keywords: string[];
  category: 'COMPLAINT' | 'BILLING' | 'HOUSEKEEPING' | 'MAINTENANCE' | 'CONCIERGE' | 'ROOM_SERVICE' | 'CHECK_IN_OUT' | 'BOOKING' | 'OTHER';
  department: 'FRONT_DESK' | 'HOUSEKEEPING' | 'MAINTENANCE' | 'CONCIERGE' | 'BILLING' | 'MANAGEMENT';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}> = [
  {
    keywords: ['urgent', 'emergency', 'immediately', 'asap', 'critical'],
    category: 'COMPLAINT',
    department: 'MANAGEMENT',
    priority: 'URGENT',
  },
  {
    keywords: ['complaint', 'unhappy', 'disappointed', 'terrible', 'unacceptable', 'furious', 'angry'],
    category: 'COMPLAINT',
    department: 'MANAGEMENT',
    priority: 'HIGH',
  },
  {
    keywords: ['invoice', 'bill', 'charge', 'payment', 'refund', 'overcharge', 'receipt'],
    category: 'BILLING',
    department: 'BILLING',
    priority: 'MEDIUM',
  },
  {
    keywords: ['clean', 'dirty', 'towel', 'sheet', 'housekeeping', 'maid', 'tidy', 'vacuum', 'trash', 'amenities'],
    category: 'HOUSEKEEPING',
    department: 'HOUSEKEEPING',
    priority: 'MEDIUM',
  },
  {
    keywords: ['broken', 'fix', 'repair', 'maintenance', 'leak', 'noise', 'ac', 'air conditioning', 'heating', 'plumbing', 'wifi', 'internet', 'tv', 'light'],
    category: 'MAINTENANCE',
    department: 'MAINTENANCE',
    priority: 'MEDIUM',
  },
  {
    keywords: ['restaurant', 'reservation', 'taxi', 'cab', 'tour', 'recommend', 'direction', 'sightseeing', 'spa', 'gym'],
    category: 'CONCIERGE',
    department: 'CONCIERGE',
    priority: 'LOW',
  },
  {
    keywords: ['food', 'room service', 'breakfast', 'lunch', 'dinner', 'menu', 'order', 'hungry'],
    category: 'ROOM_SERVICE',
    department: 'FRONT_DESK',
    priority: 'MEDIUM',
  },
  {
    keywords: ['check-in', 'checkin', 'check-out', 'checkout', 'early', 'late', 'arrival', 'departure', 'extend', 'extension'],
    category: 'CHECK_IN_OUT',
    department: 'FRONT_DESK',
    priority: 'MEDIUM',
  },
  {
    keywords: ['booking', 'reservation', 'cancel', 'modify', 'change', 'room type', 'upgrade', 'downgrade'],
    category: 'BOOKING',
    department: 'FRONT_DESK',
    priority: 'MEDIUM',
  },
];

const DEFAULT_SLA = {
  responseMinutes: 60,
  resolutionMinutes: 480,
};

function classifyTicket(subject: string, messageText: string) {
  const text = `${subject} ${messageText}`.toLowerCase();

  for (const rule of KEYWORD_RULES) {
    const hasMatch = rule.keywords.some(keyword => text.includes(keyword));
    if (hasMatch) {
      return {
        category: rule.category,
        department: rule.department,
        priority: rule.priority,
      };
    }
  }

  return {
    category: 'OTHER' as const,
    department: 'FRONT_DESK' as const,
    priority: 'MEDIUM' as const,
  };
}

async function getSlaPolicy(hotelId: string, category: string) {
  const policy = await prisma.sLAPolicy.findFirst({
    where: {
      hotelId,
      category: category as any,
      isActive: true,
    },
  });

  const now = new Date();
  const responseMinutes = policy?.responseMinutes ?? DEFAULT_SLA.responseMinutes;
  const resolutionMinutes = policy?.resolutionMinutes ?? DEFAULT_SLA.resolutionMinutes;

  return {
    responseDueAtUtc: new Date(now.getTime() + responseMinutes * 60 * 1000),
    resolutionDueAtUtc: new Date(now.getTime() + resolutionMinutes * 60 * 1000),
  };
}

async function main() {
  console.log('Starting ticket backfill...');
  console.log('=====================================\n');

  // Find all conversations without tickets
  const conversations = await prisma.conversation.findMany({
    where: {
      ticket: null,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      booking: true,
    },
  });

  console.log(`Found ${conversations.length} conversations without tickets\n`);

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const conversation of conversations) {
    try {
      // Combine message bodies for classification
      const messageText = conversation.messages
        .map(m => m.body)
        .join(' ')
        .toLowerCase();

      // Classify
      const classification = classifyTicket(conversation.subject || '', messageText);

      // Determine ticket type
      const ticketType = conversation.booking ? 'BOOKING_RELATED' : 'GENERAL_INQUIRY';

      // Get SLA due dates
      const slaDueDates = await getSlaPolicy(conversation.hotelId, classification.category);

      // Create ticket
      await prisma.ticket.create({
        data: {
          hotelId: conversation.hotelId,
          conversationId: conversation.id,
          type: ticketType,
          category: classification.category,
          department: classification.department,
          priority: classification.priority,
          status: 'OPEN',
          responseDueAtUtc: slaDueDates.responseDueAtUtc,
          resolutionDueAtUtc: slaDueDates.resolutionDueAtUtc,
          escalatedLevel: 0,
        },
      });

      created++;
      console.log(`✓ Created ticket for conversation ${conversation.id} (${classification.category}, ${classification.priority})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Conversation ${conversation.id}: ${errorMessage}`);
      skipped++;
      console.log(`✗ Failed for conversation ${conversation.id}: ${errorMessage}`);
    }
  }

  console.log('\n=====================================');
  console.log('Backfill complete!');
  console.log(`  Total conversations: ${conversations.length}`);
  console.log(`  Tickets created: ${created}`);
  console.log(`  Skipped/errors: ${skipped}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
