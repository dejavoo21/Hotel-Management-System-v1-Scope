import { PrismaClient, VisitorStatus } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../../../.env') });
dotenv.config({ path: path.resolve(scriptDir, '../.env'), override: true });

const prisma = new PrismaClient();
const now = new Date();
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const DEMO_NOTE = 'security-center-demo';

async function main() {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!hotel) {
    throw new Error('No hotel found. Create a hotel first, then rerun the Security Center seed.');
  }

  await prisma.visitor.deleteMany({
    where: {
      hotelId: hotel.id,
      notes: DEMO_NOTE,
    },
  });

  await prisma.visitor.createMany({
    data: [
      {
        hotelId: hotel.id,
        fullName: 'Avery Morgan',
        company: 'Fire Safety Partners',
        phone: '+1 555 0101',
        email: 'avery.morgan@example.com',
        purpose: 'Quarterly alarm inspection',
        hostName: 'Operations Manager',
        checkInAt: minutesAgo(34),
        status: VisitorStatus.CHECKED_IN,
        notes: DEMO_NOTE,
      },
      {
        hotelId: hotel.id,
        fullName: 'Jordan Lee',
        company: 'Elevate Systems',
        phone: '+1 555 0102',
        email: 'jordan.lee@example.com',
        purpose: 'CCTV maintenance',
        hostName: 'Security Lead',
        checkInAt: minutesAgo(92),
        checkOutAt: minutesAgo(18),
        status: VisitorStatus.CHECKED_OUT,
        notes: DEMO_NOTE,
      },
      {
        hotelId: hotel.id,
        fullName: 'Taylor Brooks',
        company: 'Unknown',
        purpose: 'Unscheduled access request',
        hostName: 'Front Desk',
        checkInAt: minutesAgo(140),
        checkOutAt: minutesAgo(139),
        status: VisitorStatus.DENIED,
        notes: DEMO_NOTE,
      },
    ],
  });

  console.log(`Seeded Security Center demo visitors for ${hotel.name} (${hotel.id}).`);
  console.log('Visitors: 3');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
