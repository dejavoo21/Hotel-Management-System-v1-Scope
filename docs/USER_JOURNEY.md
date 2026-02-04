# HotelOS User Journey Documentation

This document describes the typical user workflows for each role in the HotelOS system.

## Role Overview

| Role | Primary Responsibilities |
|------|-------------------------|
| **Admin** | System configuration, user management, full access |
| **Manager** | Operations oversight, reports, guest relations |
| **Receptionist** | Front desk operations, check-in/out, bookings |
| **Housekeeping** | Room cleaning, status updates |

---

## Receptionist User Journeys

### 1. Morning Start of Shift

```
Login
  │
  ├── View Dashboard
  │     ├── Check today's arrivals
  │     ├── Review departures
  │     └── Note any alerts/priority items
  │
  ├── Review Housekeeping Status
  │     └── Ensure rooms are ready for arrivals
  │
  └── Check pending bookings
        └── Prepare registration cards
```

### 2. Walk-in Guest Check-in

```
Guest arrives without reservation
  │
  ├── Create New Guest
  │     ├── Enter guest details
  │     ├── Capture ID information
  │     └── Save guest profile
  │
  ├── Check Availability
  │     ├── Select dates
  │     ├── View available rooms
  │     └── Select appropriate room type
  │
  ├── Create Booking
  │     ├── Select guest
  │     ├── Choose room
  │     ├── Set room rate
  │     └── Add special requests
  │
  └── Complete Check-in
        ├── Verify ID
        ├── Collect payment/deposit
        ├── Issue room key
        └── Provide hotel information
```

### 3. Reserved Guest Check-in

```
Guest arrives with reservation
  │
  ├── Search Booking
  │     ├── By booking reference
  │     ├── By guest name
  │     └── From today's arrivals list
  │
  ├── Verify Guest Identity
  │     ├── Check ID matches booking
  │     └── Update ID details if needed
  │
  ├── Review Booking
  │     ├── Confirm dates
  │     ├── Verify room type
  │     └── Note special requests
  │
  ├── Assign Room (if not pre-assigned)
  │     ├── View available clean rooms
  │     ├── Consider guest preferences
  │     └── Select best match
  │
  └── Complete Check-in
        ├── Process payment/deposit
        ├── Mark booking as checked-in
        └── Issue room key
```

### 4. Guest Check-out

```
Guest ready to check out
  │
  ├── Find Booking
  │     ├── Search by room number
  │     └── Or from departures list
  │
  ├── Review Folio
  │     ├── Room charges
  │     ├── Additional charges (minibar, etc.)
  │     ├── Payments received
  │     └── Calculate balance due
  │
  ├── Add Final Charges (if any)
  │     ├── Late check-out fee
  │     └── Any outstanding items
  │
  ├── Process Payment
  │     ├── Collect balance
  │     ├── Record payment method
  │     └── Issue receipt
  │
  └── Complete Check-out
        ├── Mark booking as checked-out
        ├── Room automatically marked dirty
        └── Thank guest
```

### 5. Creating a New Reservation

```
Receive booking request (phone/email)
  │
  ├── Check Availability
  │     ├── Enter dates
  │     ├── Select room type
  │     └── View available options
  │
  ├── Guest Lookup/Creation
  │     ├── Search existing guests
  │     └── Create new if needed
  │
  ├── Create Booking
  │     ├── Select guest
  │     ├── Enter dates
  │     ├── Choose room type
  │     ├── Set rate
  │     ├── Add special requests
  │     └── Select booking source
  │
  ├── Collect Deposit (optional)
  │     └── Record advance payment
  │
  └── Confirm Booking
        ├── Provide booking reference
        └── Send confirmation email
```

---

## Manager User Journeys

### 1. Daily Operations Review

```
Morning Review
  │
  ├── Dashboard Overview
  │     ├── Current occupancy
  │     ├── Today's revenue
  │     └── Key metrics
  │
  ├── Review Arrivals/Departures
  │     ├── VIP arrivals
  │     ├── Special requests
  │     └── Potential issues
  │
  ├── Housekeeping Status
  │     ├── Priority rooms
  │     ├── Dirty room count
  │     └── Inspection queue
  │
  └── Staff Review
        └── Check user activity
```

### 2. Monthly Reporting

```
Access Reports Section
  │
  ├── Revenue Report
  │     ├── Select date range
  │     ├── View daily breakdown
  │     ├── Compare with previous periods
  │     └── Export to CSV/PDF
  │
  ├── Occupancy Report
  │     ├── View occupancy trends
  │     ├── Identify peak periods
  │     └── Analyze room type performance
  │
  └── Booking Source Analysis
        ├── Direct vs OTA breakdown
        └── Channel performance
```

