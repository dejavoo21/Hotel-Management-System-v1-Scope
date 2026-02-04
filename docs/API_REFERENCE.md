# HotelOS API Reference

Base URL: `http://localhost:3001/api`

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Response Format

All responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "pagination": { ... }  // For paginated responses
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

---

## Auth Endpoints

### POST /auth/login

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": "15m"
  }
}
```

Or if 2FA is enabled:
```json
{
  "success": true,
  "data": {
    "requiresTwoFactor": true
  }
}
```

### POST /auth/verify-2fa

Verify 2FA code after login.

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

### POST /auth/refresh

Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

### POST /auth/logout

Logout and invalidate refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

### GET /auth/me

Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "RECEPTIONIST",
    "hotel": { ... }
  }
}
```

### POST /auth/2fa/setup

Setup 2FA for current user.

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "base32_secret",
    "qrCode": "data:image/png;base64,..."
  }
}
```

### POST /auth/2fa/enable

Enable 2FA with verification code.

**Request Body:**
```json
{
  "code": "123456"
}
```

### POST /auth/2fa/disable

Disable 2FA.

**Request Body:**
```json
{
  "password": "current_password"
}
```

---

## Dashboard Endpoints

### GET /dashboard/summary

Get dashboard summary statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "todayArrivals": 5,
    "todayDepartures": 3,
    "currentOccupancy": 75,
    "totalRooms": 50,
    "occupiedRooms": 38,
    "availableRooms": 10,
    "outOfServiceRooms": 2,
    "inHouseGuests": 45,
    "todayRevenue": 5250.00,
    "monthRevenue": 125000.00
  }
}
```

### GET /dashboard/arrivals

Get today's arrivals.

### GET /dashboard/departures

Get today's departures.

### GET /dashboard/housekeeping-summary

Get housekeeping status summary.

---

## Room Endpoints

### GET /rooms

