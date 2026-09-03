import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@/services';
import { useAuthStore } from '@/stores/authStore';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const SUPPORTED_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const avatarKeys = (userId: string) => [
  `laflo-profile-avatar:${userId}`,
  `laflo-user-avatar:${userId}`,
];

function readLegacyAvatar(userId: string) {
  try {
    for (const key of avatarKeys(userId)) {
      const value = window.localStorage.getItem(key);
      if (value) return value;
    }
  } catch {
    // Persistent API data remains the source of truth when local storage is unavailable.
  }
  return null;
}

function cacheAvatar(userId: string, avatarUrl: string | null) {
  try {
    for (const key of avatarKeys(userId)) {
      if (avatarUrl) window.localStorage.setItem(key, avatarUrl);
      else window.localStorage.removeItem(key);
    }
  } catch {
    // The database-backed avatar still works across accounts and devices.
  }
}

export function useProfileAvatar() {
  const { user, setUser } = useAuthStore();
  const [profileAvatar, setProfileAvatar] = useState<string | null>(user?.avatarUrl || null);
  const migratedUserIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user) {
      setProfileAvatar(null);
      return;
    }

    if (user.avatarUrl) {
      setProfileAvatar(user.avatarUrl);
      cacheAvatar(user.id, user.avatarUrl);
      return;
    }

    const legacyAvatar = readLegacyAvatar(user.id);
    setProfileAvatar(legacyAvatar);
    if (!legacyAvatar || migratedUserIds.current.has(user.id)) return;

    migratedUserIds.current.add(user.id);
    authService
      .updateAvatar(legacyAvatar)
      .then(() => setUser({ ...user, avatarUrl: legacyAvatar }))
      .catch(() => {
        migratedUserIds.current.delete(user.id);
      });
  }, [setUser, user]);

  const persistAvatar = async (avatarUrl: string | null) => {
    if (!user) return;
    await authService.updateAvatar(avatarUrl);
    cacheAvatar(user.id, avatarUrl);
    setProfileAvatar(avatarUrl);
    setUser({ ...user, avatarUrl });
  };

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!SUPPORTED_AVATAR_TYPES.has(file.type)) {
      toast.error('Use a PNG, JPEG, or WebP profile picture');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Profile picture must be 5 MB or smaller');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) return;
      try {
        await persistAvatar(result);
        toast.success('Profile picture updated for all staff');
      } catch {
        toast.error('Failed to save profile picture');
      }
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = async () => {
    try {
      await persistAvatar(null);
      toast.success('Profile picture removed');
    } catch {
      toast.error('Failed to remove profile picture');
    }
  };

  return { profileAvatar, onAvatarChange, removeAvatar };
}