### 3. Guest Issue Resolution

```
Guest complaint received
  │
  ├── Find Guest/Booking
  │     ├── Search by name/room
  │     └── Review booking details
  │
  ├── Document Issue
  │     └── Add internal notes
  │
  ├── Apply Resolution
  │     ├── Void incorrect charges
  │     ├── Apply discount
  │     └── Upgrade room (if needed)
  │
  └── Follow Up
        ├── Record resolution
        └── Mark VIP if appropriate
```

---

## Housekeeping User Journeys

### 1. Morning Assignment Review

```
Login to System
  │
  └── View Housekeeping Board
        ├── Dirty rooms (departures)
        ├── Inspection rooms
        ├── Priority rooms (arrivals)
        └── My assigned floor/section
```

### 2. Room Cleaning Workflow

```
Start Cleaning Assignment
  │
  ├── Select Room
  │     └── From dirty list
  │
  ├── Clean Room
  │     └── Perform cleaning tasks
  │
  ├── Update Status
  │     ├── Mark as "Inspection"
  │     └── Add notes if needed
  │
  └── Move to Next Room
```

### 3. Room Inspection (Supervisor)

```
View Inspection Queue
  │
  ├── Select Room
  │     └── From inspection list
  │
  ├── Inspect Room
  │     └── Verify cleanliness
  │
  ├── Update Status
  │     ├── Pass: Mark as "Clean"
  │     └── Fail: Mark as "Dirty" with notes
  │
  └── Continue Inspections
```

### 4. Report Maintenance Issue

```
Discover Issue During Cleaning
  │
  ├── Update Room Status
  │     └── Mark as "Out of Service"
  │
  ├── Add Notes
  │     └── Describe maintenance issue
  │
  └── Notify Manager
        └── Issue visible in dashboard
```

---

## Admin User Journeys

### 1. Initial System Setup

```
First Login
  │
  ├── Configure Hotel Settings
  │     ├── Hotel name and details
  │     ├── Currency
  │     └── Timezone
  │
  ├── Create Room Types
  │     ├── Define categories
  │     ├── Set base rates
  │     └── List amenities
  │
  ├── Add Rooms
  │     ├── Assign numbers
  │     ├── Set floors
  │     └── Link to room types
  │
  └── Create User Accounts
        ├── Add staff members
        ├── Assign roles
        └── Send login credentials
```

### 2. User Management

```
Access User Management
  │
  ├── Create New User
  │     ├── Enter details
  │     ├── Assign role
  │     └── Set initial password
  │
  ├── Edit User
  │     ├── Update information
  │     ├── Change role
  │     └── Reset password
  │
  └── Deactivate User
        └── When staff leaves
```

### 3. Security Management

```
Access Security Settings
  │
  ├── Enable 2FA for Account
  │     ├── Generate QR code
  │     ├── Scan with authenticator
  │     └── Verify setup
  │
  ├── Review Activity Logs
  │     ├── Monitor user actions
  │     └── Investigate issues
  │
  └── Manage Sessions
        └── Force logout if needed
```

---

## Common Workflows

### Quick Room Status Update

```
Any Role
  │
  └── Rooms Page
        ├── Click room card
        ├── Select new status
        └── Confirm change
```

### Guest Search

```
Any Role
  │
  └── Guests Page
        ├── Enter search term
        │     ├── Name
        │     ├── Email
        │     └── Phone
        └── View results
```

### Booking Search

```
Any Role
  │
  └── Bookings Page
        ├── Enter search term
        │     ├── Booking reference
        │     ├── Guest name
        │     └── Room number
        ├── Apply filters
        │     ├── Status
        │     ├── Date range
        │     └── Source
        └── View results
```

---

## Mobile-Specific Workflows

### Housekeeping on Tablet/Phone

```
Quick Status Update
  │
  ├── Open Housekeeping page
  │     └── Swipe-friendly cards
  │
  ├── Tap room card
  │     └── View current status
  │
  └── Tap new status button
        └── Instant update
```

### Reception on Tablet

```
Guest Check-in at Counter
  │
  ├── Today's Arrivals visible
  │
  ├── Tap guest name
  │     └── Quick booking view
  │
  └── Swipe to check-in
        └── Confirm modal
```

---

## Keyboard Shortcuts (Desktop)

| Shortcut | Action |
|----------|--------|
| `/` | Open search |
| `n` | New booking |
| `g` | Go to guests |
| `r` | Go to rooms |
| `b` | Go to bookings |
| `h` | Go to housekeeping |
| `d` | Go to dashboard |
| `?` | Show help |
