import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { User } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import {
  getPermissionOptions,
  getUserPermissions,
  getUserTitles,
  isSuperAdminUser,
  setSuperAdmin,
  setUserPermissions,
  setUserTitle,
  type PermissionId,
  type UserRole,
} from '@/utils/userAccess';
import { appendAuditLog } from '@/utils/auditLog';
import toast from 'react-hot-toast';

interface CreateUserData {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: User['role'];
  sendInvite?: boolean;
  title?: string;
}

type UserSecurityPrefs = {
  passphraseEnabled: boolean;
  biometricsEnabled: boolean;
};

const userAvatarKey = (userId: string) => `laflo-user-avatar:${userId}`;
const userSecurityStorageKey = 'laflo-user-security-prefs';

function getStoredUserAvatar(userId?: string | null) {
  if (!userId) return null;
  try {
    return window.localStorage.getItem(userAvatarKey(userId));
  } catch {
    return null;
  }
}

function loadSecurityPrefsMap() {
  try {
    const raw = window.localStorage.getItem(userSecurityStorageKey);
    if (!raw) return {} as Record<string, UserSecurityPrefs>;
    const parsed = JSON.parse(raw) as Record<string, UserSecurityPrefs>;
    return parsed ?? {};
  } catch {
    return {} as Record<string, UserSecurityPrefs>;
  }
}

