import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create demo hotel
  const hotel = await prisma.hotel.upsert({
    where: { id: 'demo-hotel-1' },
    update: {},
    create: {
      id: 'demo-hotel-1',
      name: 'Grand Palace Hotel',
      address: '123 Main Street, Downtown',
      city: 'New York',
      country: 'USA',
      phone: '+1 (555) 123-4567',
      email: 'info@grandpalace.com',
      website: 'https://laflo.example',
      timezone: 'America/New_York',
      currency: 'USD',
    },
  });

  console.log(`Created hotel: ${hotel.name}`);

  // Create room types
  const roomTypes = await Promise.all([
    prisma.roomType.upsert({
      where: { id: 'rt-standard' },
      update: {},
      create: {
        id: 'rt-standard',
        hotelId: hotel.id,
        name: 'Standard',
        description: 'Comfortable room with essential amenities',
        baseRate: 99.00,
        maxGuests: 2,
        amenities: ['WiFi', 'TV', 'Air Conditioning', 'Coffee Maker'],
      },
    }),
    prisma.roomType.upsert({
      where: { id: 'rt-deluxe' },
      update: {},
      create: {
        id: 'rt-deluxe',
        hotelId: hotel.id,
        name: 'Deluxe',
        description: 'Spacious room with premium amenities and city view',
        baseRate: 149.00,
        maxGuests: 3,
        amenities: ['WiFi', 'TV', 'Air Conditioning', 'Coffee Maker', 'Mini Bar', 'City View'],
      },
    }),
    prisma.roomType.upsert({
      where: { id: 'rt-suite' },
      update: {},
      create: {
        id: 'rt-suite',
        hotelId: hotel.id,
        name: 'Suite',
        description: 'Luxury suite with separate living area and premium services',
        baseRate: 299.00,
        maxGuests: 4,
        amenities: ['WiFi', 'TV', 'Air Conditioning', 'Coffee Maker', 'Mini Bar', 'Living Room', 'Jacuzzi', 'Room Service'],
      },
    }),
  ]);

  console.log(`Created ${roomTypes.length} room types`);

  // Create rooms
  const rooms = [];
  for (let floor = 1; floor <= 4; floor++) {
    for (let num = 1; num <= 5; num++) {
      const roomNumber = `${floor}0${num}`;
      const roomTypeIndex = num <= 3 ? 0 : num === 4 ? 1 : 2;

      rooms.push(
        prisma.room.upsert({
          where: { id: `room-${roomNumber}` },
          update: {},
          create: {
            id: `room-${roomNumber}`,
            hotelId: hotel.id,
            roomTypeId: roomTypes[roomTypeIndex].id,
            number: roomNumber,
            floor: floor,
            status: 'AVAILABLE',
            housekeepingStatus: 'CLEAN',
          },
        })
      );
    }
  }

  await Promise.all(rooms);
  console.log(`Created ${rooms.length} rooms`);

  // Create users
  const passwordHash = await bcrypt.hash('Demo123!', 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@demo.hotel' },
      update: {},
      create: {
        email: 'admin@demo.hotel',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        hotelId: hotel.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'manager@demo.hotel' },
      update: {},
      create: {
        email: 'manager@demo.hotel',
        passwordHash,
        firstName: 'Hotel',
        lastName: 'Manager',
        role: 'MANAGER',
        hotelId: hotel.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'reception@demo.hotel' },
      update: {},
      create: {
        email: 'reception@demo.hotel',
        passwordHash,
        firstName: 'Front',
        lastName: 'Desk',
        role: 'RECEPTIONIST',
        hotelId: hotel.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'housekeeping@demo.hotel' },
      update: {},
      create: {
        email: 'housekeeping@demo.hotel',
        passwordHash,
        firstName: 'Housekeeping',
        lastName: 'Staff',
        role: 'HOUSEKEEPING',
        hotelId: hotel.id,
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${users.length} users`);

  // Create sample guests
  const guests = await Promise.all([
    prisma.guest.upsert({
      where: { id: 'guest-1' },
      update: {},
      create: {
        id: 'guest-1',
        hotelId: hotel.id,
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@email.com',
        phone: '+1 (555) 234-5678',
        address: '456 Oak Avenue',
        city: 'New York',
        country: 'USA',
        idType: 'Passport',
        idNumber: 'US123456789',
        nationality: 'American',
        vipStatus: true,
        totalStays: 5,
        totalSpent: 2500,
      },
    }),
    prisma.guest.upsert({
      where: { id: 'guest-2' },
      update: {},
      create: {
        id: 'guest-2',
        hotelId: hotel.id,
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.j@email.com',
        phone: '+1 (555) 345-6789',
        address: '789 Pine Street',
        city: 'Los Angeles',
        country: 'USA',
        idType: "Driver's License",
        idNumber: 'CA987654321',
        nationality: 'American',
        totalStays: 2,
        totalSpent: 800,
      },
    }),
    prisma.guest.upsert({
      where: { id: 'guest-3' },
      update: {},
      create: {
        id: 'guest-3',
        hotelId: hotel.id,
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'mchen@email.com',
        phone: '+44 20 7946 0958',
        city: 'London',
        country: 'UK',
        idType: 'Passport',
        idNumber: 'GB456789012',
        nationality: 'British',
        totalStays: 1,
        totalSpent: 450,
      },
    }),
    prisma.guest.upsert({
      where: { id: 'guest-4' },
      update: {},
      create: {
        id: 'guest-4',
        hotelId: hotel.id,
        firstName: 'Emma',
        lastName: 'Wilson',
        email: 'emma.wilson@email.com',
        phone: '+1 (555) 456-7890',
        city: 'Chicago',
        country: 'USA',
        totalStays: 0,
        totalSpent: 0,
      },
    }),
  ]);

  console.log(`Created ${guests.length} guests`);

  // Create sample bookings
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const bookings = await Promise.all([
    // Today's arrival - confirmed
    prisma.booking.upsert({
      where: { bookingRef: 'BK001' },
      update: {},
      create: {
        bookingRef: 'BK001',
        hotelId: hotel.id,
        guestId: guests[0].id,
        roomId: 'room-101',
        checkInDate: today,
        checkOutDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        numberOfAdults: 2,
        numberOfChildren: 0,
        status: 'CONFIRMED',
        source: 'DIRECT',
        roomRate: 99.00,
        totalAmount: 297.00,
        paidAmount: 297.00,
        specialRequests: 'Late check-in requested',
      },
    }),
    // Current guest - checked in
    prisma.booking.upsert({
      where: { bookingRef: 'BK002' },
      update: {},
      create: {
        bookingRef: 'BK002',
        hotelId: hotel.id,
        guestId: guests[1].id,
        roomId: 'room-201',
        checkInDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        checkOutDate: tomorrow,
        actualCheckIn: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        numberOfAdults: 1,
        numberOfChildren: 0,
        status: 'CHECKED_IN',
        source: 'BOOKING_COM',
        roomRate: 149.00,
        totalAmount: 447.00,
        paidAmount: 300.00,
      },
    }),
    // Future booking
    prisma.booking.upsert({
      where: { bookingRef: 'BK003' },
      update: {},
      create: {
        bookingRef: 'BK003',
        hotelId: hotel.id,
        guestId: guests[2].id,
        roomId: 'room-305',
        checkInDate: nextWeek,
        checkOutDate: new Date(nextWeek.getTime() + 5 * 24 * 60 * 60 * 1000),
        numberOfAdults: 2,
        numberOfChildren: 1,
        status: 'CONFIRMED',
        source: 'EXPEDIA',
        roomRate: 299.00,
        totalAmount: 1495.00,
        paidAmount: 500.00,
        specialRequests: 'Extra bed required for child',
      },
    }),
  ]);

  console.log(`Created ${bookings.length} bookings`);

  const charges = await Promise.all([
    prisma.charge.upsert({
      where: { id: 'charge-1' },
      update: {},
      create: {
        id: 'charge-1',
        bookingId: bookings[0].id,
        description: 'Room rate (3 nights)',
        category: 'ROOM',
        amount: 297.00,
        quantity: 3,
        unitPrice: 99.00,
      },
    }),
    prisma.charge.upsert({
      where: { id: 'charge-2' },
      update: {},
      create: {
        id: 'charge-2',
        bookingId: bookings[1].id,
        description: 'Room rate (3 nights)',
        category: 'ROOM',
        amount: 447.00,
        quantity: 3,
        unitPrice: 149.00,
      },
    }),
  ]);

  console.log(`Created ${charges.length} charges`);

  const payments = await Promise.all([
    prisma.payment.upsert({
      where: { id: 'payment-1' },
      update: {},
      create: {
        id: 'payment-1',
        bookingId: bookings[0].id,
        amount: 297.00,
        method: 'CREDIT_CARD',
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    }),
    prisma.payment.upsert({
      where: { id: 'payment-2' },
      update: {},
      create: {
        id: 'payment-2',
        bookingId: bookings[1].id,
        amount: 300.00,
        method: 'CREDIT_CARD',
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    }),
  ]);

  console.log(`Created ${payments.length} payments`);

  const invoices = await Promise.all([
    prisma.invoice.upsert({
      where: { invoiceNo: 'INV-1001' },
      update: {},
      create: {
        hotelId: hotel.id,
        bookingId: bookings[0].id,
        invoiceNo: 'INV-1001',
        subtotal: 297.00,
        tax: 0,
        total: 297.00,
        status: 'PAID',
        paidAt: new Date(),
      },
    }),
    prisma.invoice.upsert({
      where: { invoiceNo: 'INV-1002' },
      update: {},
      create: {
        hotelId: hotel.id,
        bookingId: bookings[1].id,
        invoiceNo: 'INV-1002',
        subtotal: 447.00,
        tax: 0,
        total: 447.00,
        status: 'PARTIALLY_PAID',
      },
    }),
  ]);

  console.log(`Created ${invoices.length} invoices`);

  const inventoryItems = await Promise.all([
    prisma.inventoryItem.upsert({
      where: { id: 'inv-1' },
      update: {},
      create: {
        id: 'inv-1',
        hotelId: hotel.id,
        name: 'Bath Towels',
        category: 'Housekeeping',
        unit: 'piece',
        quantityOnHand: 180,
        reorderPoint: 50,
        cost: 8.5,
        location: 'Laundry Storage',
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: 'inv-2' },
      update: {},
      create: {
        id: 'inv-2',
        hotelId: hotel.id,
        name: 'Shampoo Bottles',
        category: 'Amenities',
        unit: 'bottle',
        quantityOnHand: 420,
        reorderPoint: 100,
        cost: 1.2,
        location: 'Supply Closet',
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: 'inv-3' },
      update: {},
      create: {
        id: 'inv-3',
        hotelId: hotel.id,
        name: 'Coffee Pods',
        category: 'Refreshments',
        unit: 'box',
        quantityOnHand: 95,
        reorderPoint: 120,
        cost: 14.5,
        location: 'Pantry Shelf A',
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: 'inv-4' },
      update: {},
      create: {
        id: 'inv-4',
        hotelId: hotel.id,
        name: 'Room Key Cards',
        category: 'Front Desk',
        unit: 'card',
        quantityOnHand: 500,
        reorderPoint: 100,
        cost: 0.35,
        location: 'Front Desk Drawer',
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: 'inv-5' },
      update: {},
      create: {
        id: 'inv-5',
        hotelId: hotel.id,
        name: 'Cleaning Supplies',
        category: 'Housekeeping',
        unit: 'kit',
        quantityOnHand: 36,
        reorderPoint: 20,
        cost: 22,
        location: 'Housekeeping Store',
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: 'inv-6' },
      update: {},
      create: {
        id: 'inv-6',
        hotelId: hotel.id,
        name: 'Mini Bar Snacks',
        category: 'Refreshments',
        unit: 'pack',
        quantityOnHand: 28,
        reorderPoint: 40,
        cost: 3.25,
        location: 'Pantry Shelf C',
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: 'inv-7' },
      update: {},
      create: {
        id: 'inv-7',
        hotelId: hotel.id,
        name: 'Conditioner Bottles',
        category: 'Amenities',
        unit: 'bottle',
        quantityOnHand: 390,
        reorderPoint: 100,
        cost: 1.25,
        location: 'Supply Closet',
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: 'inv-8' },
      update: {},
      create: {
        id: 'inv-8',
        hotelId: hotel.id,
        name: 'Hand Soap Bars',
        category: 'Amenities',
        unit: 'bar',
        quantityOnHand: 260,
        reorderPoint: 80,
        cost: 0.85,
        location: 'Amenity Storage',
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: 'inv-9' },
      update: {},
      create: {
        id: 'inv-9',
        hotelId: hotel.id,
        name: 'Laundry Detergent',
        category: 'Housekeeping',
        unit: 'container',
        quantityOnHand: 14,
        reorderPoint: 18,
        cost: 18.75,
        location: 'Laundry Room',
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: 'inv-10' },
      update: {},
      create: {
        id: 'inv-10',
        hotelId: hotel.id,
        name: 'Toilet Paper Rolls',
        category: 'Housekeeping',
        unit: 'roll',
        quantityOnHand: 720,
        reorderPoint: 200,
        cost: 0.7,
        location: 'Bulk Store',
      },
    }),
  ]);

  console.log(`Created ${inventoryItems.length} inventory items`);

  const calendarEvents = await Promise.all([
    prisma.calendarEvent.upsert({
      where: { id: 'cal-1' },
      update: {},
      create: {
        id: 'cal-1',
        hotelId: hotel.id,
        title: 'VIP Arrival - John Smith',
        type: 'BOOKING',
        status: 'SCHEDULED',
        startAt: today,
        endAt: tomorrow,
        bookingId: bookings[0].id,
        roomId: 'room-101',
        notes: 'Prepare welcome package',
      },
    }),
    prisma.calendarEvent.upsert({
      where: { id: 'cal-2' },
      update: {},
      create: {
        id: 'cal-2',
        hotelId: hotel.id,
        title: 'Room 105 maintenance',
        type: 'MAINTENANCE',
        status: 'IN_PROGRESS',
        startAt: today,
        endAt: tomorrow,
        roomId: 'room-105',
        notes: 'Fix plumbing issue',
      },
    }),
  ]);

  console.log(`Created ${calendarEvents.length} calendar events`);

  const reviews = await Promise.all([
    prisma.review.upsert({
      where: { id: 'review-1' },
      update: {},
      create: {
        id: 'review-1',
        hotelId: hotel.id,
        guestId: guests[0].id,
        bookingId: bookings[0].id,
        rating: 5,
        source: 'DIRECT',
        comment: 'Outstanding service and spotless rooms.',
      },
    }),
    prisma.review.upsert({
      where: { id: 'review-2' },
      update: {},
      create: {
        id: 'review-2',
        hotelId: hotel.id,
        guestId: guests[1].id,
        bookingId: bookings[1].id,
        rating: 4,
        source: 'BOOKING_COM',
        comment: 'Great stay, smooth check-in.',
      },
    }),
  ]);

  console.log(`Created ${reviews.length} reviews`);

  const conciergeRequests = await Promise.all([
    prisma.conciergeRequest.upsert({
      where: { id: 'con-1' },
      update: {},
      create: {
        id: 'con-1',
        hotelId: hotel.id,
        guestId: guests[0].id,
        roomId: 'room-101',
        bookingId: bookings[0].id,
        title: 'Airport pickup',
        details: 'Pickup at 6:30 PM, sedan',
        status: 'PENDING',
        priority: 'HIGH',
        dueAt: new Date(today.getTime() + 6 * 60 * 60 * 1000),
      },
    }),
    prisma.conciergeRequest.upsert({
      where: { id: 'con-2' },
      update: {},
      create: {
        id: 'con-2',
        hotelId: hotel.id,
        guestId: guests[2].id,
        roomId: 'room-305',
        bookingId: bookings[2].id,
        title: 'Dinner reservation',
        details: 'Table for 2 at 8 PM',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        dueAt: new Date(today.getTime() + 10 * 60 * 60 * 1000),
      },
    }),
  ]);

  console.log(`Created ${conciergeRequests.length} concierge requests`);

  // Update room statuses
  await prisma.room.update({
    where: { id: 'room-201' },
    data: { status: 'OCCUPIED' },
  });

  // Make some rooms dirty for housekeeping demo
  await prisma.room.updateMany({
    where: {
      id: { in: ['room-102', 'room-203', 'room-302'] },
    },
    data: { housekeepingStatus: 'DIRTY' },
  });

  await prisma.room.update({
    where: { id: 'room-404' },
    data: { housekeepingStatus: 'INSPECTION' },
  });

  await prisma.room.update({
    where: { id: 'room-105' },
    data: { status: 'OUT_OF_SERVICE', housekeepingStatus: 'OUT_OF_SERVICE' },
  });

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
