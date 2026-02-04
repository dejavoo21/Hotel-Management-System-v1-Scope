/**
 * Mock data for demo mode (no database required)
 */

export const mockHotel = {
  id: 'hotel-1',
  name: 'Grand Hotel Demo',
  address: '123 Demo Street, City',
  phone: '+1 234 567 8900',
  email: 'info@grandhoteldemo.com',
  timezone: 'UTC',
  currency: 'USD',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockFloors = [
  {
    id: 'floor-1',
    hotelId: 'hotel-1',
    number: 1,
    name: 'Lobby',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'floor-2',
    hotelId: 'hotel-1',
    number: 2,
    name: 'Deluxe',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'floor-3',
    hotelId: 'hotel-1',
    number: 3,
    name: 'Suites',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'floor-4',
    hotelId: 'hotel-1',
    number: 4,
    name: 'Penthouse',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockUsers = [
  {
    id: 'user-1',
    email: 'admin@demo.hotel',
    passwordHash: '$2a$12$QlcbF11SDn2re.sl2iMjYOffeG0p3cPVt/s8dxsGi68VGyG3aGyti', // Demo123!
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    hotelId: 'hotel-1',
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-2',
    email: 'manager@demo.hotel',
    passwordHash: '$2a$12$QlcbF11SDn2re.sl2iMjYOffeG0p3cPVt/s8dxsGi68VGyG3aGyti', // Demo123!
    firstName: 'Manager',
    lastName: 'User',
    role: 'MANAGER',
    hotelId: 'hotel-1',
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-3',
    email: 'reception@demo.hotel',
    passwordHash: '$2a$12$QlcbF11SDn2re.sl2iMjYOffeG0p3cPVt/s8dxsGi68VGyG3aGyti', // Demo123!
    firstName: 'Front',
    lastName: 'Desk',
    role: 'RECEPTIONIST',
    hotelId: 'hotel-1',
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockRoomTypes = [
  {
    id: 'rt-1',
    hotelId: 'hotel-1',
    name: 'Single Room',
    description: 'Cozy room designed for solo travelers',
    baseRate: 89.00,
    maxGuests: 2,
    amenities: ['WiFi', 'TV', 'AC', 'Mini Fridge'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rt-2',
    hotelId: 'hotel-1',
    name: 'Deluxe Room',
    description: 'Spacious room with premium amenities',
    baseRate: 149.00,
    maxGuests: 3,
    amenities: ['WiFi', 'TV', 'AC', 'Mini Fridge', 'Minibar', 'City View'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rt-3',
    hotelId: 'hotel-1',
    name: 'Suite',
    description: 'Luxury suite with separate living area',
    baseRate: 249.00,
    maxGuests: 4,
    amenities: ['WiFi', 'TV', 'AC', 'Mini Fridge', 'Minibar', 'City View', 'Jacuzzi', 'Living Room'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rt-4',
    hotelId: 'hotel-1',
    name: 'Double Room',
    description: 'Comfortable double room with extra space',
    baseRate: 119.00,
    maxGuests: 2,
    amenities: ['WiFi', 'TV', 'AC', 'Desk'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rt-5',
    hotelId: 'hotel-1',
    name: 'Queen Room',
    description: 'Queen bed room with upgraded linens',
    baseRate: 129.00,
    maxGuests: 2,
    amenities: ['WiFi', 'TV', 'AC', 'Desk', 'Coffee Maker'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rt-6',
    hotelId: 'hotel-1',
    name: 'King Room',
    description: 'Spacious king room with premium bedding',
    baseRate: 159.00,
    maxGuests: 2,
    amenities: ['WiFi', 'TV', 'AC', 'Desk', 'City View'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rt-7',
    hotelId: 'hotel-1',
    name: 'Twin Room',
    description: 'Twin beds ideal for shared stays',
    baseRate: 109.00,
    maxGuests: 2,
    amenities: ['WiFi', 'TV', 'AC', 'Desk'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockInventory = [
  {
    id: 'inv-1',
    hotelId: 'hotel-1',
    name: 'Bath Towels',
    category: 'Housekeeping',
    unit: 'piece',
    quantityOnHand: 180,
    reorderPoint: 50,
    cost: 4.5,
    location: 'Laundry Storage',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'inv-2',
    hotelId: 'hotel-1',
    name: 'Shampoo Bottles',
    category: 'Amenities',
    unit: 'bottle',
    quantityOnHand: 420,
    reorderPoint: 100,
    cost: 1.2,
    location: 'Supply Closet',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockRooms = [
  // Floor 1 - Standard
  { id: 'room-101', hotelId: 'hotel-1', roomTypeId: 'rt-1', number: '101', floor: 1, status: 'AVAILABLE', housekeepingStatus: 'CLEAN', notes: null },
  { id: 'room-102', hotelId: 'hotel-1', roomTypeId: 'rt-1', number: '102', floor: 1, status: 'OCCUPIED', housekeepingStatus: 'CLEAN', notes: null },
  { id: 'room-103', hotelId: 'hotel-1', roomTypeId: 'rt-1', number: '103', floor: 1, status: 'AVAILABLE', housekeepingStatus: 'DIRTY', notes: null },
  { id: 'room-104', hotelId: 'hotel-1', roomTypeId: 'rt-1', number: '104', floor: 1, status: 'AVAILABLE', housekeepingStatus: 'CLEAN', notes: null },
  { id: 'room-105', hotelId: 'hotel-1', roomTypeId: 'rt-1', number: '105', floor: 1, status: 'OUT_OF_SERVICE', housekeepingStatus: 'OUT_OF_SERVICE', notes: 'Under maintenance' },
  // Floor 2 - Deluxe
  { id: 'room-201', hotelId: 'hotel-1', roomTypeId: 'rt-2', number: '201', floor: 2, status: 'AVAILABLE', housekeepingStatus: 'CLEAN', notes: null },
  { id: 'room-202', hotelId: 'hotel-1', roomTypeId: 'rt-2', number: '202', floor: 2, status: 'OCCUPIED', housekeepingStatus: 'CLEAN', notes: null },
  { id: 'room-203', hotelId: 'hotel-1', roomTypeId: 'rt-2', number: '203', floor: 2, status: 'AVAILABLE', housekeepingStatus: 'INSPECTION', notes: null },
  { id: 'room-204', hotelId: 'hotel-1', roomTypeId: 'rt-2', number: '204', floor: 2, status: 'AVAILABLE', housekeepingStatus: 'CLEAN', notes: null },
  { id: 'room-205', hotelId: 'hotel-1', roomTypeId: 'rt-2', number: '205', floor: 2, status: 'AVAILABLE', housekeepingStatus: 'DIRTY', notes: null },
  // Floor 3 - Suites
  { id: 'room-301', hotelId: 'hotel-1', roomTypeId: 'rt-3', number: '301', floor: 3, status: 'AVAILABLE', housekeepingStatus: 'CLEAN', notes: null },
  { id: 'room-302', hotelId: 'hotel-1', roomTypeId: 'rt-3', number: '302', floor: 3, status: 'OCCUPIED', housekeepingStatus: 'CLEAN', notes: 'VIP Guest' },
  { id: 'room-303', hotelId: 'hotel-1', roomTypeId: 'rt-3', number: '303', floor: 3, status: 'AVAILABLE', housekeepingStatus: 'CLEAN', notes: null },
].map(room => ({ ...room, createdAt: new Date(), updatedAt: new Date() }));

export const mockGuests = [
  {
    id: 'guest-1',
    hotelId: 'hotel-1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@email.com',
    phone: '+1 555 123 4567',
    address: '456 Guest Ave, New York, NY',
    idType: 'Passport',
    idNumber: 'P123456789',
    nationality: 'US',
    vipStatus: false,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'guest-2',
    hotelId: 'hotel-1',
    firstName: 'Emily',
    lastName: 'Johnson',
    email: 'emily.j@email.com',
    phone: '+1 555 987 6543',
    address: '789 Traveler Blvd, Los Angeles, CA',
    idType: 'Driver License',
    idNumber: 'DL987654321',
    nationality: 'US',
    vipStatus: true,
    notes: 'Prefers high floor, quiet room',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'guest-3',
    hotelId: 'hotel-1',
    firstName: 'Michael',
    lastName: 'Brown',
    email: 'mbrown@corporate.com',
    phone: '+1 555 456 7890',
    address: '321 Business St, Chicago, IL',
    idType: 'Passport',
    idNumber: 'P987654321',
    nationality: 'UK',
    vipStatus: false,
    notes: 'Corporate account',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const dayAfter = new Date(today);
dayAfter.setDate(dayAfter.getDate() + 2);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

export const mockBookings = [
  {
    id: 'booking-1',
    hotelId: 'hotel-1',
    guestId: 'guest-1',
    roomId: 'room-102',
    bookingRef: 'BK-2024-001',
    checkInDate: yesterday,
    checkOutDate: tomorrow,
    numberOfGuests: 2,
    status: 'CHECKED_IN',
    source: 'DIRECT',
    specialRequests: 'Late checkout if possible',
    totalAmount: 198.00,
    paidAmount: 198.00,
    paymentConfirmed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'booking-2',
    hotelId: 'hotel-1',
    guestId: 'guest-2',
    roomId: 'room-302',
    bookingRef: 'BK-2024-002',
    checkInDate: yesterday,
    checkOutDate: dayAfter,
    numberOfGuests: 2,
    status: 'CHECKED_IN',
    source: 'BOOKING_COM',
    specialRequests: 'Champagne on arrival',
    totalAmount: 747.00,
    paidAmount: 747.00,
    paymentConfirmed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'booking-3',
    hotelId: 'hotel-1',
    guestId: 'guest-3',
    roomId: 'room-202',
    bookingRef: 'BK-2024-003',
    checkInDate: today,
    checkOutDate: dayAfter,
    numberOfGuests: 1,
    status: 'CHECKED_IN',
    source: 'CORPORATE',
    specialRequests: null,
    totalAmount: 298.00,
    paidAmount: 150.00,
    paymentConfirmed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'booking-4',
    hotelId: 'hotel-1',
    guestId: 'guest-1',
    roomId: 'room-201',
    bookingRef: 'BK-2024-004',
    checkInDate: tomorrow,
    checkOutDate: dayAfter,
    numberOfGuests: 2,
    status: 'CONFIRMED',
    source: 'DIRECT',
    specialRequests: 'Early check-in',
    totalAmount: 149.00,
    paidAmount: 0,
    paymentConfirmed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockPayments = mockBookings.map((booking) => ({
  id: `payment-${booking.id}`,
  bookingId: booking.id,
  hotelId: booking.hotelId,
  guestId: booking.guestId,
  amount: booking.paidAmount,
  method: 'CASH',
  processedAt: booking.updatedAt,
  status: 'COMPLETED',
  reference: `PMT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
  createdAt: booking.updatedAt,
  updatedAt: booking.updatedAt,
}));


export const mockInvoices: {
  id: string;
  hotelId: string;
  bookingId: string;
  invoiceNo: string;
  subtotal: number;
  tax: number;
  total: number;
  issuedAt: Date;
  status: 'PENDING' | 'PAID';
  createdAt: Date;
  updatedAt: Date;
}[] = [];

// Helper to get room with roomType
export function getRoomWithType(room: typeof mockRooms[0]) {
  const roomType = mockRoomTypes.find(rt => rt.id === room.roomTypeId);
  return { ...room, roomType };
}

// Helper to get booking with relations
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getBookingNights(booking: typeof mockBookings[0]) {
  const checkIn = booking.checkInDate instanceof Date ? booking.checkInDate : new Date(booking.checkInDate);
  const checkOut = booking.checkOutDate instanceof Date ? booking.checkOutDate : new Date(booking.checkOutDate);
  const diff = Math.max(Math.ceil((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY), 1);
  return diff;
}

function buildRoomCharge(booking: typeof mockBookings[0], roomWithType: ReturnType<typeof getRoomWithType>) {
  const nights = getBookingNights(booking);
  const rate = roomWithType.roomType?.baseRate || roomWithType.roomType?.baseRate || 100;
  return {
    id: `charge-${booking.id}`,
    bookingId: booking.id,
    description: `Room - ${roomWithType.roomType.name}`,
    category: 'ROOM',
    quantity: nights,
    unitPrice: rate,
    amount: rate * nights,
    isVoided: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function getBookingCharges(booking: typeof mockBookings[0]) {
  const room = mockRooms.find(r => r.id === booking.roomId);
  if (!room) return [];
  const roomWithType = getRoomWithType(room);
  return [buildRoomCharge(booking, roomWithType)];
}

export function getBookingPayments(booking: typeof mockBookings[0]) {
  return mockPayments.filter((payment) => payment.bookingId === booking.id);
}

export function getBookingInvoices(booking: typeof mockBookings[0]) {
  return mockInvoices.filter(inv => inv.bookingId === booking.id);
}

export function getBookingWithRelations(booking: typeof mockBookings[0]) {
  const guest = mockGuests.find(g => g.id === booking.guestId);
  const room = mockRooms.find(r => r.id === booking.roomId);
  const roomWithType = room ? getRoomWithType(room) : null;
  const charges = roomWithType ? getBookingCharges(booking) : [];
  const payments = getBookingPayments(booking);
  const invoices = getBookingInvoices(booking);
  return { ...booking, guest, room: roomWithType, charges, payments, invoices };
}

const now = new Date();

export const mockConversations = [
  {
    id: 'conv-1',
    hotelId: 'hotel-1',
    guestId: 'guest-1',
    bookingId: 'booking-1',
    subject: 'Request for towels',
    status: 'OPEN',
    lastMessageAt: new Date(now.getTime() - 5 * 60 * 1000),
    messages: [
      {
        id: 'msg-1',
        senderType: 'GUEST',
        body: 'Hi, can I request extra towels for room 102?',
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
        guestId: 'guest-1',
      },
      {
        id: 'msg-2',
        senderType: 'STAFF',
        body: 'Sure thing, housekeeping is on the way.',
        createdAt: new Date(now.getTime() - 10 * 60 * 1000),
        senderUserId: 'user-3',
      },
      {
        id: 'msg-3',
        senderType: 'SYSTEM',
        body: 'Reservation created for housekeeping prep.',
        createdAt: new Date(now.getTime() - 5 * 60 * 1000),
      },
    ],
  },
  {
    id: 'conv-2',
    hotelId: 'hotel-1',
    guestId: 'guest-2',
    bookingId: 'booking-2',
    subject: 'Welcome requirements',
    status: 'RESOLVED',
    lastMessageAt: new Date(now.getTime() - 45 * 60 * 1000),
    messages: [
      {
        id: 'msg-4',
        senderType: 'GUEST',
        body: 'Please leave champagne at the door.',
        createdAt: new Date(now.getTime() - 50 * 60 * 1000),
        guestId: 'guest-2',
      },
      {
        id: 'msg-5',
        senderType: 'STAFF',
        body: 'Absolutely, consider it done.',
        createdAt: new Date(now.getTime() - 45 * 60 * 1000),
        senderUserId: 'user-2',
      },
    ],
  },
  {
    id: 'conv-3',
    hotelId: 'hotel-1',
    guestId: 'guest-3',
    bookingId: 'booking-3',
    subject: 'Corporate payment follow-up',
    status: 'OPEN',
    lastMessageAt: new Date(now.getTime() - 90 * 60 * 1000),
    messages: [
      {
        id: 'msg-6',
        senderType: 'GUEST',
        body: 'I will be paying via my company card.',
        createdAt: new Date(now.getTime() - 95 * 60 * 1000),
        guestId: 'guest-3',
      },
      {
        id: 'msg-7',
        senderType: 'SYSTEM',
        body: 'Payment method noted as corporate card.',
        createdAt: new Date(now.getTime() - 90 * 60 * 1000),
      },
    ],
  },
];

function getGuestSummary(guestId: string | undefined) {
  if (!guestId) return undefined;
  const guest = mockGuests.find((g) => g.id === guestId);
  if (!guest) return undefined;
  return { firstName: guest.firstName, lastName: guest.lastName, email: guest.email };
}

function getStaffSummary(userId: string | undefined) {
  if (!userId) return undefined;
  const user = mockUsers.find((u) => u.id === userId);
  if (!user) return undefined;
  return { firstName: user.firstName, lastName: user.lastName, role: user.role };
}

function normalizeMessage(message: (typeof mockConversations)[0]['messages'][0]) {
  return {
    id: message.id,
    body: message.body,
    senderType: message.senderType as 'GUEST' | 'STAFF' | 'SYSTEM',
    createdAt: message.createdAt.toISOString(),
    guest: getGuestSummary(message.guestId),
    senderUser: getStaffSummary(message.senderUserId),
  };
}

function getBookingSummary(bookingId: string | undefined) {
  if (!bookingId) return undefined;
  const booking = mockBookings.find((b) => b.id === bookingId);
  if (!booking) return undefined;
  return {
    bookingRef: booking.bookingRef,
    checkInDate: booking.checkInDate.toISOString(),
    checkOutDate: booking.checkOutDate.toISOString(),
  };
}

export function getConversationSummary(conversation: typeof mockConversations[0]) {
  const guest = getGuestSummary(conversation.guestId);
  const booking = getBookingSummary(conversation.bookingId);
  const sortedMessages = conversation.messages
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((message) => normalizeMessage(message));
  return {
    id: conversation.id,
    subject: conversation.subject,
    status: conversation.status as 'OPEN' | 'RESOLVED' | 'ARCHIVED',
    guest,
    booking,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    lastMessage: sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1] : null,
  };
}

export function getConversationDetail(conversationId: string) {
  const conversation = mockConversations.find((c) => c.id === conversationId);
  if (!conversation) return null;
  const summary = getConversationSummary(conversation);
  const messages = conversation.messages
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((message) => normalizeMessage(message));
  return { ...summary, messages };
}

// Helper to get user with hotel
export function getUserWithHotel(user: typeof mockUsers[0]) {
  return { ...user, hotel: mockHotel };
}
