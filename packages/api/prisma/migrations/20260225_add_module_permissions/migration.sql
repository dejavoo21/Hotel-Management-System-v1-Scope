-- Add modulePermissions field to User table
-- Stores array of allowed module names for access profile enforcement

ALTER TABLE "User" ADD COLUMN "modulePermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Initialize default permissions based on role
-- ADMIN gets all permissions
UPDATE "User" SET "modulePermissions" = ARRAY['dashboard', 'bookings', 'rooms', 'messages', 'housekeeping', 'inventory', 'calendar', 'guests', 'financials', 'reviews', 'concierge', 'users', 'settings']
WHERE "role" = 'ADMIN';

-- MANAGER gets most permissions except users management
UPDATE "User" SET "modulePermissions" = ARRAY['dashboard', 'bookings', 'rooms', 'messages', 'housekeeping', 'inventory', 'calendar', 'guests', 'financials', 'reviews', 'concierge', 'settings']
WHERE "role" = 'MANAGER';

-- RECEPTIONIST gets core operational permissions
UPDATE "User" SET "modulePermissions" = ARRAY['dashboard', 'bookings', 'rooms', 'messages', 'calendar', 'guests', 'financials']
WHERE "role" = 'RECEPTIONIST';

-- HOUSEKEEPING gets limited permissions
UPDATE "User" SET "modulePermissions" = ARRAY['dashboard', 'rooms', 'housekeeping', 'calendar', 'messages']
WHERE "role" = 'HOUSEKEEPING';
