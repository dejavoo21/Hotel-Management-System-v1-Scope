import type { Room } from '@/types';

const ROOM_IMAGES_KEY = 'laflo-room-images';
const ROOM_TYPE_IMAGES_KEY = 'laflo-room-type-images';
const GUEST_IMAGES_KEY = 'laflo-guest-images';

const defaultRoomImageByType: Record<string, string> = {
  single: '/assets/rooms/single-room.jpg',
  standard: '/assets/rooms/single-room.jpg',
  deluxe: '/assets/rooms/deluxe-room.jpg',
  suite: '/assets/rooms/suite-room.jpg',
  family: '/assets/rooms/double-room.jpg',
  double: '/assets/rooms/double-room.jpg',
  king: '/assets/rooms/king-room.jpg',
  queen: '/assets/rooms/queen-room.jpg',
  twin: '/assets/rooms/twin-room.jpg',
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

function normalizeRoomType(roomTypeName: string): string {
  return roomTypeName.toLowerCase().trim();
}

function inferDefaultRoomImage(roomTypeName?: string): string {
  const type = normalizeRoomType(roomTypeName || '');
  if (type.includes('single')) return defaultRoomImageByType.single;
  if (type.includes('deluxe')) return defaultRoomImageByType.deluxe;
  if (type.includes('suite')) return defaultRoomImageByType.suite;
  if (type.includes('family')) return defaultRoomImageByType.family;
  if (type.includes('double')) return defaultRoomImageByType.double;
  if (type.includes('king')) return defaultRoomImageByType.king;
  if (type.includes('queen')) return defaultRoomImageByType.queen;
  if (type.includes('twin')) return defaultRoomImageByType.twin;
  return defaultRoomImageByType.standard;
}

export function getRoomTypeImage(roomTypeName?: string): string {
  const typeName = normalizeRoomType(roomTypeName || '');
  if (!typeName) return inferDefaultRoomImage('standard');
  const typeMap = readMap(ROOM_TYPE_IMAGES_KEY);
  return typeMap[typeName] || inferDefaultRoomImage(typeName);
}

export function setRoomTypeImage(roomTypeName: string, imageDataUrl: string) {
  const key = normalizeRoomType(roomTypeName);
  if (!key) return;
  const map = readMap(ROOM_TYPE_IMAGES_KEY);
  map[key] = imageDataUrl;
  writeMap(ROOM_TYPE_IMAGES_KEY, map);
}

export function getRoomImage(room: Pick<Room, 'id' | 'number' | 'roomType'>): string {
  const roomMap = readMap(ROOM_IMAGES_KEY);
  if (roomMap[room.id]) return roomMap[room.id];
  return getRoomTypeImage(room.roomType?.name);
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
