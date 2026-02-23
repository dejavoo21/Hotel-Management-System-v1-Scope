import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { messageService } from '@/services';
import { PAGE_TITLE_CLASS } from '@/styles/typography';
import { useAuthStore } from '@/stores/authStore';
import SupportVideoPanel from '@/components/calls/SupportVideoPanel';
import type {
  ConversationMessage,
  MessageThreadDetail,
  MessageThreadSummary,
  SupportAgent,
  SupportVoiceToken,
} from '@/types';
import type { Device, Call } from '@twilio/voice-sdk';

type PresenceStatus = 'AVAILABLE' | 'BUSY' | 'DND' | 'AWAY' | 'OFFLINE';

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const formatDay = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const formatDateTime = (date?: string) =>
  date ? new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const resolveSenderName = (message: ConversationMessage) => {
  if (message.senderType === 'GUEST' && message.guest) return `${message.guest.firstName} ${message.guest.lastName}`;
  if (message.senderUser) return `${message.senderUser.firstName} ${message.senderUser.lastName}`;
  return 'Support';
};

const resolveThreadName = (thread: MessageThreadSummary) => {
  if (thread.guest) return `${thread.guest.firstName} ${thread.guest.lastName}`;
  return thread.subject || 'Guest';
};

const getStoredAvatarByUserId = (userId?: string | null) => {
  if (!userId) return null;
  try {
    return (
      localStorage.getItem(`laflo-user-avatar:${userId}`) ||
      localStorage.getItem(`laflo-profile-avatar:${userId}`)
    );
  } catch {
    return null;
  }
};

const LETTER_TO_DIGIT: Record<string, string> = {
  A: '2',
  B: '2',
  C: '2',
  D: '3',
  E: '3',
  F: '3',
  G: '4',
  H: '4',
  I: '4',
  J: '5',
  K: '5',
  L: '5',
  M: '6',
  N: '6',
  O: '6',
  P: '7',
  Q: '7',
  R: '7',
  S: '7',
  T: '8',
  U: '8',
  V: '8',
  W: '9',
  X: '9',
  Y: '9',
  Z: '9',
};

const sanitizePhone = (value?: string) => {
  const input = (value || '').toUpperCase();
  let output = '';
  for (const ch of input) {
    if (/\d/.test(ch)) {
      output += ch;
      continue;
    }
    if (ch === '+' && output.length === 0) {
      output += ch;
      continue;
    }
    if (LETTER_TO_DIGIT[ch]) {
      output += LETTER_TO_DIGIT[ch];
    }
  }
  return output;
};

const PRESENCE_STORAGE_KEY = 'laflo:user-presence';

const PRESENCE_META: Record<
  PresenceStatus,
  { label: string; dotClass: string; pillClass: string }
> = {
  AVAILABLE: {
    label: 'Available',
    dotClass: 'bg-emerald-500',
    pillClass: 'bg-emerald-100 text-emerald-700',
  },
  BUSY: {
    label: 'Busy',
    dotClass: 'bg-amber-500',
    pillClass: 'bg-amber-100 text-amber-700',
  },
  DND: {
    label: 'Do Not Disturb',
    dotClass: 'bg-rose-500',
    pillClass: 'bg-rose-100 text-rose-700',
  },
  AWAY: {
    label: 'Away',
    dotClass: 'bg-sky-500',
    pillClass: 'bg-sky-100 text-sky-700',
  },
  OFFLINE: {
    label: 'Offline',
    dotClass: 'bg-slate-300',
    pillClass: 'bg-slate-100 text-slate-500',
  },
};

const normalizePresenceStatus = (value?: string | null): PresenceStatus | null => {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/\s+/g, '_');
  if (['AVAILABLE', 'BUSY', 'DND', 'AWAY', 'OFFLINE'].includes(normalized)) {
    return normalized as PresenceStatus;
  }
  return null;
};

const fallbackPhoneByThread: Record<string, string> = {
  m1: '+15551230001',
  m2: '+15551230002',
};

const resolveThreadPhone = (thread?: MessageThreadSummary | null) => {
  if (!thread) return '';
  return sanitizePhone(thread.guest?.phone || fallbackPhoneByThread[thread.id] || '');
};

