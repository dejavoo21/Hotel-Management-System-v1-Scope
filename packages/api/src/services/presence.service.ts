import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

// PresenceStatus enum values (mirrors Prisma enum after migration)
// Will be imported from @prisma/client once migration is applied
export type PresenceStatus = 'AVAILABLE' | 'BUSY' | 'DND' | 'AWAY';
const DEFAULT_PRESENCE_STATUS: PresenceStatus = 'AVAILABLE';

/**
 * In-memory presence store
 * Tracks online users by hotel for fast lookups
 */
interface PresenceEntry {
  userId: string;
  email: string;
  hotelId: string;
  socketId: string;
  isOnline: boolean;
  overrideStatus: PresenceStatus;
  connectedAt: Date;
}

// Map: userId -> PresenceEntry
const presenceStore = new Map<string, PresenceEntry>();

// Map: hotelId -> Set<userId> for fast hotel lookups
const hotelUsersMap = new Map<string, Set<string>>();

/**
 * Presence payload sent to clients
 */
export interface PresenceUpdate {
  userId: string;
  email: string;
  isOnline: boolean;
  effectiveStatus: string;    // 'OFFLINE' if offline, else overrideStatus
  overrideStatus: PresenceStatus;
  lastSeenAt: Date | null;
}

/**
 * Get effective status based on online state and override
 * If offline => OFFLINE regardless of override
 * If online => show override status
 */
function getEffectiveStatus(isOnline: boolean, overrideStatus: PresenceStatus): string {
  if (!isOnline) return 'OFFLINE';
  return overrideStatus;
}

/**
 * Mark user as online when socket connects
 */
export async function markUserOnline(
  userId: string,
  email: string,
  hotelId: string,
  socketId: string
): Promise<PresenceUpdate> {
  // Get current override status from DB (defaults to AVAILABLE)
  // Note: presenceStatus field added in migration 20260225_add_presence_fields
  let overrideStatus: PresenceStatus = DEFAULT_PRESENCE_STATUS;
  let lastSeenAt: Date | null = null;
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      // Note: presenceStatus and lastSeenAt fields added in migration 20260225_add_presence_fields
      // @ts-ignore - fields may not exist until migration is applied
      select: { id: true, presenceStatus: true, lastSeenAt: true },
    });
    if (user) {
      overrideStatus = (user.presenceStatus as PresenceStatus) ?? DEFAULT_PRESENCE_STATUS;
      lastSeenAt = user.lastSeenAt ?? null;
    }
  } catch {
    // Fields may not exist yet if migration hasn't run
    logger.debug('Presence fields not yet available in DB');
  }

  // Store in memory
  presenceStore.set(userId, {
    userId,
    email,
    hotelId,
    socketId,
    isOnline: true,
    overrideStatus,
    connectedAt: new Date(),
  });

  // Track in hotel map
  if (!hotelUsersMap.has(hotelId)) {
    hotelUsersMap.set(hotelId, new Set());
  }
  hotelUsersMap.get(hotelId)!.add(userId);

  logger.info(`Presence: User ${email} marked ONLINE in hotel ${hotelId}`);

  return {
    userId,
    email,
    isOnline: true,
    effectiveStatus: getEffectiveStatus(true, overrideStatus),
    overrideStatus,
    lastSeenAt,
  };
}

/**
 * Mark user as offline when socket disconnects
 * Updates lastSeenAt in DB
 */
export async function markUserOffline(userId: string): Promise<PresenceUpdate | null> {
  const entry = presenceStore.get(userId);
  if (!entry) return null;

  const now = new Date();

  // Update DB with lastSeenAt
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: now },
    });
  } catch (err) {
    logger.error(`Failed to update lastSeenAt for user ${userId}:`, err);
  }

  // Remove from memory store
  presenceStore.delete(userId);

  // Remove from hotel map
  const hotelUsers = hotelUsersMap.get(entry.hotelId);
  if (hotelUsers) {
    hotelUsers.delete(userId);
    if (hotelUsers.size === 0) {
      hotelUsersMap.delete(entry.hotelId);
    }
  }

  logger.info(`Presence: User ${entry.email} marked OFFLINE, lastSeenAt=${now.toISOString()}`);

  return {
    userId,
    email: entry.email,
    isOnline: false,
    effectiveStatus: 'OFFLINE',
    overrideStatus: entry.overrideStatus,
    lastSeenAt: now,
  };
}

/**
 * Set presence override (AVAILABLE, BUSY, DND, AWAY)
 * Persists to DB and updates memory store
 */
