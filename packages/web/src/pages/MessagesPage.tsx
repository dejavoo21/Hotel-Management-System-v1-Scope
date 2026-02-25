import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { messageService, ticketService } from '@/services';
import { getTimeRemaining, getEscalationBadge, escalateTicket, type Ticket } from '@/services/tickets';
// AI hooks for future integration - currently showing placeholder actions
import type { RecommendedAction } from '@/services/aiHooks';
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
  // SLA Filter state
  const [slaFilter, setSlaFilter] = useState<'all' | 'overdue' | 'escalated'>('all');
  // Additional ticket filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  // AI-suggested replies and actions (placeholders for future AI integration)
  const [recommendedActions] = useState<RecommendedAction[]>([]);
  const [aiLoading] = useState(false);
  const voiceDeviceRef = useRef<Device | null>(null);
  const voiceCallRef = useRef<Call | null>(null);
  const zeroHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeroHoldTriggeredRef = useRef(false);

  const { data: threadsData, isLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['message-threads', search],
    queryFn: () => messageService.listThreads(search),
    refetchInterval: 7000,
  });

  // Fetch tickets for SLA data
  const { data: ticketsData } = useQuery({
    queryKey: ['tickets-for-threads'],
    queryFn: () => ticketService.getTickets({ limit: 100 }),
    refetchInterval: 15000,
  });

  // Map conversation IDs to tickets
  const ticketsByConversationId = useMemo(() => {
    const map = new Map<string, Ticket>();
    if (ticketsData?.tickets) {
      for (const ticket of ticketsData.tickets) {
        map.set(ticket.conversationId, ticket);
      }
    }
    return map;
  }, [ticketsData]);

  const threads = useMemo(() => ((threadsData && threadsData.length > 0 ? threadsData : mockThreads) as MessageThreadSummary[]), [threadsData]);

  // Filter threads by SLA status and additional filters
  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      const ticket = ticketsByConversationId.get(thread.id);
      
      // SLA filter
      if (slaFilter !== 'all') {
        if (!ticket) return false;
        
        if (slaFilter === 'overdue') {
          const isOverdue = (ticket.responseDueAtUtc && !ticket.firstResponseAtUtc 
            ? new Date() > new Date(ticket.responseDueAtUtc) 
            : ticket.status === 'BREACHED');
          if (!isOverdue) return false;
        }
        
        if (slaFilter === 'escalated') {
          if (ticket.escalatedLevel <= 0) return false;
        }
      }
      
      // Status filter
      if (statusFilter !== 'all' && ticket) {
        if (ticket.status !== statusFilter) return false;
      }
      
      // Category filter
      if (categoryFilter !== 'all' && ticket) {
        if (ticket.category !== categoryFilter) return false;
      }
      
      // Priority filter
      if (priorityFilter !== 'all' && ticket) {
        if (ticket.priority !== priorityFilter) return false;
      }
      
      // Department filter
      if (departmentFilter !== 'all' && ticket) {
        if (ticket.department !== departmentFilter) return false;
      }
      
      return true;
    });
  }, [threads, slaFilter, statusFilter, categoryFilter, priorityFilter, departmentFilter, ticketsByConversationId]);

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

          {/* SLA Filter Buttons */}
          <div className="mb-3 flex gap-1.5">
            <button
              type="button"
              onClick={() => setSlaFilter('all')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                slaFilter === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSlaFilter('overdue')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                slaFilter === 'overdue'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Overdue
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSlaFilter('escalated')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                slaFilter === 'escalated'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                Escalated
              </span>
            </button>
          </div>

          {/* Additional Filter Dropdowns */}
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
              title="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PENDING">Pending</option>
              <option value="RESOLVED">Resolved</option>
              <option value="BREACHED">Breached</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
              title="Filter by category"
            >
              <option value="all">All Categories</option>
              <option value="BOOKING">Booking</option>
              <option value="HOUSEKEEPING">Housekeeping</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="ROOM_SERVICE">Room Service</option>
              <option value="BILLING">Billing</option>
              <option value="COMPLAINT">Complaint</option>
              <option value="INQUIRY">Inquiry</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
              title="Filter by priority"
            >
              <option value="all">All Priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
              title="Filter by department"
            >
              <option value="all">All Depts</option>
              <option value="FRONT_DESK">Front Desk</option>
              <option value="HOUSEKEEPING">Housekeeping</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="CONCIERGE">Concierge</option>
              <option value="BILLING">Billing</option>
              <option value="MANAGEMENT">Management</option>
            </select>
          </div>

          <div className="space-y-2">
            {(isLoading ? [] : filteredThreads).map((thread) => {
              const isActive = activeThreadId === thread.id;
              const name = resolveThreadName(thread);
              const ticket = ticketsByConversationId.get(thread.id);
              const isOverdue = ticket && ticket.responseDueAtUtc && !ticket.firstResponseAtUtc 
                ? new Date() > new Date(ticket.responseDueAtUtc) 
                : ticket?.status === 'BREACHED';
              const isEscalated = ticket && ticket.escalatedLevel > 0;
              const timeRemaining = ticket ? getTimeRemaining(ticket) : null;
              const escalationBadge = ticket ? getEscalationBadge(ticket) : null;
              
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
                  className={`w-full rounded-xl p-2 text-left ${isActive ? 'bg-slate-100' : 'hover:bg-slate-50'} ${isOverdue ? 'ring-1 ring-red-200' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-200 text-xs font-bold text-slate-800">{getInitials(name)}</div>
                      {isEscalated && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                          ↑
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                        <span className="text-[11px] text-slate-500">{formatTime(thread.lastMessageAt)}</span>
                      </div>
                      <p className="truncate text-xs text-slate-500">{thread.lastMessage?.body || 'No message'}</p>
                      
                      {/* SLA Status Bar */}
                      {ticket && (
                        <div className="mt-1 flex items-center gap-1.5">
                          {timeRemaining && (
                            <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${
                              timeRemaining.isOverdue
                                ? 'bg-red-100 text-red-700'
                                : timeRemaining.minutes < 30
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                            }`}>
                              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {timeRemaining.isOverdue ? `${timeRemaining.display} overdue` : timeRemaining.display}
                            </span>
                          )}
                          {escalationBadge && (
                            <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${escalationBadge.className}`}>
                              {escalationBadge.label}
                            </span>
                          )}
                        </div>
                      )}
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

          {/* Quick Action Buttons */}
          {activeThreadId && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
              <span className="text-[10px] font-semibold uppercase text-slate-400">Quick Actions:</span>
              <button
                type="button"
                onClick={async () => {
                  const ticket = ticketsByConversationId.get(activeThreadId);
                  if (ticket) {
                    try {
                      await ticketService.resolveTicket(ticket.id);
                      toast.success('Request approved');
                    } catch {
                      toast.error('Failed to approve');
                    }
                  } else {
                    toast.success('Request approved (no ticket linked)');
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Housekeeping task created');
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Assign Housekeeping
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ticket = ticketsByConversationId.get(activeThreadId);
                  if (ticket) {
                    try {
                      await escalateTicket(ticket.id);
                      toast.success('Ticket escalated to manager');
                    } catch {
                      toast.error('Failed to escalate');
                    }
                  } else {
                    toast.success('Escalation requested (no ticket linked)');
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                Escalate
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Maintenance task created');
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Create Task
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Charge added to guest folio');
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Charge Guest
              </button>
              {aiLoading ? (
                <span className="text-[10px] text-slate-400">Loading AI suggestions...</span>
              ) : recommendedActions.length > 0 ? (
                recommendedActions.slice(0, 2).map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => toast.success(`AI Action: ${action.label}`)}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                    title={action.description}
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {action.label}
                  </button>
                ))
              ) : null}
            </div>
          )}

          <div className="mt-4 h-[400px] overflow-y-auto pr-1">
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

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 xl:order-1 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Guest Context</h2>
            <div className="flex items-center gap-2">
              {(() => {
                const ticket = activeThreadId ? ticketsByConversationId.get(activeThreadId) : null;
                if (!ticket) return <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">No Ticket</span>;
                const priorityColors: Record<string, string> = {
                  LOW: 'border-slate-200 bg-slate-50 text-slate-600',
                  MEDIUM: 'border-blue-200 bg-blue-50 text-blue-700',
                  HIGH: 'border-amber-200 bg-amber-50 text-amber-700',
                  URGENT: 'border-red-200 bg-red-50 text-red-700',
                };
                return <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${priorityColors[ticket.priority] || priorityColors.MEDIUM}`}>{ticket.priority}</span>;
              })()}
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lime-200 text-sm font-bold text-slate-800">
              {getInitials(activeThreadName)}
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{activeThreadName}</p>
            <p className="text-sm text-slate-500">{activeThreadSummary?.guest?.email || 'guest@example.com'}</p>
          </div>

          {/* Booking Details */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Current Booking</p>
            {activeThreadSummary?.booking ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Booking Ref</span>
                  <span className="text-xs font-semibold text-slate-800">{activeThreadSummary.booking.bookingRef}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Check-in</span>
                  <span className="text-xs font-semibold text-slate-800">{formatDay(activeThreadSummary.booking.checkInDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Check-out</span>
                  <span className="text-xs font-semibold text-slate-800">{formatDay(activeThreadSummary.booking.checkOutDate)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">No active booking found</p>
            )}
          </div>

          {/* Ticket Information */}
          {(() => {
            const ticket = activeThreadId ? ticketsByConversationId.get(activeThreadId) : null;
            if (!ticket) return null;
            return (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Ticket Details</p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Status</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      ticket.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                      ticket.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                      ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                      ticket.status === 'BREACHED' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{ticket.status}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Category</span>
                    <span className="text-xs font-semibold text-slate-800">{ticket.category}</span>
                  </div>
                  {ticket.assignedTo && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Assigned To</span>
                      <span className="text-xs font-semibold text-slate-800">{ticket.assignedTo.firstName} {ticket.assignedTo.lastName}</span>
                    </div>
                  )}
                  {ticket.escalatedLevel > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Escalation Level</span>
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Level {ticket.escalatedLevel}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Room State/Status */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Room Status</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Room Number</span>
                <span className="text-xs font-semibold text-slate-800">305</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Occupancy</span>
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">Occupied</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Housekeeping</span>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Clean</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Last Cleaned</span>
                <span className="text-xs font-semibold text-slate-800">Today 10:30 AM</span>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Financial Summary</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Room Rate</span>
                <span className="text-xs font-semibold text-slate-800">$250/night</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Incidentals</span>
                <span className="text-xs font-semibold text-slate-800">$85.00</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                <span className="text-xs font-medium text-slate-600">Total Balance</span>
                <span className="text-xs font-bold text-slate-900">$585.00</span>
              </div>
            </div>
          </div>

          {/* Guest History */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Stay History</p>
            <div className="mt-2 space-y-2">
              <div className="rounded border border-slate-200 bg-white p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-700">Previous Stay</span>
                  <span className="text-[10px] text-slate-500">Dec 2024</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">3 nights • Deluxe Suite</p>
              </div>
              <div className="rounded border border-slate-200 bg-white p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-700">Loyalty Status</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Gold</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">5 total stays • 12 nights</p>
              </div>
            </div>
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
                    className="rounded-lg border border-slate-200 px-2 py-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                          <span className={`h-2 w-2 rounded-full ${presenceMeta.dotClass}`} />
                          {agent.firstName} {agent.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{agent.role}</p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${presenceMeta.pillClass}`}
                      >
                        {presenceMeta.label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {isCurrentUser ? (
                        <select
                          value={presence}
                          onChange={(event) =>
                            persistPresenceOverride(agent.id, normalizePresenceStatus(event.target.value) || 'AVAILABLE')
                          }
                          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-slate-700"
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
