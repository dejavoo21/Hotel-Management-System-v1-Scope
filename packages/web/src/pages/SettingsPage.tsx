import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { roomService, authService, hotelService, accessRequestService, weatherSignalsService } from '@/services';
import api from '@/services/api';
import { currencyOptions, timezoneOptions } from '@/data/options';
import type { AccessRequest, AccessRequestReply } from '@/types';
import {
  appendAuditLog,
  getAuditLogs,
  getAuditSettings,
  saveAuditSettings,
  type AuditLogEntry,
} from '@/utils/auditLog';
import toast from 'react-hot-toast';
import { formatEnumLabel } from '@/utils';
import { ackAccessRequest } from '@/utils/accessRequestAck';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import { useTheme } from '@/theme/ThemeProvider';

type SettingsTab =
  | 'hotel'
  | 'room-types'
  | 'security'
  | 'notifications'
  | 'appearance'
  | 'audit-trail'
  | 'access-requests';

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('hotel');
  const [showAddRoomTypeModal, setShowAddRoomTypeModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFAStep, setTwoFAStep] = useState<1 | 2>(1);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [accessRequestAction, setAccessRequestAction] = useState<{
    id: string;
    type: 'reject' | 'request-info';
    name: string;
  } | null>(null);
  const [accessRequestNotes, setAccessRequestNotes] = useState('');
  const [replyModal, setReplyModal] = useState<{
    request: AccessRequest;
    replies: AccessRequestReply[];
    baseUrl: string;
  } | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState({
    newBookings: true,
    checkIns: true,
    housekeepingUpdates: false,
    dailyReports: true,
  });
  const [appearancePrefs, setAppearancePrefs] = useState({
    background: 'mist',
  });
  const [auditSettings, setAuditSettings] = useState(getAuditSettings());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const { user, setUser } = useAuthStore();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [hotelForm, setHotelForm] = useState({
    name: '',
    address: '',
    addressLine1: '',
    city: '',
    country: '',
    currency: 'USD',
    timezone: 'UTC',
  });

  const roleOptions = useMemo(
    () => [
      { value: 'ADMIN', label: 'Admin' },
      { value: 'MANAGER', label: 'Manager' },
      { value: 'RECEPTIONIST', label: 'Receptionist' },
      { value: 'HOUSEKEEPING', label: 'Housekeeping' },
    ],
    []
  );

  const backgroundOptions = [
    { value: 'mist', label: 'Mist Gradient' },
    { value: 'linen', label: 'Linen Pattern' },
    { value: 'glow', label: 'Soft Glow' },
    { value: 'dusk', label: 'Dusk Horizon' },
    { value: 'sand', label: 'Sand Wash' },
    { value: 'tide', label: 'Tide Lines' },
  ];

  const filteredAuditLogs = useMemo(() => {
    if (!auditFilter.trim()) return auditLogs;
    const query = auditFilter.trim().toLowerCase();
    return auditLogs.filter((log) =>
      [log.action, log.actorName, log.targetLabel, log.targetId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [auditFilter, auditLogs]);

  const normalizeRole = (role?: string | null) => {
    if (!role) return 'RECEPTIONIST';
    const value = role.trim().toUpperCase().replace(/\s+/g, '_');
    if (roleOptions.some((option) => option.value === value)) {
      return value;
    }
    return 'RECEPTIONIST';
  };

  useEffect(() => {
    if (user?.hotel) {
      setHotelForm({
        name: user.hotel.name || '',
        address: user.hotel.address || '',
        addressLine1: user.hotel.addressLine1 || '',
        city: user.hotel.city || '',
        country: user.hotel.country || '',
        currency: user.hotel.currency || 'USD',
        timezone: user.hotel.timezone || 'UTC',
      });
    }
  }, [user]);

  useEffect(() => {
    const stored = localStorage.getItem('laflo:notificationPrefs');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setNotificationPrefs((prev) => ({ ...prev, ...parsed }));
      } catch {
        // Ignore malformed values.
      }
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('laflo:appearance');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<typeof appearancePrefs> & { theme?: string };
        setAppearancePrefs((prev) => ({ ...prev, background: parsed.background ?? prev.background }));
      } catch {
        // Ignore malformed values.
      }
    }
  }, []);

  useEffect(() => {
    setAuditLogs(getAuditLogs());
    setAuditSettings(getAuditSettings());
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.dataset.bg = appearancePrefs.background;
  }, [appearancePrefs]);

  useEffect(() => {
    const tab = searchParams.get('tab') as SettingsTab | null;
    if (tab && tab !== activeTab) {
      const allowedTabs: SettingsTab[] = [
        'hotel',
        'room-types',
        'security',
        'notifications',
        'appearance',
        'audit-trail',
        'access-requests',
      ];
      if (allowedTabs.includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, [activeTab, searchParams]);

  const { data: roomTypes, isLoading: roomTypesLoading } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: roomService.getRoomTypes,
    enabled: activeTab === 'room-types',
  });

  const {
    data: accessRequests,
    isLoading: accessRequestsLoading,
  } = useQuery({
    queryKey: ['accessRequests'],
    queryFn: accessRequestService.list,
    enabled: activeTab === 'access-requests',
  });

  const createRoomTypeMutation = useMutation({
    mutationFn: roomService.createRoomType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
      toast.success('Room type created');
      setShowAddRoomTypeModal(false);
    },
    onError: () => {
      toast.error('Failed to create room type');
    },
  });

  const approveAccessMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role?: string }) =>
      accessRequestService.approve(id, role),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
      appendAuditLog({
        action: 'ACCESS_REQUEST_APPROVED',
        actorId: user?.id,
        actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
        targetId: variables.id,
        details: { role: variables.role },
      });
      refreshAuditLogs();
      if (result?.inviteEmailSent) {
        toast.success('Access approved and invite sent');
      } else {
        toast('Access approved, but email invite was not delivered. Ask user to use Forgot password.', {
          icon: '⚠️',
          duration: 6000,
        });
      }
    },
    onError: () => {
      toast.error('Failed to approve access request');
    },
  });

  const rejectAccessMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      accessRequestService.reject(id, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
      appendAuditLog({
        action: 'ACCESS_REQUEST_REJECTED',
        actorId: user?.id,
        actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
        targetId: variables.id,
        details: { notes: variables.notes },
      });
      refreshAuditLogs();
      toast.success('Access request rejected');
    },
    onError: () => {
      toast.error('Failed to reject access request');
    },
  });

  const requestInfoMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      accessRequestService.requestInfo(id, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
      appendAuditLog({
        action: 'ACCESS_REQUEST_INFO_REQUESTED',
        actorId: user?.id,
        actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
        targetId: variables.id,
        details: { notes: variables.notes },
      });
      refreshAuditLogs();
      toast.success('Requested additional information');
    },
    onError: () => {
      toast.error('Failed to request additional information');
    },
  });

  const deleteAccessRequestMutation = useMutation({
    mutationFn: (id: string) => accessRequestService.remove(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
      appendAuditLog({
        action: 'ACCESS_REQUEST_DELETED',
        actorId: user?.id,
        actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
        targetId: id,
      });
      refreshAuditLogs();
      toast.success('Access request deleted');
    },
    onError: () => {
      toast.error('Failed to delete access request');
    },
  });

  // Simulate user reply (for demo/testing purposes)
  // @ts-expect-error - This mutation is available for testing purposes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const simulateReplyMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      accessRequestService.simulateReply(id, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
      toast.success('Reply simulated - status changed to Info Received');
    },
    onError: () => {
      toast.error('Failed to simulate reply');
    },
  });

  const setup2FAMutation = useMutation({
    mutationFn: authService.setup2FA,
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setTwoFASecret(data.secret);
      setTwoFAStep(1);
      setShow2FAModal(true);
    },
    onError: () => {
      toast.error('Failed to setup 2FA');
    },
  });

  const enable2FAMutation = useMutation({
    mutationFn: (code: string) => authService.enable2FA(code),
    onSuccess: () => {
      toast.success('2FA enabled successfully');
      setShow2FAModal(false);
      setQrCode('');
      setTwoFASecret('');
      setTwoFAStep(1);
      if (user) {
        setUser({ ...user, twoFactorEnabled: true });
      }
    },
    onError: () => {
      toast.error('Invalid verification code');
    },
  });

  const updateHotelMutation = useMutation({
    mutationFn: hotelService.updateMyHotel,
    onSuccess: async (updatedHotel, variables) => {
      const previousHotel = user?.hotel;
      const locationChanged = Boolean(
        previousHotel &&
          ((updatedHotel.city ?? previousHotel.city) !== previousHotel.city ||
            (updatedHotel.country ?? previousHotel.country) !== previousHotel.country ||
            (updatedHotel.address ?? previousHotel.address) !== previousHotel.address ||
            (updatedHotel.addressLine1 ?? previousHotel.addressLine1) !== previousHotel.addressLine1)
      );
      const locationFieldsSubmitted =
        variables.city !== undefined ||
        variables.country !== undefined ||
        variables.address !== undefined ||
        variables.addressLine1 !== undefined;

      toast.success('Hotel settings updated');
      if (user) {
        setUser({ ...user, hotel: { ...user.hotel, ...updatedHotel } });
      }

      if (updatedHotel.id) {
        await queryClient.invalidateQueries({ queryKey: ['weatherSignalsStatus', updatedHotel.id] });
        await queryClient.invalidateQueries({ queryKey: ['weatherOpsActions', updatedHotel.id] });
      }

      if ((locationChanged || locationFieldsSubmitted) && updatedHotel.id && canSyncWeather && !syncWeatherMutation.isPending) {
        toast('Location changed. Refreshing weather forecast...');
        syncWeatherMutation.mutate(updatedHotel.id);
      }
    },
    onError: () => {
      toast.error('Failed to update hotel settings');
    },
  });

  const syncWeatherMutation = useMutation({
    mutationFn: (hotelId: string) => weatherSignalsService.sync(hotelId),
    onSuccess: async (data) => {
      queryClient.setQueryData(['weatherSignalsStatus', data.hotelId], {
        hotelId: data.hotelId,
        lastSyncTime: data.fetchedAtUtc,
        daysAvailable: data.daysStored,
        hasCity: Boolean(data.city),
        hasLatLon: data.lat != null && data.lon != null,
        city: data.city,
        country: data.country,
        timezone: data.timezone,
        lat: data.lat,
        lon: data.lon,
      });
      toast.success(`Weather synced (${data.daysStored} days stored)`);
      await queryClient.invalidateQueries({ queryKey: ['weatherSignalsStatus', data.hotelId] });
      await queryClient.invalidateQueries({ queryKey: ['weatherOpsActions', data.hotelId] });
      await queryClient.refetchQueries({ queryKey: ['weatherSignalsStatus', data.hotelId] });
    },
    onError: (error) => {
      const message =
        (error as any)?.response?.data?.error ||
        (error as Error | null)?.message ||
        'Weather sync failed';
      toast.error(message);
    },
  });

  const canSyncWeather = Boolean(
    user?.hotel?.id &&
      hotelForm.city.trim() &&
      hotelForm.country.trim() &&
      hotelForm.timezone.trim()
  );

  const formatBytes = (value?: number) => {
    if (!value) return '0 B';
    const kb = value / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const stripHtml = (value: string) =>
    value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');

  const normalizeWhitespace = (value: string) =>
    value
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const extractRequesterMessage = (reply: AccessRequestReply) => {
    const source = (reply.bodyText?.trim() || stripHtml(reply.bodyHtml || '')).trim();
    if (!source) return 'No response message captured.';

    const lines = source.split(/\r?\n/);
    const cleaned: string[] = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        if (cleaned.length && cleaned[cleaned.length - 1] !== '') {
          cleaned.push('');
        }
        continue;
      }

      if (/^>/.test(line)) continue;
      if (/^on .+ wrote:$/i.test(line)) break;
      if (/^from:\s/i.test(line)) continue;
      if (/^sent:\s/i.test(line)) continue;
      if (/^subject:\s/i.test(line)) continue;
      if (/^to:\s/i.test(line)) continue;
      if (/^cc:\s/i.test(line)) continue;
      if (/^https?:\/\/\S+/i.test(line)) continue;
      if (/^respond to request/i.test(line)) continue;
      if (/^please respond promptly/i.test(line)) continue;
      if (/^your request cannot be processed/i.test(line)) continue;
      if (/^if the button doesn't work/i.test(line)) continue;
      if (/^©\s*\d{4}/i.test(line)) continue;
      if (/^environmental health/i.test(line)) continue;
      if (/^ehs portal/i.test(line)) continue;
      if (/^message from administrator/i.test(line)) continue;
      if (/^ref:\s*ar-/i.test(line)) continue;

      cleaned.push(line);
    }

    const message = normalizeWhitespace(cleaned.join('\n'));
    if (message) return message;

    // Fallback: first non-quoted non-empty line only
    const fallback = lines
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('>') && !/^https?:\/\//i.test(line));

    return fallback || 'No response message captured.';
  };

  const refreshAuditLogs = () => {
    setAuditLogs(getAuditLogs());
  };

  const downloadTextFile = (content: string, filename: string, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const openReplyModal = async (request: AccessRequest) => {
    try {
      setReplyLoading(true);
      const replies = await accessRequestService.getReplies(request.id);
      setReplyModal({
        request,
        replies,
        baseUrl: api.defaults.baseURL?.replace(/\/$/, '') || '',
      });
      // Acknowledge the response so notification badges clear.
      ackAccessRequest(request.id);
    } catch (error) {
      toast.error('Failed to load access request response');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleAttachmentAction = async (
    reply: AccessRequestReply,
    index: number,
    filename?: string,
    inline?: boolean
  ) => {
    try {
      const result = await accessRequestService.downloadAttachment(
        reply.accessRequestId,
        reply.id,
        index,
        inline
      );
      const resolvedName =
        result.filename.startsWith('attachment-') && filename ? filename : result.filename;
      const blobUrl = window.URL.createObjectURL(result.blob);

      if (inline) {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = resolvedName || filename || `attachment-${index + 1}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 10000);
    } catch (error) {
      toast.error('Failed to download attachment');
    }
  };

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const saveNotificationPrefs = () => {
    localStorage.setItem('laflo:notificationPrefs', JSON.stringify(notificationPrefs));
    appendAuditLog({
      action: 'NOTIFICATION_PREFS_UPDATED',
      actorId: user?.id,
      actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
      details: notificationPrefs,
    });
    refreshAuditLogs();
    toast.success('Preferences saved');
  };

  const saveAppearancePrefs = () => {
    localStorage.setItem('laflo:appearance', JSON.stringify(appearancePrefs));
    appendAuditLog({
      action: 'APPEARANCE_UPDATED',
      actorId: user?.id,
      actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
      details: { ...appearancePrefs, theme },
    });
    refreshAuditLogs();
    toast.success('Appearance saved');
  };

  const saveAuditPrefs = () => {
    saveAuditSettings(auditSettings);
      appendAuditLog({
        action: 'AUDIT_SETTINGS_UPDATED',
        actorId: user?.id,
        actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
        details: { ...auditSettings },
      });
    refreshAuditLogs();
    toast.success('Audit settings saved');
  };

  const tabs: { id: SettingsTab; name: string; icon: JSX.Element }[] = [
    {
      id: 'hotel',
      name: 'Hotel Info',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
    {
      id: 'room-types',
      name: 'Room Types',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      ),
    },
    {
      id: 'security',
      name: 'Security',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      ),
    },
    {
      id: 'notifications',
      name: 'Notifications',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      ),
    },
    {
      id: 'appearance',
      name: 'Appearance',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4a8 8 0 00-8 8 4 4 0 004 4h1v4l4-4h3a8 8 0 000-16z"
          />
        </svg>
      ),
    },
    {
      id: 'audit-trail',
      name: 'Audit Trail',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5h6M9 9h6M9 13h6M5 5h.01M5 9h.01M5 13h.01M5 17h.01M9 17h6"
          />
        </svg>
      ),
    },
    {
      id: 'access-requests',
      name: 'Access Requests',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your hotel and account settings</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <div className="w-full lg:w-64 shrink-0">
          <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                {tab.icon}
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Hotel Info */}
          {activeTab === 'hotel' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900">Hotel Information</h2>
              <p className="text-sm text-slate-500">Update your hotel's basic information</p>

              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const payload = {
                    name: hotelForm.name,
                    currency: hotelForm.currency,
                    timezone: hotelForm.timezone,
                    ...(hotelForm.address.trim() ? { address: hotelForm.address.trim() } : {}),
                    ...(hotelForm.addressLine1.trim() ? { addressLine1: hotelForm.addressLine1.trim() } : {}),
                    ...(hotelForm.city.trim() ? { city: hotelForm.city.trim() } : {}),
                    ...(hotelForm.country.trim() ? { country: hotelForm.country.trim() } : {}),
                  };
                  updateHotelMutation.mutate({
                    ...payload,
                  });
                }}
              >
                <div>
                  <label className="label">Hotel Name</label>
                  <input
                    type="text"
                    value={hotelForm.name}
                    onChange={(e) => setHotelForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="input"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">City</label>
                    <input
                      type="text"
                      value={hotelForm.city}
                      onChange={(e) => setHotelForm((prev) => ({ ...prev, city: e.target.value }))}
                      className="input"
                      placeholder="e.g. Lagos"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Country</label>
                    <input
                      type="text"
                      value={hotelForm.country}
                      onChange={(e) => setHotelForm((prev) => ({ ...prev, country: e.target.value }))}
                      className="input"
                      placeholder="e.g. Nigeria"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Address (optional)</label>
                    <input
                      type="text"
                      value={hotelForm.address}
                      onChange={(e) => setHotelForm((prev) => ({ ...prev, address: e.target.value }))}
                      className="input"
                      placeholder="Full address"
                    />
                  </div>
                  <div>
                    <label className="label">Address Line 1 (optional)</label>
                    <input
                      type="text"
                      value={hotelForm.addressLine1}
                      onChange={(e) => setHotelForm((prev) => ({ ...prev, addressLine1: e.target.value }))}
                      className="input"
                      placeholder="Street / building"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Currency</label>
                    <select
                      value={hotelForm.currency}
                      onChange={(e) => setHotelForm((prev) => ({ ...prev, currency: e.target.value }))}
                      className="input"
                    >
                      {currencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Timezone</label>
                    <select
                      value={hotelForm.timezone}
                      onChange={(e) => setHotelForm((prev) => ({ ...prev, timezone: e.target.value }))}
                      className="input"
                    >
                      {timezoneOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="btn-primary" disabled={updateHotelMutation.isPending}>
                    {updateHotelMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>

              {Boolean(user) && (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Operational Forecast Signals</div>
                      <div className="mt-1 text-sm text-slate-600">
                        Weather signals are used in Operations Center for advisories, demand tracking, and task creation.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate('/operations')}
                      className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Open Operations Center
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Room Types */}
          {activeTab === 'room-types' && (
            <div className="space-y-6">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Room Types</h2>
                    <p className="text-sm text-slate-500">Manage your room categories and rates</p>
                  </div>
                  <button
                    onClick={() => setShowAddRoomTypeModal(true)}
                    className="btn-primary"
                  >
                    Add Room Type
                  </button>
                </div>

                <div className="mt-6">
                  {roomTypesLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-20 animate-shimmer rounded-lg" />
                      ))}
                    </div>
                  ) : roomTypes && roomTypes.length > 0 ? (
                    <div className="space-y-3">
                      {roomTypes.map((roomType) => (
                        <div
                          key={roomType.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
                        >
                          <div>
                            <h3 className="font-medium text-slate-900">{roomType.name}</h3>
                            <p className="text-sm text-slate-500">
                              {roomType.description || 'No description'}
                            </p>
                            <div className="mt-1 flex items-center gap-4 text-sm text-slate-500">
                              <span>Base rate: ${roomType.baseRate}/night</span>
                              <span>Max guests: {roomType.maxGuests}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="btn-ghost text-sm">Edit</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No room types configured</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Change Password */}
              <div className="card">
                <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
                <p className="text-sm text-slate-500">Update your account password</p>

                <form className="mt-6 space-y-4">
                  <div>
                    <label className="label">Current Password</label>
                    <input type="password" className="input" />
                  </div>
                  <div>
                    <label className="label">New Password</label>
                    <input type="password" className="input" />
                  </div>
                  <div>
                    <label className="label">Confirm New Password</label>
                    <input type="password" className="input" />
                  </div>
                  <div className="pt-2">
                    <button type="submit" className="btn-primary">
                      Update Password
                    </button>
                  </div>
                </form>
              </div>

              {/* Two-Factor Authentication */}
              <div className="card">
                <h2 className="text-lg font-semibold text-slate-900">Two-Factor Authentication</h2>
                <p className="text-sm text-slate-500">
                  Add an extra layer of security to your account
                </p>

                <div className="mt-6">
                  {user?.twoFactorEnabled ? (
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                          <svg
                            className="h-5 w-5 text-emerald-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-emerald-900">2FA is enabled</p>
                          <p className="text-sm text-emerald-700">
                            Your account is protected with two-factor authentication
                          </p>
                        </div>
                      </div>
                      <button className="btn-outline text-sm">Disable</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg bg-amber-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                          <svg
                            className="h-5 w-5 text-amber-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-amber-900">2FA is not enabled</p>
                          <p className="text-sm text-amber-700">
                            Enable two-factor authentication for better security
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setup2FAMutation.mutate()}
                        disabled={setup2FAMutation.isPending}
                        className="btn-primary text-sm"
                      >
                        {setup2FAMutation.isPending ? 'Setting up...' : 'Enable 2FA'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Authentication Options (Roadmap) */}
              <div className="card">
                <h2 className="text-lg font-semibold text-slate-900">Authentication Options</h2>
                <p className="text-sm text-slate-500">
                  Additional sign-in methods (biometric/passphrase) can be added after 2FA is stable.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">Passkey (biometric)</p>
                      <p className="text-sm text-slate-500">Sign in with Face ID / Touch ID (WebAuthn).</p>
                    </div>
                    <button type="button" className="btn-outline text-sm" disabled>
                      Coming soon
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">Passphrase sign-in</p>
                      <p className="text-sm text-slate-500">Use a human-friendly passphrase instead of a password.</p>
                    </div>
                    <button type="button" className="btn-outline text-sm" disabled>
                      Coming soon
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900">Notification Preferences</h2>
              <p className="text-sm text-slate-500">Choose what notifications you receive</p>

              <div className="mt-6 space-y-4">
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">New Bookings</p>
                      <p className="text-sm text-slate-500">
                        Get notified when a new booking is made
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.newBookings}
                      onChange={(event) =>
                        setNotificationPrefs((prev) => ({
                          ...prev,
                          newBookings: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300 text-primary-600"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">Check-ins</p>
                      <p className="text-sm text-slate-500">
                        Get notified when guests check in
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.checkIns}
                      onChange={(event) =>
                        setNotificationPrefs((prev) => ({
                          ...prev,
                          checkIns: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300 text-primary-600"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">Housekeeping Updates</p>
                      <p className="text-sm text-slate-500">
                        Get notified when room status changes
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.housekeepingUpdates}
                      onChange={(event) =>
                        setNotificationPrefs((prev) => ({
                          ...prev,
                          housekeepingUpdates: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300 text-primary-600"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">Daily Reports</p>
                      <p className="text-sm text-slate-500">
                        Receive daily summary reports via email
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.dailyReports}
                      onChange={(event) =>
                        setNotificationPrefs((prev) => ({
                          ...prev,
                          dailyReports: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300 text-primary-600"
                    />
                  </label>
                </div>

                <div className="mt-6">
                  <button className="btn-primary" onClick={saveNotificationPrefs}>
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

          {/* Appearance */}
          {activeTab === 'appearance' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900">Appearance</h2>
              <p className="text-sm text-slate-500">Choose a theme and background style.</p>

              <div className="mt-6 space-y-6">
                <div>
                  <label className="label">Theme</label>
                  <ThemeSwitcher />
                  <p className="mt-2 text-xs text-slate-500">
                    Active theme: <span className="font-medium capitalize">{theme}</span>
                  </p>
                </div>

                <div>
                  <label className="label">Background</label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {backgroundOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setAppearancePrefs((prev) => ({ ...prev, background: option.value }))
                        }
                        className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                          appearancePrefs.background === option.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300'
                        }`}
                      >
                        <div className="font-medium text-slate-900">{option.label}</div>
                        <div className="mt-1 text-xs text-slate-500">Page background</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button className="btn-primary" onClick={saveAppearancePrefs}>
                    Save Appearance
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Audit Trail */}
          {activeTab === 'audit-trail' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold text-slate-900">Audit Trail</h2>
                <p className="text-sm text-slate-500">
                  Track critical changes and keep an operational record.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Retention (days)</label>
                    <input
                      type="number"
                      min={14}
                      max={365}
                      className="input"
                      value={auditSettings.retentionDays}
                      onChange={(event) =>
                        setAuditSettings((prev) => ({
                          ...prev,
                          retentionDays: Number(event.target.value || 0),
                        }))
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Recommended: 90 days for operational audit needs.
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">External log forwarding</p>
                      <p className="text-xs text-slate-500">
                        Send copies to your log monitoring tool.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={auditSettings.forwardingEnabled}
                      onChange={(event) =>
                        setAuditSettings((prev) => ({
                          ...prev,
                          forwardingEnabled: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300 text-primary-600"
                    />
                  </div>
                </div>

                {auditSettings.forwardingEnabled && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Forwarding URL</label>
                      <input
                        className="input"
                        placeholder="https://logs.example.com/ingest"
                        value={auditSettings.forwardingUrl || ''}
                        onChange={(event) =>
                          setAuditSettings((prev) => ({
                            ...prev,
                            forwardingUrl: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">API Key</label>
                      <input
                        className="input"
                        placeholder="Optional"
                        value={auditSettings.forwardingApiKey || ''}
                        onChange={(event) =>
                          setAuditSettings((prev) => ({
                            ...prev,
                            forwardingApiKey: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="btn-primary" onClick={saveAuditPrefs}>
                    Save Audit Settings
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() =>
                      downloadTextFile(
                        JSON.stringify(auditLogs, null, 2),
                        'audit-log.json',
                        'application/json'
                      )
                    }
                  >
                    Export JSON
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => {
                      const header = ['Timestamp', 'Action', 'Actor', 'Target', 'Details'];
                      const rows = auditLogs.map((log) => [
                        log.createdAt,
                        log.action,
                        log.actorName || '',
                        log.targetLabel || log.targetId || '',
                        log.details ? JSON.stringify(log.details) : '',
                      ]);
                      const csv = [header, ...rows]
                        .map((row) =>
                          row
                            .map((cell) => `"${String(cell).replace(/\"/g, '""')}"`)
                            .join(',')
                        )
                        .join('\n');
                      downloadTextFile(csv, 'audit-log.csv', 'text/csv');
                    }}
                  >
                    Export CSV
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => {
                      const latest = auditLogs[0]?.createdAt || 'N/A';
                      const report = [
                        'LaFlo Compliance Snapshot',
                        `Generated: ${new Date().toISOString()}`,
                        `Retention: ${auditSettings.retentionDays} days`,
                        `Forwarding Enabled: ${auditSettings.forwardingEnabled ? 'Yes' : 'No'}`,
                        `Forwarding URL: ${auditSettings.forwardingUrl || 'Not configured'}`,
                        `Latest Log Entry: ${latest}`,
                        '',
                        'Review items:',
                        '- Access requests audited',
                        '- User management changes logged',
                        '- Notification settings tracked',
                      ].join('\n');
                      downloadTextFile(report, 'compliance-report.txt');
                    }}
                  >
                    Generate Compliance Report
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                  <input
                    value={auditFilter}
                    onChange={(event) => setAuditFilter(event.target.value)}
                    placeholder="Filter audit entries..."
                    className="input max-w-xs"
                  />
                </div>

                <div className="mt-4">
                  {filteredAuditLogs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      No audit entries yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredAuditLogs.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-slate-200 px-4 py-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">{entry.action}</span>
                            <span className="text-xs text-slate-500">
                              {new Date(entry.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-slate-600">
                            Actor: {entry.actorName || 'System'}
                          </div>
                          {entry.targetLabel || entry.targetId ? (
                            <div className="text-xs text-slate-600">
                              Target: {entry.targetLabel || entry.targetId}
                            </div>
                          ) : null}
                          {entry.details && (
                            <pre className="mt-2 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-500">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Access Requests */}
          {activeTab === 'access-requests' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900">Access Requests</h2>
              <p className="text-sm text-slate-500">
                Review new access requests and send password setup invites.
              </p>

              <div className="mt-6">
                {accessRequestsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 animate-shimmer rounded-lg" />
                    ))}
                  </div>
                ) : accessRequests && accessRequests.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Requester</th>
                          <th className="px-3 py-2">Company</th>
                          <th className="px-3 py-2">Requested Role</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Requested</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {accessRequests.map((request) => {
                          const selectedRole =
                            selectedRoles[request.id] || normalizeRole(request.role);
                          return (
                            <tr key={request.id}>
                              <td className="px-3 py-3">
                                <div className="font-medium text-slate-900">{request.fullName}</div>
                                <div className="text-slate-500">{request.email}</div>
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                {request.company || '-'}
                              </td>
                              <td className="px-3 py-3">
                                {request.status === 'PENDING' ? (
                                  <select
                                    className="input h-9"
                                    value={selectedRole}
                                    onChange={(event) =>
                                      setSelectedRoles((prev) => ({
                                        ...prev,
                                        [request.id]: event.target.value,
                                      }))
                                    }
                                  >
                                    {roleOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-slate-700">
                                    {normalizeRole(request.role)}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    request.status === 'APPROVED'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : request.status === 'REJECTED'
                                        ? 'bg-rose-100 text-rose-700'
                                        : request.status === 'INFO_RECEIVED'
                                          ? 'bg-indigo-100 text-indigo-700'
                                          : request.status === 'NEEDS_INFO' || request.status === 'INFO_REQUESTED'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {formatEnumLabel(request.status)}
                                </span>
                                {request.adminNotes && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    Notes: {request.adminNotes}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                {new Date(request.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {request.status === 'PENDING' ||
                                request.status === 'NEEDS_INFO' ||
                                request.status === 'INFO_REQUESTED' ||
                                request.status === 'INFO_RECEIVED' ? (
                                  <div className="flex flex-wrap justify-end gap-2">
                                    {(request.status === 'INFO_RECEIVED' ||
                                      request.status === 'NEEDS_INFO' ||
                                      request.status === 'INFO_REQUESTED') && (
                                      <button
                                        className="btn-outline text-sm"
                                        onClick={() => openReplyModal(request)}
                                        disabled={replyLoading}
                                      >
                                        {replyLoading ? 'Loading...' : 'View response'}
                                      </button>
                                    )}
                                    <button
                                      className="btn-outline text-sm"
                                      onClick={() => {
                                        setAccessRequestNotes('');
                                        setAccessRequestAction({
                                          id: request.id,
                                          type: 'request-info',
                                          name: request.fullName,
                                        });
                                      }}
                                    >
                                      Request info
                                    </button>
                                    <button
                                      className="btn-outline text-sm text-rose-600"
                                      onClick={() => {
                                        setAccessRequestNotes('');
                                        setAccessRequestAction({
                                          id: request.id,
                                          type: 'reject',
                                          name: request.fullName,
                                        });
                                      }}
                                    >
                                      Reject
                                    </button>
                                    <button
                                      className="btn-primary text-sm"
                                      disabled={
                                        approveAccessMutation.isPending &&
                                        approvingRequestId === request.id
                                      }
                                      onClick={async () => {
                                        setApprovingRequestId(request.id);
                                        try {
                                          await approveAccessMutation.mutateAsync({
                                            id: request.id,
                                            role: selectedRole,
                                          });
                                        } finally {
                                          setApprovingRequestId((current) =>
                                            current === request.id ? null : current
                                          );
                                        }
                                      }}
                                    >
                                      {approveAccessMutation.isPending &&
                                      approvingRequestId === request.id
                                        ? 'Sending...'
                                        : 'Approve'}
                                    </button>
                                    <button
                                      className="btn-outline text-sm text-rose-600"
                                      onClick={() => {
                                        const confirmed = window.confirm(
                                          'Delete this access request? This cannot be undone.'
                                        );
                                        if (confirmed) {
                                          deleteAccessRequestMutation.mutate(request.id);
                                        }
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end">
                                    <button
                                      className="btn-outline text-sm text-rose-600"
                                      onClick={() => {
                                        const confirmed = window.confirm(
                                          'Delete this access request? This cannot be undone.'
                                        );
                                        if (confirmed) {
                                          deleteAccessRequestMutation.mutate(request.id);
                                        }
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No access requests yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Room Type Modal */}
      {showAddRoomTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setShowAddRoomTypeModal(false)}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Add Room Type</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createRoomTypeMutation.mutate({
                  name: formData.get('name') as string,
                  description: formData.get('description') as string || undefined,
                  baseRate: Number(formData.get('baseRate')),
                  maxGuests: Number(formData.get('maxGuests')),
                  amenities: [],
                  isActive: true,
                });
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="label">Name *</label>
                <input name="name" required className="input" placeholder="e.g., Deluxe King" />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea name="description" className="input" rows={2} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Base Rate *</label>
                  <input
                    name="baseRate"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Max Guests *</label>
                  <input
                    name="maxGuests"
                    type="number"
                    min="1"
                    required
                    className="input"
                    defaultValue="2"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddRoomTypeModal(false)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRoomTypeMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createRoomTypeMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShow2FAModal(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Setup Two-Factor Authentication</h2>
            <p className="mt-2 text-sm text-slate-500">
              Step {twoFAStep} of 2
            </p>

            {twoFAStep === 1 ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">1. Scan the QR code</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Open Google Authenticator, Microsoft Authenticator, or Authy and scan.
                  </p>
                  <div className="mt-4 flex justify-center">
                    {qrCode ? (
                      <img src={qrCode} alt="2FA QR Code" className="h-48 w-48 rounded-lg bg-white p-2" />
                    ) : (
                      <div className="h-48 w-48 animate-shimmer rounded-lg" />
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">2. Or enter the setup key manually</p>
                  <p className="mt-1 text-sm text-slate-600">If you cannot scan, copy the secret below.</p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      readOnly
                      value={twoFASecret || ''}
                      className="input font-mono text-sm"
                      aria-label="2FA setup key"
                      placeholder="Setup key"
                    />
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(twoFASecret || '');
                          toast.success('Copied');
                        } catch {
                          toast.error('Copy failed');
                        }
                      }}
                      disabled={!twoFASecret}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShow2FAModal(false);
                      setQrCode('');
                      setTwoFASecret('');
                      setTwoFAStep(1);
                    }}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    onClick={() => setTwoFAStep(2)}
                    disabled={!twoFASecret && !qrCode}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  enable2FAMutation.mutate(formData.get('code') as string);
                }}
                className="mt-6"
              >
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Verify and enable</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Enter the 6-digit code from your authenticator app to finish setup.
                  </p>
                </div>

                <div className="mt-4">
                  <label className="label">Verification Code</label>
                  <input
                    name="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    className="input text-center text-2xl tracking-widest"
                    placeholder="000000"
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setTwoFAStep(1)} className="btn-outline flex-1">
                    Back
                  </button>
                  <button type="submit" disabled={enable2FAMutation.isPending} className="btn-primary flex-1">
                    {enable2FAMutation.isPending ? 'Verifying...' : 'Enable 2FA'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {accessRequestAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setAccessRequestAction(null)}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">
              {accessRequestAction.type === 'reject' ? 'Reject access request' : 'Request more info'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Add a note for {accessRequestAction.name}. This will be emailed to the requester.
            </p>

            <textarea
              value={accessRequestNotes}
              onChange={(event) => setAccessRequestNotes(event.target.value)}
              rows={4}
              className="input mt-4"
              placeholder="Add your notes here..."
            />

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setAccessRequestAction(null)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={actionSubmitting}
                onClick={async () => {
                  const notes = accessRequestNotes.trim();
                  if (!notes) {
                    toast.error('Notes are required');
                    return;
                  }

                  setActionSubmitting(true);
                  try {
                    if (accessRequestAction.type === 'reject') {
                      await rejectAccessMutation.mutateAsync({ id: accessRequestAction.id, notes });
                    } else {
                      await requestInfoMutation.mutateAsync({ id: accessRequestAction.id, notes });
                    }
                    setAccessRequestAction(null);
                    setAccessRequestNotes('');
                  } finally {
                    setActionSubmitting(false);
                  }
                }}
              >
                {actionSubmitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {replyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setReplyModal(null)}
          />
          <div className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Access request response</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {replyModal.request.fullName} {'->'} {replyModal.request.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyModal(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {replyModal.replies.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No response details available yet.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {replyModal.replies.some(
                  (reply) => Array.isArray(reply.attachments) && reply.attachments.some((a) => !a.hasContent)
                ) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Some attachments were received before we enabled downloads. Ask the requester to resend
                    so the file can be captured for download.
                  </div>
                )}
                {replyModal.replies.map((reply) => (
                  <div key={reply.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>From: {reply.fromEmail}</span>
                      <span>{new Date(reply.receivedAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {reply.subject || 'Response received'}
                    </p>
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                        Required information provided
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                        {extractRequesterMessage(reply)}
                      </p>
                    </div>

                    {Array.isArray(reply.attachments) && reply.attachments.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-slate-500">Attachments</p>
                        <ul className="mt-2 space-y-1 text-xs text-slate-600">
                          {reply.attachments.map((attachment, index) => (
                            <li key={`${reply.id}-attachment-${index}`} className="flex justify-between">
                              <div className="flex flex-col">
                                <span>{attachment.filename}</span>
                                <span className="text-[11px] text-slate-400">
                                  {formatBytes(attachment.size)}
                                </span>
                              </div>
                              {attachment.hasContent ? (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="text-xs text-primary-600 hover:text-primary-700"
                                    onClick={() =>
                                      handleAttachmentAction(reply, index, attachment.filename, true)
                                    }
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-slate-600 hover:text-slate-800"
                                    onClick={() =>
                                      handleAttachmentAction(reply, index, attachment.filename, false)
                                    }
                                  >
                                    Download
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-amber-600">Stored in inbox only</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setReplyModal(null)}
                className="btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
