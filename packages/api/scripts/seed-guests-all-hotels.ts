import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32) || 'hotel';
}

async function seedHotel(hotelId: string, hotelName: string) {
  const activeGuestCount = await prisma.guest.count({
    where: { hotelId, isDeleted: false },
  });

  const room = await prisma.room.findFirst({
    where: { hotelId },
    select: { id: true },
  });

  if (activeGuestCount > 0) {
    console.log(`Hotel ${hotelId} already has ${activeGuestCount} guests, skipping guest creation.`);
    return;
  }

  const slug = slugify(hotelName);
  const guests = [
    { firstName: 'John', lastName: 'Smith', email: `${slug}-guest1@laflo.seed`, phone: '+1-555-0101' },
    { firstName: 'Sarah', lastName: 'Johnson', email: `${slug}-guest2@laflo.seed`, phone: '+1-555-0102' },
    { firstName: 'Michael', lastName: 'Chen', email: `${slug}-guest3@laflo.seed`, phone: '+1-555-0103' },
    { firstName: 'Emma', lastName: 'Wilson', email: `${slug}-guest4@laflo.seed`, phone: '+1-555-0104' },
  ];

  const createdGuests = [];
  for (const g of guests) {
    const guest = await prisma.guest.upsert({
      where: { email: g.email },
      update: {
        hotelId,
        firstName: g.firstName,
        lastName: g.lastName,
        phone: g.phone,
        isDeleted: false,
      },
      create: {
        hotelId,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        phone: g.phone,
        city: 'New York',
        country: 'USA',
        nationality: 'American',
      },
    });
    createdGuests.push(guest);
  }

  console.log(`Created/updated ${createdGuests.length} guests for hotel ${hotelId}.`);

  const bookingCount = await prisma.booking.count({ where: { hotelId } });
  if (bookingCount > 0 || !room) {
    console.log(`Hotel ${hotelId} already has bookings (${bookingCount}) or no rooms available, skipping booking seed.`);
    return;
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const twoDays = new Date(today);
  twoDays.setDate(today.getDate() + 2);
  const fiveDays = new Date(today);
  fiveDays.setDate(today.getDate() + 5);

  await prisma.booking.createMany({
    data: [
      {
        bookingRef: `${slug.toUpperCase().slice(0, 6)}-BK1`,
        hotelId,
        guestId: createdGuests[0]!.id,
        roomId: room.id,
        checkInDate: today,
        checkOutDate: twoDays,
        numberOfAdults: 2,
        numberOfChildren: 0,
        status: 'CONFIRMED',
        source: 'DIRECT',
        roomRate: 129,
        totalAmount: 258,
        paidAmount: 129,
      },
      {
        bookingRef: `${slug.toUpperCase().slice(0, 6)}-BK2`,
        hotelId,
        guestId: createdGuests[1]!.id,
        roomId: room.id,
        checkInDate: tomorrow,
        checkOutDate: fiveDays,
        numberOfAdults: 1,
        numberOfChildren: 0,
        status: 'CONFIRMED',
        source: 'DIRECT',
        roomRate: 139,
        totalAmount: 556,
        paidAmount: 0,
      },
    ],
  });

  console.log(`Created 2 bookings for hotel ${hotelId}.`);
}

async function main() {
  const hotels = await prisma.hotel.findMany({
    select: { id: true, name: true },
  });

  if (!hotels.length) {
    console.log('No hotels found.');
    return;
  }

  for (const hotel of hotels) {
    await seedHotel(hotel.id, hotel.name);
  }
}

main()
  .catch((error) => {
    console.error('Failed seeding guests for hotels:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

