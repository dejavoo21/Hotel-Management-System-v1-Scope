-- Add presence fields to User model
-- PresenceStatus enum: AVAILABLE, BUSY, DND, AWAY

-- Create enum type
CREATE TYPE "PresenceStatus" AS ENUM ('AVAILABLE', 'BUSY', 'DND', 'AWAY');

-- Add columns to User table
ALTER TABLE "User" ADD COLUMN "presenceStatus" "PresenceStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