export async function setPresenceOverride(
  userId: string,
  status: PresenceStatus
): Promise<PresenceUpdate | null> {
  const entry = presenceStore.get(userId);
  if (!entry) {
    // User is offline, just update DB
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { presenceStatus: status },
        select: { email: true, lastSeenAt: true },
      });
      logger.info(`Presence: Offline user ${user.email} override set to ${status}`);
      return {
        userId,
        email: user.email,
        isOnline: false,
        effectiveStatus: 'OFFLINE',
        overrideStatus: status,
        lastSeenAt: user.lastSeenAt,
      };
    } catch {
      return null;
    }
  }

  // Update DB
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { presenceStatus: status },
    });
  } catch (err) {
    logger.error(`Failed to update presenceStatus for user ${userId}:`, err);
  }

  // Update memory
  entry.overrideStatus = status;
  presenceStore.set(userId, entry);

  logger.info(`Presence: User ${entry.email} override set to ${status}`);

  return {
    userId,
    email: entry.email,
    isOnline: true,
    effectiveStatus: getEffectiveStatus(true, status),
    overrideStatus: status,
    lastSeenAt: null,
  };
}

/**
 * Get current presence for a user
 */
export async function getUserPresence(userId: string): Promise<PresenceUpdate | null> {
  const entry = presenceStore.get(userId);
  if (entry) {
    return {
      userId,
      email: entry.email,
      isOnline: true,
      effectiveStatus: getEffectiveStatus(true, entry.overrideStatus),
      overrideStatus: entry.overrideStatus,
      lastSeenAt: null,
    };
  }

  // User is offline, get from DB
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      // @ts-ignore - fields may not exist until migration is applied
      select: { email: true, presenceStatus: true, lastSeenAt: true },
    });

    if (!user) return null;

    const presenceStatus = (user.presenceStatus as PresenceStatus) ?? DEFAULT_PRESENCE_STATUS;
    return {
      userId,
      email: user.email,
      isOnline: false,
      effectiveStatus: 'OFFLINE',
      overrideStatus: presenceStatus,
      lastSeenAt: user.lastSeenAt,
    };
  } catch {
    return null;
  }
}

/**
 * Get all online users in a hotel
 */
export function getHotelOnlineUsers(hotelId: string): PresenceUpdate[] {
  const userIds = hotelUsersMap.get(hotelId);
  if (!userIds) return [];

  const results: PresenceUpdate[] = [];
  for (const userId of userIds) {
    const entry = presenceStore.get(userId);
    if (entry && entry.isOnline) {
      results.push({
        userId: entry.userId,
        email: entry.email,
        isOnline: true,
        effectiveStatus: getEffectiveStatus(true, entry.overrideStatus),
        overrideStatus: entry.overrideStatus,
        lastSeenAt: null,
      });
    }
  }
  return results;
}

/**
 * Check if user is currently online
 */
export function isUserOnline(userId: string): boolean {
  const entry = presenceStore.get(userId);
  return entry?.isOnline ?? false;
}

/**
 * Get hotel ID for a user from presence store
 */
export function getUserHotelId(userId: string): string | null {
  return presenceStore.get(userId)?.hotelId ?? null;
}

/**
 * Get full hotel presence list (online + offline users)
 * This makes the UI Teams-like: you can always see everyone.
 */
export async function getHotelPresenceSnapshot(hotelId: string): Promise<PresenceUpdate[]> {
  // Pull all staff users for this hotel from DB
  const users = await prisma.user.findMany({
    where: { hotelId, isActive: true },
    select: {
      id: true,
      email: true,
      // @ts-ignore - fields may not exist until migration is applied
      presenceStatus: true,
      // @ts-ignore
      lastSeenAt: true,
    },
    orderBy: [{ lastSeenAt: 'desc' }, { email: 'asc' }],
  });

  return users.map((u) => {
    const onlineEntry = presenceStore.get(u.id);
    const overrideStatus = (u.presenceStatus as PresenceStatus) ?? DEFAULT_PRESENCE_STATUS;
    const isOnline = Boolean(onlineEntry?.isOnline);

    return {
      userId: u.id,
      email: u.email,
      isOnline,
      effectiveStatus: getEffectiveStatus(isOnline, onlineEntry?.overrideStatus ?? overrideStatus),
      overrideStatus: onlineEntry?.overrideStatus ?? overrideStatus,
      lastSeenAt: u.lastSeenAt ?? null,
    };
  });
}
