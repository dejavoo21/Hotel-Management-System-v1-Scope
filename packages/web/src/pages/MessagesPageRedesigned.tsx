import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { messageService, ticketService } from '@/services';
import { escalateTicket, type Ticket } from '@/services/tickets';
import { useAuthStore } from '@/stores/authStore';
import { ConversationList } from '@/components/support/ConversationList';
import { TicketMetaBar } from '@/components/support/TicketMetaBar';
import { SupportLayout } from '@/components/support/SupportLayout';
import { SupportRightPanel } from '@/components/support/SupportRightPanel';
import type {
  ConversationMessage,
  MessageThreadDetail,
  MessageThreadSummary,
  SupportAgent,
} from '@/types';

type SupportRailItem = 'activity' | 'chat' | 'calls' | 'files';
type PresenceStatus = 'AVAILABLE' | 'BUSY' | 'DND' | 'AWAY' | 'OFFLINE';

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

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

const sanitizePhone = (value?: string) => {
  const input = (value || '').toUpperCase();
  let output = '';
  const LETTER_TO_DIGIT: Record<string, string> = {
    A: '2', B: '2', C: '2', D: '3', E: '3', F: '3', G: '4', H: '4', I: '4',
    J: '5', K: '5', L: '5', M: '6', N: '6', O: '6', P: '7', Q: '7', R: '7', S: '7',
    T: '8', U: '8', V: '8', W: '9', X: '9', Y: '9', Z: '9',
  };
  for (const ch of input) {
    if (/\d/.test(ch)) { output += ch; continue; }
    if (ch === '+' && output.length === 0) { output += ch; continue; }
    if (LETTER_TO_DIGIT[ch]) { output += LETTER_TO_DIGIT[ch]; }
  }
  return output;
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

export default function MessagesPageRedesigned() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'open' | 'assigned' | 'breach' | 'resolved'>('open');
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [activeRailItem, setActiveRailItem] = useState<SupportRailItem>('chat');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Data Fetching
  const { data: threadsData, refetch: refetchThreads } = useQuery({
    queryKey: ['message-threads', search],
    queryFn: () => messageService.listThreads(search),
    refetchInterval: 7000,
  });

  const { data: ticketsData } = useQuery({
    queryKey: ['tickets-for-threads'],
    queryFn: () => ticketService.getTickets({ limit: 100 }),
    refetchInterval: 15000,
  });

  const ticketsByConversationId = useMemo(() => {
    const map = new Map<string, Ticket>();
    if (ticketsData?.tickets) {
      for (const ticket of ticketsData.tickets) {
        map.set(ticket.conversationId, ticket);
      }
    }
    return map;
  }, [ticketsData]);

  const threads = useMemo(() => (
    (threadsData && threadsData.length > 0 ? threadsData : mockThreads) as MessageThreadSummary[]
  ), [threadsData]);

  const supportAgentsQuery = useQuery<SupportAgent[]>({
    queryKey: ['support-agents'],
    queryFn: () => messageService.listSupportAgents(),
    refetchInterval: 10_000,
  });

  const resolveSupportAgentPresence = (agent: SupportAgent): PresenceStatus => {
    const isCurrentUser = Boolean(user?.id && agent.id === user.id);
    return (agent.online || isCurrentUser) ? 'AVAILABLE' : 'OFFLINE';
  };

  // Set active thread on load
  useEffect(() => {
    const requestedThreadId = searchParams.get('thread');
    if (requestedThreadId) {
      setActiveThreadId(requestedThreadId);
      return;
    }
    if (!activeThreadId && threads.length > 0) setActiveThreadId(threads[0].id);
  }, [activeThreadId, threads, searchParams]);

  // Thread Detail Query
  const activeThreadQuery = useQuery<MessageThreadDetail>({
    queryKey: ['message-thread', activeThreadId],
    queryFn: () => messageService.getThread(activeThreadId as string),
    enabled: Boolean(activeThreadId),
    refetchInterval: 4000,
  });

  const activeThread = activeThreadQuery.data;
  const activeThreadSummary = threads.find((t) => t.id === activeThreadId);
  const activeThreadName = activeThreadSummary
    ? resolveThreadName(activeThreadSummary)
    : activeThread?.subject || 'Support';
  const activeMessages = useMemo(() => {
    if (activeThread && activeThread.messages.length > 0) return activeThread.messages;
    return mockMessages;
  }, [activeThread]);
  const activeTicket = activeThreadId ? ticketsByConversationId.get(activeThreadId) : null;

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  // Mutations
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

  const resolveTicketMutation = useMutation({
    mutationFn: async () => {
      if (!activeTicket?.id) return;
      await ticketService.updateTicket(activeTicket.id, { status: 'RESOLVED' });
    },
    onSuccess: async () => {
      toast.success('Ticket resolved');
      await Promise.all([activeThreadQuery.refetch(), refetchThreads()]);
    },
  });

  const escalateTicketMutation = useMutation({
    mutationFn: async () => {
      if (!activeTicket?.id) return;
      await escalateTicket(activeTicket.id);
    },
    onSuccess: async () => {
      toast.success('Ticket escalated');
      await Promise.all([activeThreadQuery.refetch(), refetchThreads()]);
    },
  });

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setSearchParams({ thread: threadId });
  };

  const handleRailItemChange = useCallback((item: SupportRailItem) => {
    setActiveRailItem(item);
    // Future: Handle switching between Activity, Chat, Calls, Files views
    if (item !== 'chat') {
      toast(`${item.charAt(0).toUpperCase() + item.slice(1)} view coming soon`);
    }
  }, []);

  // Transform thread/ticket data for right panel
  const rightPanelGuest = useMemo(() => {
    if (!activeThreadSummary?.guest) return null;
    const guest = activeThreadSummary.guest;
    return {
      id: activeThreadSummary.id,
      name: `${guest.firstName} ${guest.lastName}`,
      email: guest.email || '',
      phone: guest.phone || '',
      roomNumber: activeThreadSummary.booking?.bookingRef?.replace('BK-', ''),
      checkIn: activeThreadSummary.booking?.checkInDate 
        ? new Date(activeThreadSummary.booking.checkInDate).toLocaleDateString() 
        : undefined,
      checkOut: activeThreadSummary.booking?.checkOutDate 
        ? new Date(activeThreadSummary.booking.checkOutDate).toLocaleDateString() 
        : undefined,
    };
  }, [activeThreadSummary]);

  const rightPanelTicket = useMemo(() => {
    if (!activeTicket) return null;
    return {
      id: activeTicket.id,
      status: (activeTicket.status?.toLowerCase() || 'open') as 'open' | 'in_progress' | 'resolved' | 'closed',
      priority: (activeTicket.priority?.toLowerCase() || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
      category: activeTicket.category || 'General',
      subject: activeTicket.conversation?.subject || activeThreadSummary?.subject || 'Support Request',
      createdAt: activeTicket.createdAtUtc,
      updatedAt: activeTicket.updatedAtUtc,
      assignedTo: activeThread?.assignedSupport 
        ? `${activeThread.assignedSupport.firstName} ${activeThread.assignedSupport.lastName}` 
        : activeTicket.assignedTo 
          ? `${activeTicket.assignedTo.firstName} ${activeTicket.assignedTo.lastName}`
          : undefined,
      slaDeadline: activeTicket.responseDueAtUtc || activeTicket.resolutionDueAtUtc,
      slaBreached: activeTicket.status === 'BREACHED',
    };
  }, [activeTicket, activeThread, activeThreadSummary]);

  const rightPanelActivities = useMemo(() => {
    // Transform messages to activity items
    return activeMessages.slice(-10).map((msg) => ({
      id: msg.id,
      type: 'message' as const,
      description: msg.body.length > 50 ? msg.body.slice(0, 50) + '...' : msg.body,
      timestamp: msg.createdAt,
      actor: resolveSenderName(msg),
    }));
  }, [activeMessages]);

  // Simple phone call via backend
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

  return (
    <SupportLayout
      activeRailItem={activeRailItem}
      onRailItemChange={handleRailItemChange}
      rightPanelOpen={showRightPanel}
      rightPanelTitle="Details"
      onRightPanelClose={() => setShowRightPanel(false)}
      rightPanelContent={
        <SupportRightPanel
          guest={rightPanelGuest}
          ticket={rightPanelTicket}
          activities={rightPanelActivities}
        />
      }
    >
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Support</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {threads.length} conversations • {ticketsByConversationId.size} tickets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {supportAgentsQuery.data?.filter((a) => resolveSupportAgentPresence(a) !== 'OFFLINE').length || 0} agents online
            </span>
            <button
              type="button"
              onClick={() => setShowRightPanel(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Guest Info
            </button>
          </div>
        </header>

        {/* Ticket Meta Bar */}
        <TicketMetaBar
          ticket={activeTicket}
          assignedTo={activeThread?.assignedSupport?.firstName 
            ? `${activeThread.assignedSupport.firstName} ${activeThread.assignedSupport.lastName}` 
            : undefined}
          onAssign={() => assignMutation.mutate(user?.id)}
          onMarkResolved={() => resolveTicketMutation.mutate()}
          onEscalate={() => escalateTicketMutation.mutate()}
          onViewDetails={() => setShowRightPanel(true)}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
        {/* Left: Conversation List */}
        <ConversationList
          threads={threads}
          ticketsByConversationId={ticketsByConversationId}
          activeThreadId={activeThreadId}
          onSelectThread={handleSelectThread}
          search={search}
          onSearchChange={setSearch}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUserId={user?.id}
        />

        {/* Center: Chat Panel */}
        <main className="flex-1 flex flex-col bg-slate-50 min-w-0">
          {activeThreadId ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">
                      {getInitials(activeThreadName)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{activeThreadName}</h2>
                    <p className="text-xs text-slate-500">
                      {activeThreadSummary?.guest?.email || 'Guest'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Video Call Button */}
                  <button
                    type="button"
                    onClick={() => toast.success('Video call feature coming soon')}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Start video call"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {/* Screen Share Button */}
                  <button
                    type="button"
                    onClick={() => toast.success('Screen share feature coming soon')}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Share screen"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {/* Phone Call Button */}
                  <button
                    type="button"
                    onClick={() => startTwilioPhoneCall(resolveThreadPhone(activeThreadSummary), activeThreadId)}
                    disabled={!resolveThreadPhone(activeThreadSummary)}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    title="Call guest"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                  {/* Guest Info Button */}
                  <button
                    type="button"
                    onClick={() => setShowRightPanel(true)}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="View guest details"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {activeMessages.map((message) => {
                  const isGuest = message.senderType === 'GUEST';
                  const senderName = resolveSenderName(message);
                  const avatar = message.senderUser?.id 
                    ? getStoredAvatarByUserId(message.senderUser.id) 
                    : null;
                    
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isGuest ? '' : 'flex-row-reverse'}`}
                    >
                      {/* Avatar */}
                      <div className={`
                        w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center
                        ${isGuest ? 'bg-slate-200' : 'bg-sky-600'}
                      `}>
                        {avatar ? (
                          <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <span className={`text-xs font-semibold ${isGuest ? 'text-slate-600' : 'text-white'}`}>
                            {getInitials(senderName)}
                          </span>
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div className={`max-w-[70%] ${isGuest ? '' : 'text-right'}`}>
                        <div className={`
                          inline-block px-4 py-2.5 rounded-2xl text-sm
                          ${isGuest 
                            ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-md' 
                            : 'bg-sky-600 text-white rounded-tr-md'
                          }
                        `}>
                          {message.body}
                        </div>
                        <div className={`
                          mt-1 flex items-center gap-2 text-[11px] text-slate-400
                          ${isGuest ? '' : 'justify-end'}
                        `}>
                          <span>{senderName}</span>
                          <span>•</span>
                          <span>{formatTime(message.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Actions */}
              <div className="px-5 py-2 bg-white border-t border-slate-100 shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => toast.success('Action: Approve request')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.success('Action: Assign housekeeping')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Housekeeping
                  </button>
                  <button
                    type="button"
                    onClick={() => escalateTicketMutation.mutate()}
                    disabled={escalateTicketMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Escalate
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.success('Task created')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Create Task
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.success('Opening charge dialog')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Charge Guest
                  </button>
                </div>
              </div>

              {/* Message Input */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!activeThreadId || !draftMessage.trim() || sendMessageMutation.isPending) return;
                  await sendMessageMutation.mutateAsync();
                }}
                className="px-5 py-4 bg-white border-t border-slate-200 shrink-0"
              >
                <div className="flex gap-3">
                  <input
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!activeThreadId || !draftMessage.trim() || sendMessageMutation.isPending}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">Select a conversation to start</p>
              </div>
            </div>
          )}
        </main>
      </div>
      </div>
    </SupportLayout>
  );
}
