import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { messageService } from '@/services';
import { PAGE_TITLE_CLASS } from '@/styles/typography';
import type {
  ConversationMessage,
  MessageThreadDetail,
  MessageThreadSummary,
  SupportAgent,
} from '@/types';

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

const sanitizePhone = (value?: string) => (value || '').replace(/[^\d+]/g, '');

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [callStatus, setCallStatus] = useState<Record<string, 'PENDING' | 'IN_PROGRESS' | 'DONE'>>({});
  const [callNotes, setCallNotes] = useState<Record<string, string>>({});

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

  useEffect(() => {
    const run = () => {
      messageService.heartbeatSupportPresence().catch(() => {
        // ignore silent heartbeat errors
      });
    };
    run();
    const timer = setInterval(run, 30_000);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <div className="space-y-4">
      <h1 className={PAGE_TITLE_CLASS}>Messages</h1>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
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

        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
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
                const guestMsg = message.senderType === 'GUEST';
                const systemMsg = message.senderType === 'SYSTEM';
                const alignLeft = guestMsg || systemMsg;
                return (
                  <div key={message.id} className={`flex gap-2 ${alignLeft ? 'justify-start' : 'justify-end'}`}>
                    {alignLeft ? (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-200 text-xs font-bold text-slate-800">
                        {systemMsg ? 'AI' : getInitials(resolveSenderName(message))}
                      </div>
                    ) : null}
                    <div className="max-w-[72%]">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {systemMsg ? 'LaFlo Assistant' : resolveSenderName(message)}
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

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
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
                {supportAgentsQuery.data?.filter((a) => a.online).length || 0} online
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {(supportAgentsQuery.data || []).map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1.5"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {agent.firstName} {agent.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{agent.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        agent.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {agent.online ? 'Online' : 'Offline'}
                    </span>
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
              ))}
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
                    {item.phone ? (
                      <a
                        href={`tel:${item.phone}`}
                        className="rounded-md border border-lime-300 bg-lime-200 px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-lime-300"
                      >
                        Call
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
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
              <p className="text-xs font-semibold uppercase text-slate-400">Media (17)</p>
              <button className="text-xs font-semibold text-slate-500">Show All</button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {['/images/room-deluxe.jpg', '/images/room-standard.jpg', '/images/room-suite.jpg'].map((src, idx) => (
                <div key={idx} className="h-16 overflow-hidden rounded-lg bg-slate-100">
                  <img src={src} alt="media" className="h-full w-full object-cover" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
