import type { Room } from '@/types';

const ROOM_IMAGES_KEY = 'laflo-room-images';
const GUEST_IMAGES_KEY = 'laflo-guest-images';

const defaultRoomImageByType: Record<string, string> = {
  standard: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
  deluxe: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
  suite: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
  family: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
};

function readMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, string>) {
  localStorage.setItem(key, JSON.stringify(map));
}

export function getRoomImage(room: Pick<Room, 'id' | 'number' | 'roomType'>): string {
  const map = readMap(ROOM_IMAGES_KEY);
  if (map[room.id]) return map[room.id];
  const roomTypeName = room.roomType?.name?.toLowerCase() || '';
  if (roomTypeName.includes('deluxe')) return defaultRoomImageByType.deluxe;
  if (roomTypeName.includes('suite')) return defaultRoomImageByType.suite;
  if (roomTypeName.includes('family')) return defaultRoomImageByType.family;
  return defaultRoomImageByType.standard;
}

export function setRoomImage(roomId: string, imageDataUrl: string) {
  const map = readMap(ROOM_IMAGES_KEY);
  map[roomId] = imageDataUrl;
  writeMap(ROOM_IMAGES_KEY, map);
}

export function getGuestImage(guestId?: string): string | null {
  if (!guestId) return null;
  const map = readMap(GUEST_IMAGES_KEY);
  return map[guestId] || null;
}

export function setGuestImage(guestId: string, imageDataUrl: string) {
  const map = readMap(GUEST_IMAGES_KEY);
  map[guestId] = imageDataUrl;
  writeMap(GUEST_IMAGES_KEY, map);
}