List all rooms with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | AVAILABLE, OCCUPIED, OUT_OF_SERVICE |
| housekeepingStatus | string | CLEAN, DIRTY, INSPECTION, OUT_OF_SERVICE |
| roomTypeId | string | Filter by room type |
| floor | number | Filter by floor |
| search | string | Search by room number |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "room_id",
      "number": "101",
      "floor": 1,
      "status": "AVAILABLE",
      "housekeepingStatus": "CLEAN",
      "roomType": {
        "id": "type_id",
        "name": "Standard",
        "baseRate": 99.00
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### GET /rooms/:id

Get room by ID.

### POST /rooms

Create a new room.

**Request Body:**
```json
{
  "number": "501",
  "floor": 5,
  "roomTypeId": "type_id",
  "notes": "Corner room with view"
}
```

### PATCH /rooms/:id

Update room details.

### PATCH /rooms/:id/status

Update room status.

**Request Body:**
```json
{
  "status": "OUT_OF_SERVICE"
}
```

### PATCH /rooms/:id/housekeeping

Update housekeeping status.

**Request Body:**
```json
{
  "housekeepingStatus": "CLEAN",
  "notes": "Deep cleaned"
}
```

### DELETE /rooms/:id

Delete a room.

---

## Room Type Endpoints

### GET /room-types

List all room types.

### POST /room-types

Create a new room type.

**Request Body:**
```json
{
  "name": "Deluxe Suite",
  "description": "Luxury suite with sea view",
  "baseRate": 299.00,
  "maxGuests": 4,
  "amenities": ["WiFi", "TV", "Mini Bar", "Jacuzzi"]
}
```

### PATCH /room-types/:id

Update room type.

### DELETE /room-types/:id

Delete room type.

---

## Booking Endpoints

### GET /bookings

List all bookings with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW |
| source | string | DIRECT, BOOKING_COM, EXPEDIA, etc. |
| startDate | date | Filter by check-in date start |
| endDate | date | Filter by check-in date end |
| guestId | string | Filter by guest |
| roomId | string | Filter by room |
| search | string | Search by booking ref or guest name |
| page | number | Page number |
| limit | number | Items per page |

### GET /bookings/:id

Get booking details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "booking_id",
    "bookingRef": "BK001",
    "guest": { ... },
    "room": { ... },
    "checkInDate": "2024-01-15",
    "checkOutDate": "2024-01-18",
    "actualCheckIn": "2024-01-15T14:30:00Z",
    "numberOfAdults": 2,
    "numberOfChildren": 0,
    "status": "CHECKED_IN",
    "source": "DIRECT",
    "roomRate": 99.00,
    "totalAmount": 297.00,
    "paidAmount": 200.00,
    "charges": [ ... ],
    "payments": [ ... ]
  }
}
```

### POST /bookings

Create a new booking.

**Request Body:**
```json
{
  "guestId": "guest_id",
  "roomId": "room_id",
  "checkInDate": "2024-01-20",
  "checkOutDate": "2024-01-23",
  "numberOfAdults": 2,
  "numberOfChildren": 0,
  "source": "DIRECT",
  "roomRate": 99.00,
  "specialRequests": "Late check-in"
}
```

### PATCH /bookings/:id

Update booking details.

### DELETE /bookings/:id

Cancel/delete booking.

### POST /bookings/:id/check-in

Check in a guest.

**Request Body:**
```json
{
  "roomId": "room_id",
  "idVerified": true,
  "notes": "Guest requested extra pillows"
}
```

### POST /bookings/:id/check-out

Check out a guest.

**Request Body:**
```json
{
  "processPayment": true,
  "paymentMethod": "CARD",
  "paymentAmount": 97.00
}
```

### POST /bookings/:id/cancel

Cancel a booking.

**Request Body:**
```json
{
  "reason": "Guest requested cancellation"
}
```

### GET /bookings/availability

Check room availability.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| checkInDate | date | Required |
| checkOutDate | date | Required |
| roomTypeId | string | Optional filter |

---

## Booking Charges Endpoints

### GET /bookings/:id/charges

List charges for a booking.

### POST /bookings/:id/charges

Add a charge to a booking.

**Request Body:**
```json
{
  "description": "Mini Bar",
  "category": "MINIBAR",
  "amount": 15.00,
  "quantity": 2
}
```

### DELETE /bookings/:id/charges/:chargeId

Void a charge.

---

## Booking Payments Endpoints

### GET /bookings/:id/payments

List payments for a booking.

### POST /bookings/:id/payments

Record a payment.

**Request Body:**
```json
{
  "amount": 100.00,
  "method": "CARD",
  "reference": "VISA **** 4242"
}
```

---

## Guest Endpoints

### GET /guests

List all guests.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| search | string | Search by name, email, phone |
| vipStatus | boolean | Filter VIP guests |
| page | number | Page number |
| limit | number | Items per page |

### GET /guests/:id

Get guest details.

### POST /guests

Create a new guest.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@example.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "city": "New York",
  "country": "USA",
  "idType": "Passport",
  "idNumber": "AB123456",
  "nationality": "American"
}
```

### PATCH /guests/:id

Update guest details.

### DELETE /guests/:id

Delete a guest.

### GET /guests/:id/bookings

Get guest's booking history.

---

## Housekeeping Endpoints

### GET /housekeeping/rooms

Get housekeeping board.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | CLEAN, DIRTY, INSPECTION, OUT_OF_SERVICE |
| floor | number | Filter by floor |
| priority | boolean | Show priority rooms only |

### PATCH /housekeeping/rooms/:id

Update room housekeeping status.

**Request Body:**
```json
{
  "housekeepingStatus": "CLEAN",
  "notes": "Deep cleaned, extra towels added"
}
```

### GET /housekeeping/history

Get housekeeping activity history.

---

## User Endpoints (Admin only)

### GET /users

List all users.

### POST /users

Create a new user.

**Request Body:**
```json
{
  "email": "newuser@hotel.com",
  "password": "SecurePass123",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "RECEPTIONIST"
}
```

### PATCH /users/:id

Update user details.

### DELETE /users/:id

Deactivate a user.

---

## Reports Endpoints

### GET /reports/revenue

Get revenue report.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | 7d, 30d, 90d, 365d |

### GET /reports/occupancy

Get occupancy report.

### GET /reports/bookings

Get bookings report.

---

## Invoice Endpoints

### POST /bookings/:id/invoice

Generate invoice for a booking.

### GET /invoices/:id

Get invoice details.

### GET /invoices/:id/pdf

Download invoice as PDF.

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 500 | Internal Server Error |

---

## Rate Limiting

API requests are limited to:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated endpoints

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```