const mockThreads: MessageThreadSummary[] = [
  {
    id: 'm1',
    subject: 'Alice Johnson',
    status: 'OPEN',
    guest: { firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', phone: '+1 555 123 0001' },
    booking: { bookingRef: 'BK-305', checkInDate: new Date().toISOString(), checkOutDate: new Date().toISOString() },
    lastMessageAt: new Date().toISOString(),
    lastMessage: { id: 'm1-last', body: 'Can I request a late check-out for Room 305?', senderType: 'GUEST', createdAt: new Date().toISOString(), guest: { firstName: 'Alice', lastName: 'Johnson' } },
  },
  {
    id: 'm2',
    subject: 'Michael Brown',
    status: 'OPEN',
    guest: { firstName: 'Michael', lastName: 'Brown', email: 'michael@example.com', phone: '+1 555 123 0002' },
    booking: { bookingRef: 'BK-214', checkInDate: new Date().toISOString(), checkOutDate: new Date().toISOString() },
    lastMessageAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    lastMessage: { id: 'm2-last', body: "The air conditioning in my room isn't working.", senderType: 'GUEST', createdAt: new Date().toISOString(), guest: { firstName: 'Michael', lastName: 'Brown' } },
  },
];

const mockMessages: ConversationMessage[] = [
  { id: 'a1', body: 'Can I request a late check-out for Room 305?', senderType: 'GUEST', createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), guest: { firstName: 'Alice', lastName: 'Johnson' } },
  { id: 'a2', body: 'Yes, we can accommodate that. How late would you like to stay?', senderType: 'STAFF', createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString() },
  { id: 'a3', body: 'I was hoping to stay until 2 PM. Is that possible?', senderType: 'GUEST', createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), guest: { firstName: 'Alice', lastName: 'Johnson' } },
];

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [dialPadNumber, setDialPadNumber] = useState('');
  const [callStatus, setCallStatus] = useState<Record<string, 'PENDING' | 'IN_PROGRESS' | 'DONE'>>({});
  const [callNotes, setCallNotes] = useState<Record<string, string>>({});
  const [voiceState, setVoiceState] = useState<'IDLE' | 'CONNECTING' | 'IN_CALL' | 'ERROR'>('IDLE');
  const [voiceError, setVoiceError] = useState('');
  const [activeVoiceThreadId, setActiveVoiceThreadId] = useState<string | null>(null);
  const [presenceOverrides, setPresenceOverrides] = useState<Record<string, PresenceStatus>>({});
  const voiceDeviceRef = useRef<Device | null>(null);
  const voiceCallRef = useRef<Call | null>(null);
  const zeroHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeroHoldTriggeredRef = useRef(false);

  const { data: threadsData, isLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['message-threads', search],
    queryFn: () => messageService.listThreads(search),
    refetchInterval: 7000,
  });

  const threads = useMemo(() => ((threadsData && threadsData.length > 0 ? threadsData : mockThreads) as MessageThreadSummary[]), [threadsData]);

  const supportThreadQuery = useQuery({
    queryKey: ['live-support-thread', searchParams.get('support')],
    queryFn: () => messageService.getOrCreateLiveSupportThread(),
    enabled: searchParams.get('support') === '1',
    staleTime: 30_000,
  });

  const supportAgentsQuery = useQuery<SupportAgent[]>({
    queryKey: ['support-agents'],
    queryFn: () => messageService.listSupportAgents(),
    refetchInterval: 10_000,
  });
  const currentUserAvatar = useMemo(() => {
    if (!user?.id) return null;
    try {
      return localStorage.getItem(`laflo-profile-avatar:${user.id}`);
    } catch {
      return null;
    }
  }, [user?.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESENCE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      const next: Record<string, PresenceStatus> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const normalized = normalizePresenceStatus(value);
        if (normalized) next[key] = normalized;
      }
      setPresenceOverrides(next);
    } catch {
      // Ignore malformed presence cache.
    }
  }, []);

  const persistPresenceOverride = (userId: string, status: PresenceStatus) => {
    setPresenceOverrides((prev) => {
      const next = { ...prev, [userId]: status };
      try {
        localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore persistence failure.
      }
      return next;
    });
  };

  const resolveSupportAgentPresence = (agent: SupportAgent): PresenceStatus => {
    const effectiveOnline = supportAgentOnlineMap.get(agent.id) ?? agent.online;
    const override = presenceOverrides[agent.id];
    if (override && override !== 'OFFLINE') {
      return effectiveOnline ? override : 'OFFLINE';
    }
    if (override === 'OFFLINE') return 'OFFLINE';
    return effectiveOnline ? 'AVAILABLE' : 'OFFLINE';
  };

  const supportAgentOnlineMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const agent of supportAgentsQuery.data || []) {
      const isCurrentUserById = Boolean(user?.id && agent.id === user.id);
      const isCurrentUserByIdentity =
        Boolean(user?.firstName && user?.lastName && user?.role) &&
        agent.firstName.toLowerCase() === (user?.firstName || '').toLowerCase() &&
        agent.lastName.toLowerCase() === (user?.lastName || '').toLowerCase() &&
        agent.role === user?.role;
      map.set(agent.id, agent.online || isCurrentUserById || isCurrentUserByIdentity);
    }
    return map;
  }, [supportAgentsQuery.data, user?.id, user?.firstName, user?.lastName, user?.role]);

  useEffect(() => {
    const requestedThreadId = searchParams.get('thread');
    if (requestedThreadId) {
      setActiveThreadId(requestedThreadId);
      return;
    }
    if (supportThreadQuery.data?.id) {
      setActiveThreadId(supportThreadQuery.data.id);
      return;
    }
    if (!activeThreadId && threads.length > 0) setActiveThreadId(threads[0].id);
  }, [activeThreadId, threads, searchParams, supportThreadQuery.data?.id]);

  const activeThreadQuery = useQuery<MessageThreadDetail>({
    queryKey: ['message-thread', activeThreadId],
    queryFn: () => messageService.getThread(activeThreadId as string),
    enabled: Boolean(activeThreadId),
    refetchInterval: 4000,
  });

  const activeThread = activeThreadQuery.data;
  const activeThreadSummary = threads.find((t) => t.id === activeThreadId);
  const activeThreadPhone = resolveThreadPhone(activeThreadSummary);
  const activeThreadName =
    activeThreadSummary
      ? resolveThreadName(activeThreadSummary)
      : activeThread?.subject || 'Support';
  const activeMessages = useMemo(() => {
    if (activeThread && activeThread.messages.length > 0) return activeThread.messages;
    return mockMessages;
  }, [activeThread]);
  const activeThreadAssignedSupportPresence = useMemo(() => {
    const assigned = activeThread?.assignedSupport;
    if (!assigned) return null;
    const agentFromList = (supportAgentsQuery.data || []).find((agent) => agent.id === assigned.userId);
    if (!agentFromList) return null;
    return resolveSupportAgentPresence(agentFromList);
  }, [activeThread?.assignedSupport, supportAgentsQuery.data, presenceOverrides, supportAgentOnlineMap]);
  const callQueue = useMemo(
    () =>
      threads.slice(0, 6).map((thread) => ({
        id: thread.id,
        name: resolveThreadName(thread),
        phone: resolveThreadPhone(thread),
        status: callStatus[thread.id] || 'PENDING',
        lastMessageAt: thread.lastMessageAt,
      })),
    [threads, callStatus]
  );

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!activeThreadId) return;
      await messageService.createMessage(activeThreadId, draftMessage.trim());
    },
    onSuccess: async () => {
      setDraftMessage('');
      await Promise.all([activeThreadQuery.refetch(), refetchThreads()]);
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (userId?: string) => {
      if (!activeThreadId) return null;
      return messageService.assignSupportAgent(activeThreadId, userId);
    },
    onSuccess: async () => {
      await Promise.all([activeThreadQuery.refetch(), refetchThreads()]);
    },
  });

  const ensureVoiceDevice = async (): Promise<Device | null> => {
    if (voiceDeviceRef.current) return voiceDeviceRef.current;
    let tokenData: SupportVoiceToken;
    try {
      tokenData = await messageService.getSupportVoiceToken();
    } catch {
      setVoiceError('In-app calling is not configured yet. Please use Call guest (dialer).');
      setVoiceState('ERROR');
      return null;
    }
    try {
      const sdk = await import('@twilio/voice-sdk');
      const device = new sdk.Device(tokenData.token, {
        edge: 'ashburn',
        logLevel: 0,
      });
      device.on('error', (error) => {
        setVoiceError(error.message || 'Voice device error');
        setVoiceState('ERROR');
      });
      device.on('tokenWillExpire', async () => {
        try {
          const refreshed = await messageService.getSupportVoiceToken();
          await device.updateToken(refreshed.token);
        } catch {
          setVoiceError('Failed to refresh voice token');
          setVoiceState('ERROR');
        }
      });
      await device.register();
      voiceDeviceRef.current = device;
      return device;
    } catch {
      setVoiceError('Unable to initialize in-app calling on this browser.');
      setVoiceState('ERROR');
      return null;
    }
  };

  const startInAppCall = async (threadId: string, phone: string) => {
    if (!phone) {
      setVoiceError('No phone number saved for this thread.');
      setVoiceState('ERROR');
      return;
    }
    setVoiceError('');
    setVoiceState('CONNECTING');
    setActiveVoiceThreadId(threadId);
    setCallStatus((prev) => ({ ...prev, [threadId]: 'IN_PROGRESS' }));
    const device = await ensureVoiceDevice();
    if (!device) {
      setCallStatus((prev) => ({ ...prev, [threadId]: 'PENDING' }));
      setActiveVoiceThreadId(null);
      return;
    }
    try {
      const call = await device.connect({
        params: { To: phone, threadId },
      });
      voiceCallRef.current = call;
      setActiveVoiceThreadId(threadId);
      setVoiceState('IN_CALL');
      call.on('disconnect', () => {
        setVoiceState('IDLE');
        setActiveVoiceThreadId(null);
        setCallStatus((prev) => ({ ...prev, [threadId]: 'DONE' }));
        voiceCallRef.current = null;
      });
    } catch {
      setVoiceError('Failed to place in-app call.');
      setVoiceState('ERROR');
      setCallStatus((prev) => ({ ...prev, [threadId]: 'PENDING' }));
      setActiveVoiceThreadId(null);
    }
  };

  const startTwilioPhoneCall = async (phone: string, threadId?: string) => {
    const sanitized = sanitizePhone(phone);
    if (!sanitized || !/^\+?\d{7,15}$/.test(sanitized)) {
      toast.error('Enter a valid phone number before calling.');
      return;
    }
    try {
      const started = await messageService.startSupportPhoneCall({ to: sanitized, threadId });
      toast.success(`Call started (${started.sid.slice(-8)})`);
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Failed to start phone call';
      toast.error(message);
    }
  };

  const endInAppCall = () => {
    if (voiceCallRef.current) {
      voiceCallRef.current.disconnect();
      voiceCallRef.current = null;
    }
    if (activeVoiceThreadId) {
      setCallStatus((prev) => ({ ...prev, [activeVoiceThreadId]: 'DONE' }));
    }
    setActiveVoiceThreadId(null);
    setVoiceState('IDLE');
  };

  const appendDialPadKey = (entry: { digit: string }) => {
    setDialPadNumber((prev) => `${prev}${entry.digit}`);
  };

  const startZeroHold = () => {
    zeroHoldTriggeredRef.current = false;
    if (zeroHoldTimerRef.current) clearTimeout(zeroHoldTimerRef.current);
    zeroHoldTimerRef.current = setTimeout(() => {
      zeroHoldTriggeredRef.current = true;
      setDialPadNumber((prev) => `${prev}+`);
    }, 500);
  };

  const endZeroHold = () => {
    if (zeroHoldTimerRef.current) {
      clearTimeout(zeroHoldTimerRef.current);
      zeroHoldTimerRef.current = null;
    }
  };

  const clickZero = () => {
    if (zeroHoldTriggeredRef.current) {
      zeroHoldTriggeredRef.current = false;
      return;
    }
    setDialPadNumber((prev) => `${prev}0`);
  };

  const backspaceDialPad = () => {
    setDialPadNumber((prev) => prev.slice(0, -1));
  };

  const dialPadSanitized = sanitizePhone(dialPadNumber);
  const dialPadValid = /^\+?\d{7,15}$/.test(dialPadSanitized);

  useEffect(
    () => () => {
      if (voiceCallRef.current) {
        voiceCallRef.current.disconnect();
      }
      if (voiceDeviceRef.current) {
        void voiceDeviceRef.current.destroy();
      }
    },
    []
  );

  return (
    <div className="space-y-4">
      <h1 className={PAGE_TITLE_CLASS}>Chat</h1>

      <div className="grid gap-4 xl:grid-cols-[300px_280px_minmax(0,1fr)]">
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 xl:order-2">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, chat, etc" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm" />
            </div>
            <button type="button" className="rounded-xl border border-lime-300 bg-lime-200 p-2 text-slate-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
              </svg>
            </button>
          </div>

          <div className="space-y-2">
            {(isLoading ? [] : threads).map((thread) => {
              const isActive = activeThreadId === thread.id;
              const name = resolveThreadName(thread);
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('thread', thread.id);
                      return next;
                    });
                  }}
                  className={`w-full rounded-xl p-2 text-left ${isActive ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-200 text-xs font-bold text-slate-800">{getInitials(name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                        <span className="text-[11px] text-slate-500">{formatTime(thread.lastMessageAt)}</span>
                      </div>
                      <p className="truncate text-xs text-slate-500">{thread.lastMessage?.body || 'No message'}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 xl:order-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-200 text-xs font-bold text-slate-800">
                {getInitials(activeThreadName)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {activeThreadName}
                </p>
                <p className="text-xs text-slate-500">last seen recently</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeThreadPhone ? (
                <a
                  href={`tel:${activeThreadPhone}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.153a2 2 0 011.96 1.608l.415 2.076a2 2 0 01-.502 1.821l-1.16 1.16a16 16 0 006.364 6.364l1.16-1.16a2 2 0 011.821-.502l2.076.415A2 2 0 0121 16.847V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call guest
                </a>
              ) : null}
              <button className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" /></svg>
              </button>
            </div>
          </div>

          <div className="mt-4 h-[460px] overflow-y-auto pr-1">
            <div className="mb-4 text-center text-xs text-slate-400">Today, {formatDay(new Date().toISOString())}</div>
            <div className="space-y-4">
              {activeMessages.map((message) => {
                const senderName = resolveSenderName(message);
                const guestMsg = message.senderType === 'GUEST';
                const systemMsg = message.senderType === 'SYSTEM';
                const matchedAgent =
                  message.senderType === 'STAFF' && message.senderUser
                    ? (supportAgentsQuery.data || []).find(
                        (agent) =>
                          agent.firstName.toLowerCase() === message.senderUser?.firstName.toLowerCase() &&
                          agent.lastName.toLowerCase() === message.senderUser?.lastName.toLowerCase() &&
                          agent.role === message.senderUser?.role
                      )
                    : undefined;
                const resolvedSenderUserId = message.senderUser?.id || matchedAgent?.id;
                const isCurrentUserMessage = Boolean(
                  message.senderType === 'STAFF' &&
                    user &&
                    (resolvedSenderUserId === user.id ||
                      (!resolvedSenderUserId &&
                        senderName.toLowerCase() === `${user.firstName} ${user.lastName}`.toLowerCase()))
                );
                const alignLeft = guestMsg || systemMsg || (message.senderType === 'STAFF' && !isCurrentUserMessage);
                const senderRole = message.senderUser?.role;
                const senderOnline = resolvedSenderUserId
                  ? supportAgentOnlineMap.get(resolvedSenderUserId) === true
                  : false;
                const currentUserName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
                const senderLabel = systemMsg
                  ? 'LaFlo Assistant'
                  : `${isCurrentUserMessage ? currentUserName || senderName : senderName}${
                      senderRole || (isCurrentUserMessage ? user?.role : undefined)
                        ? ` (${senderRole || user?.role})`
                        : ''
                    }`;
                const senderAvatar =
                  (isCurrentUserMessage ? currentUserAvatar : null) ||
                  getStoredAvatarByUserId(resolvedSenderUserId);
                return (
                  <div key={message.id} className={`flex gap-2 ${alignLeft ? 'justify-start' : 'justify-end'}`}>
                    {alignLeft ? (
                      <div className="relative">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-lime-200 text-xs font-bold text-slate-800">
                          {systemMsg ? (
                            'AI'
                          ) : senderAvatar ? (
                            <img src={senderAvatar} alt={senderName} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(senderName)
                          )}
                        </div>
                        {!systemMsg && senderOnline ? (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                        ) : null}
                      </div>
                    ) : null}
                    <div className="max-w-[72%]">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {senderLabel}
                      </p>
                    <div className={`rounded-2xl px-4 py-3 text-sm ${
                      guestMsg
                        ? 'bg-emerald-100 text-slate-800'
                        : systemMsg
                          ? 'bg-primary-700 text-white'
                          : 'bg-lime-200 text-slate-900'
                    }`}>
                      <p>{message.body}</p>
                      <p className={`mt-1 text-right text-[11px] ${systemMsg ? 'text-white/80' : 'text-slate-500'}`}>{formatTime(message.createdAt)}</p>
                    </div>
                    </div>
                    {!alignLeft && !systemMsg ? (
                      <div className="relative">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-lime-200 text-xs font-bold text-slate-800">
                          {senderAvatar ? (
                            <img src={senderAvatar} alt={isCurrentUserMessage ? 'You' : senderName} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(senderName)
                          )}
                        </div>
                        {senderOnline ? (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!activeThreadId || !draftMessage.trim() || sendMessageMutation.isPending) return;
              await sendMessageMutation.mutateAsync();
            }}
            className="mt-3 border-t border-slate-100 pt-3"
          >
            <div className="flex gap-2">
              <input
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder="Type a live support message..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!activeThreadId || !draftMessage.trim() || sendMessageMutation.isPending}
                className="rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 xl:order-1">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Profile</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-lime-300 bg-lime-200 px-2 py-1 text-xs font-semibold text-slate-900">Popular</span>
              <button className="text-slate-400">x</button>
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lime-200 text-sm font-bold text-slate-800">
              {getInitials(activeThreadName)}
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{activeThreadName}</p>
            <p className="text-sm text-slate-500">G011-987654321</p>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase text-slate-400">About</p>
            <p className="mt-2 text-sm text-slate-600">
              A frequent traveler who enjoys luxury accommodations and values exceptional customer service.
            </p>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase text-slate-400">Assigned support</p>
            <p className="mt-2 text-sm text-slate-700">
              {activeThread?.assignedSupport
                ? `${activeThread.assignedSupport.firstName} ${activeThread.assignedSupport.lastName} (${activeThread.assignedSupport.role})`
                : 'Not assigned yet'}
            </p>
            {activeThread?.assignedSupport && activeThreadAssignedSupportPresence ? (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${PRESENCE_META[activeThreadAssignedSupportPresence].dotClass}`}
                />
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    PRESENCE_META[activeThreadAssignedSupportPresence].pillClass
                  }`}
                >
                  {PRESENCE_META[activeThreadAssignedSupportPresence].label}
                </span>
              </div>
            ) : null}
            {activeThread?.assignedSupport?.assignedAt ? (
              <p className="text-xs text-slate-500">Assigned {formatDateTime(activeThread.assignedSupport.assignedAt)}</p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await assignMutation.mutateAsync(undefined);
                }}
                disabled={!activeThreadId || assignMutation.isPending}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Assign to me
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-400">Support Team</p>
              <span className="text-xs text-slate-500">
                {supportAgentsQuery.data?.filter((a) => resolveSupportAgentPresence(a) !== 'OFFLINE').length || 0} online
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {(supportAgentsQuery.data || []).map((agent) => {
                const isOnline = supportAgentOnlineMap.get(agent.id) === true;
                const presence = resolveSupportAgentPresence({
                  ...agent,
                  online: isOnline,
                });
                const presenceMeta = PRESENCE_META[presence];
                const isCurrentUser = Boolean(user?.id && agent.id === user.id);
                return (
                <div
                  key={agent.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1.5"
                >
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      <span className={`h-2 w-2 rounded-full ${presenceMeta.dotClass}`} />
                      {agent.firstName} {agent.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{agent.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${presenceMeta.pillClass}`}
                    >
                      {presenceMeta.label}
                    </span>
                    {isCurrentUser ? (
                      <select
                        value={presence}
                        onChange={(event) =>
                          persistPresenceOverride(agent.id, normalizePresenceStatus(event.target.value) || 'AVAILABLE')
                        }
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-slate-700"
                        title="Set your availability"
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="BUSY">Busy</option>
                        <option value="DND">Do Not Disturb</option>
                        <option value="AWAY">Away</option>
                        <option value="OFFLINE">Offline</option>
                      </select>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        await assignMutation.mutateAsync(agent.id);
                      }}
                      disabled={!activeThreadId || assignMutation.isPending}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-500">Call Console</p>
              <span className="text-[11px] text-slate-500">{callQueue.length} queued</span>
            </div>
            <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
              {callQueue.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.phone || 'No phone saved'}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.status === 'DONE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'IN_PROGRESS'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.status === 'DONE' ? 'Done' : item.status === 'IN_PROGRESS' ? 'Calling' : 'Pending'}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCallStatus((prev) => ({ ...prev, [item.id]: 'IN_PROGRESS' }))}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      onClick={() => setCallStatus((prev) => ({ ...prev, [item.id]: 'DONE' }))}
                      className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => void startInAppCall(item.id, item.phone)}
                      disabled={!item.phone || voiceState === 'CONNECTING' || voiceState === 'IN_CALL'}
                      className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {voiceState === 'CONNECTING' && activeVoiceThreadId === item.id ? 'Connecting...' : 'Call in app'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void startTwilioPhoneCall(item.phone, item.id)}
                      disabled={!item.phone}
                      className="rounded-md border border-lime-300 bg-lime-200 px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Call
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Dial Pad</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={dialPadNumber}
                  onChange={(e) => setDialPadNumber(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={backspaceDialPad}
                  className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Del
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-y-2">
                {[
                  { digit: '1', letters: '' },
                  { digit: '2', letters: 'ABC' },
                  { digit: '3', letters: 'DEF' },
                  { digit: '4', letters: 'GHI' },
                  { digit: '5', letters: 'JKL' },
                  { digit: '6', letters: 'MNO' },
                  { digit: '7', letters: 'PQRS' },
                  { digit: '8', letters: 'TUV' },
                  { digit: '9', letters: 'WXYZ' },
                  { digit: '*', letters: '' },
                  { digit: '0', letters: '+' },
                  { digit: '#', letters: '' },
                ].map((entry) => (
                  <button
                    key={entry.digit}
                    type="button"
                    onClick={entry.digit === '0' ? clickZero : () => appendDialPadKey(entry)}
                    onMouseDown={entry.digit === '0' ? startZeroHold : undefined}
                    onMouseUp={entry.digit === '0' ? endZeroHold : undefined}
                    onMouseLeave={entry.digit === '0' ? endZeroHold : undefined}
                    onTouchStart={entry.digit === '0' ? startZeroHold : undefined}
                    onTouchEnd={entry.digit === '0' ? endZeroHold : undefined}
                    className="group flex flex-col items-center rounded-md py-1.5 text-center text-slate-700 transition hover:bg-primary-50/60"
                  >
                    <span className="text-sm font-semibold leading-none tracking-tight text-slate-700">
                      {entry.digit}
                    </span>
                    <span className="mt-0.5 min-h-[12px] text-[9px] font-semibold tracking-wide text-slate-400">
                      {entry.letters}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void startInAppCall(`manual-${Date.now()}`, dialPadSanitized)}
                  disabled={!dialPadValid || voiceState === 'CONNECTING' || voiceState === 'IN_CALL'}
                  className="flex-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Call in app
                </button>
                <button
                  type="button"
                  onClick={() => void startTwilioPhoneCall(dialPadSanitized)}
                  disabled={!dialPadValid}
                  className="flex-1 rounded-md border border-lime-300 bg-lime-200 px-2 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Call
                </button>
              </div>
              <a
                href={dialPadValid ? `tel:${dialPadSanitized}` : '#'}
                onClick={(e) => {
                  if (!dialPadValid) e.preventDefault();
                }}
                className={`mt-2 inline-block text-[11px] ${
                  dialPadValid ? 'text-slate-500 hover:text-slate-700' : 'pointer-events-none text-slate-400'
                }`}
              >
                Open phone dialer fallback
              </a>
            </div>
            {voiceState !== 'IDLE' || voiceError ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-600">
                {voiceError ? (
                  <span className="text-red-600">{voiceError}</span>
                ) : voiceState === 'CONNECTING' ? (
                  'Connecting in-app call...'
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span>In-app call active</span>
                    <button
                      type="button"
                      onClick={endInAppCall}
                      className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                    >
                      End call
                    </button>
                  </div>
                )}
              </div>
            ) : null}
            <p className="mt-2 text-[11px] text-slate-500">
              In-app call uses the configured calling provider. External call uses the backend calling service.
            </p>
            <div className="mt-3">
              <SupportVideoPanel
                roomName={`laflo-thread-${activeThreadId || 'live-support'}`}
                title="In-app video (current conversation)"
                compact
              />
            </div>
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase text-slate-500">Call notes</label>
              <textarea
                rows={3}
                value={callNotes[activeThreadId || ''] || ''}
                onChange={(event) =>
                  setCallNotes((prev) => ({ ...prev, [activeThreadId || '']: event.target.value }))
                }
                placeholder="Document call outcome and handoff notes..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-400">Media</p>
            </div>
            <div className="mt-2 rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
              No shared media yet for this conversation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