function saveSecurityPrefsMap(map: Record<string, UserSecurityPrefs>) {
  try {
    window.localStorage.setItem(userSecurityStorageKey, JSON.stringify(map));
  } catch {
    // no-op
  }
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editPermissions, setEditPermissions] = useState<PermissionId[]>([]);
  const [editSuperAdmin, setEditSuperAdmin] = useState(false);
  const [userTitles, setUserTitles] = useState<Record<string, string>>({});
  const [editTwoFactor, setEditTwoFactor] = useState(false);
  const [editPassphraseEnabled, setEditPassphraseEnabled] = useState(false);
  const [editBiometricsEnabled, setEditBiometricsEnabled] = useState(false);
  const [editUserAvatar, setEditUserAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const permissionOptions = getPermissionOptions();
  const currentUserIsSuperAdmin = isSuperAdminUser(currentUser?.id, currentUser?.role as UserRole | undefined);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data.data as User[];
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await api.post('/users', {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        sendInvite: data.sendInvite,
      });
      return { user: response.data.data as User, title: data.title || '' };
    },
    onSuccess: ({ user, title }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (title) {
        setUserTitle(user.id, title);
        setUserTitles((prev) => ({ ...prev, [user.id]: title }));
      }
      setUserPermissions(user.id, getUserPermissions(user.id, user.role));
      toast.success('User created successfully');
      setShowAddModal(false);
    },
    onError: () => {
      toast.error('Failed to create user');
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await api.patch(`/users/${id}`, { isActive });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User status updated');
    },
    onError: () => {
      toast.error('Failed to update user status');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; payload: Partial<User> }) => {
      const response = await api.patch(`/users/${data.id}`, data.payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
      setSelectedUser(null);
    },
    onError: () => {
      toast.error('Failed to update user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      await api.delete(`/users/${id}`, { data: reason ? { reason } : undefined });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      appendAuditLog({
        action: 'USER_DELETED',
        actorId: currentUser?.id,
        actorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
        targetId: variables.id,
        details: { reason: variables.reason },
      });
      toast.success('User deleted');
    },
    onError: () => {
      toast.error('Failed to delete user');
    },
  });

  const getRoleBadge = (role: User['role']) => {
    const colors: Record<User['role'], string> = {
      ADMIN: 'bg-purple-100 text-purple-700',
      MANAGER: 'bg-blue-100 text-blue-700',
      RECEPTIONIST: 'bg-emerald-100 text-emerald-700',
      HOUSEKEEPING: 'bg-amber-100 text-amber-700',
    };
    return `status-pill ${colors[role]}`;
  };

  const getRoleIcon = (role: User['role'], isSuperAdmin: boolean) => {
    if (isSuperAdmin) {
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
          SA
        </span>
      );
    }
    const iconMap: Record<User['role'], string> = {
      ADMIN: 'AD',
      MANAGER: 'MG',
      RECEPTIONIST: 'RC',
      HOUSEKEEPING: 'HK',
    };
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">
        {iconMap[role]}
      </span>
    );
  };

  useEffect(() => {
    setUserTitles(getUserTitles());
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    setEditPermissions(getUserPermissions(selectedUser.id, selectedUser.role));
    setEditTitle(getUserTitles()[selectedUser.id] || '');
    setEditSuperAdmin(isSuperAdminUser(selectedUser.id, selectedUser.role as UserRole | undefined));
    setEditTwoFactor(Boolean(selectedUser.twoFactorEnabled));
    setEditUserAvatar(getStoredUserAvatar(selectedUser.id));
    const prefsMap = loadSecurityPrefsMap();
    const prefs = prefsMap[selectedUser.id];
    setEditPassphraseEnabled(Boolean(prefs?.passphraseEnabled));
    setEditBiometricsEnabled(Boolean(prefs?.biometricsEnabled));
  }, [selectedUser]);

  const onEditAvatarPicked = (file?: File) => {
    if (!file || !selectedUser) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : null;
      if (!value) return;
      try {
        window.localStorage.setItem(userAvatarKey(selectedUser.id), value);
        setEditUserAvatar(value);
        toast.success('Profile photo updated');
      } catch {
        toast.error('Failed to save profile photo');
      }
    };
    reader.readAsDataURL(file);
  };

  const removeEditAvatar = () => {
    if (!selectedUser) return;
    try {
      window.localStorage.removeItem(userAvatarKey(selectedUser.id));
      setEditUserAvatar(null);
      toast.success('Profile photo removed');
    } catch {
      toast.error('Failed to remove profile photo');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">Manage staff accounts and permissions</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Users table */}
      <div className="table-container">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : users && users.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>2FA</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {getRoleIcon(user.role, isSuperAdminUser(user.id, user.role as UserRole | undefined))}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                        {getStoredUserAvatar(user.id) ? (
                          <img
                            src={getStoredUserAvatar(user.id) || undefined}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <>
                            {user.firstName[0]}
                            {user.lastName[0]}
                          </>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {user.firstName} {user.lastName}
                        </p>
                        {userTitles[user.id] && (
                          <p className="text-xs text-slate-500">{userTitles[user.id]}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={getRoleBadge(user.role)}>{user.role}</span>
                  </td>
                  <td>
                    {user.twoFactorEnabled ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        Enabled
                      </span>
                    ) : (
                      <span className="text-slate-400">Disabled</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'Never'}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          toggleUserStatusMutation.mutate({
                            id: user.id,
                            isActive: !user.isActive,
                          })
                        }
                        className={
                          user.isActive
                            ? 'text-red-600 hover:text-red-700'
                            : 'text-emerald-600 hover:text-emerald-700'
                        }
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      {!user.isActive && (user.role !== 'ADMIN' || currentUserIsSuperAdmin) && (
                        <button
                          onClick={() => {
                            setDeleteReason('');
                            setDeleteTarget(user);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="mt-2 text-sm text-slate-500">No users found</p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 pointer-events-none" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Add New User</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createUserMutation.mutate({
                  email: formData.get('email') as string,
                  password: (formData.get('password') as string) || undefined,
                  firstName: formData.get('firstName') as string,
                  lastName: formData.get('lastName') as string,
                  role: formData.get('role') as User['role'],
                  sendInvite: formData.get('sendInvite') === 'on',
                  title: (formData.get('title') as string) || undefined,
                });
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">First Name *</label>
                  <input name="firstName" required className="input" />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input name="lastName" required className="input" />
                </div>
              </div>

              <div>
                <label className="label">Email *</label>
                <input name="email" type="email" required className="input" />
              </div>

              <div>
                <label className="label">Position Title</label>
                <input name="title" className="input" placeholder="e.g. Front Desk Lead" />
              </div>
              <div>
                <label className="label">Password *</label>
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  className="input"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Leave blank to send an invite email.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="sendInvite" className="h-4 w-4 rounded border-slate-300" />
                Email setup link to user
              </label>

              <div>
                <label className="label">Role *</label>
                <select name="role" required className="input">
                  <option value="">Select role...</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="HOUSEKEEPING">Housekeeping</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setSelectedUser(null)}
          />
          <div className="relative z-50 mt-2 w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              type="button"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h2 className="text-xl font-bold text-slate-900">Edit User</h2>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                updateUserMutation.mutate({
                  id: selectedUser.id,
                  payload: {
                    firstName: formData.get('firstName') as string,
                    lastName: formData.get('lastName') as string,
                    email: formData.get('email') as string,
                    role: formData.get('role') as User['role'],
                    twoFactorEnabled: editTwoFactor,
                  },
                });
                setUserTitle(selectedUser.id, editTitle);
                setUserTitles((prev) => ({ ...prev, [selectedUser.id]: editTitle }));
                setUserPermissions(selectedUser.id, editPermissions);
                setSuperAdmin(selectedUser.id, editSuperAdmin);
                const prefsMap = loadSecurityPrefsMap();
                prefsMap[selectedUser.id] = {
                  passphraseEnabled: editPassphraseEnabled,
                  biometricsEnabled: editBiometricsEnabled,
                };
                saveSecurityPrefsMap(prefsMap);
                appendAuditLog({
                  action: 'USER_ACCESS_UPDATED',
                  actorId: currentUser?.id,
                  actorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                  targetId: selectedUser.id,
                  targetLabel: `${selectedUser.firstName} ${selectedUser.lastName}`,
                  details: {
                    title: editTitle || null,
                    permissions: editPermissions,
                    superAdmin: editSuperAdmin,
                    security: {
                      twoFactorEnabled: editTwoFactor,
                      passphraseEnabled: editPassphraseEnabled,
                      biometricsEnabled: editBiometricsEnabled,
                    },
                  },
                });
              }}
              className="mt-6 space-y-4"
            >
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
                    {editUserAvatar ? (
                      <img
                        src={editUserAvatar}
                        alt={`${selectedUser.firstName} ${selectedUser.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        {selectedUser.firstName[0]}
                        {selectedUser.lastName[0]}
                      </>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Profile Photo</p>
                    <p className="text-xs text-slate-500">Upload a profile image for this user account.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        onEditAvatarPicked(event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                    <button type="button" className="btn-outline" onClick={() => avatarInputRef.current?.click()}>
                      Upload
                    </button>
                    <button type="button" className="btn-outline" onClick={removeEditAvatar}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Position Title</label>
                <input
                  name="title"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="input"
                  placeholder="e.g. Night Supervisor"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">First Name</label>
                  <input
                    name="firstName"
                    defaultValue={selectedUser.firstName}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input
                    name="lastName"
                    defaultValue={selectedUser.lastName}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={selectedUser.email}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Role</label>
                <select name="role" defaultValue={selectedUser.role} className="input">
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="HOUSEKEEPING">Housekeeping</option>
                </select>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">Security</p>
                <p className="text-xs text-slate-500">Configure account protection options.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editTwoFactor}
                      onChange={(event) => setEditTwoFactor(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600"
                    />
                    Enable 2FA
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editPassphraseEnabled}
                      onChange={(event) => setEditPassphraseEnabled(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600"
                    />
                    Passphrase
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editBiometricsEnabled}
                      onChange={(event) => setEditBiometricsEnabled(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600"
                    />
                    Biometrics
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Passphrase and biometrics are saved as local profile preferences until backend integration is enabled.
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Account Info</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    Created: {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                  <p>
                    Last Login:{' '}
                    {selectedUser.lastLoginAt
                      ? new Date(selectedUser.lastLoginAt).toLocaleString()
                      : 'Never'}
                  </p>
                  <p>2FA: {editTwoFactor ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Super Admin</p>
                    <p className="text-xs text-slate-500">
                      Super admins can manage other admins and roles.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editSuperAdmin}
                    onChange={(event) => setEditSuperAdmin(event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-primary-600"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-900">Access Profile</p>
                <p className="text-xs text-slate-500">
                  Choose which sections this user can access.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {permissionOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={editPermissions.includes(option.id)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setEditPermissions((prev) =>
                            checked
                              ? Array.from(new Set([...prev, option.id]))
                              : prev.filter((item) => item !== option.id)
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-primary-600"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={updateUserMutation.isPending} className="btn-primary flex-1">
                  {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 pointer-events-none"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Delete user</h2>
            <p className="mt-2 text-sm text-slate-500">
              Add a reason for deleting {deleteTarget.firstName} {deleteTarget.lastName}. This will be stored in the audit log.
            </p>

            <textarea
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              rows={4}
              className="input mt-4"
              placeholder="Reason for deletion..."
            />

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => {
                  const reason = deleteReason.trim();
                  if (!reason) {
                    toast.error('Reason is required');
                    return;
                  }
                  deleteUserMutation.mutate({ id: deleteTarget.id, reason });
                  setDeleteTarget(null);
                }}
              >
                Delete user
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


