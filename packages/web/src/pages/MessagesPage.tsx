import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { messageService } from '@/services';
import type { ConversationMessage, MessageThreadDetail, MessageThreadSummary } from '@/types';

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const formatDay = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const resolveSenderName = (message: ConversationMessage) => {
  if (message.senderType === 'GUEST' && message.guest) {
    return `${message.guest.firstName} ${message.guest.lastName}`;
  }
  if (message.senderUser) {
    return `${message.senderUser.firstName} ${message.senderUser.lastName}`;
  }
  return 'System';
};

const resolveThreadSubtitle = (thread: MessageThreadSummary) => {
  if (thread.guest) {
    return thread.guest.email ?? 'Guest message';
  }
  if (thread.booking) {
    return `Booking ${thread.booking.bookingRef}`;
  }
  return 'Guest message';
};

export default function MessagesPage() {
  const [search, setSearch] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const { data: threads, isLoading } = useQuery({
    queryKey: ['message-threads', search],
    queryFn: () => messageService.listThreads(search),
  });

  useEffect(() => {
    if (!activeThreadId && threads && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [activeThreadId, threads]);

  const activeThreadQuery = useQuery({
    queryKey: ['message-thread', activeThreadId],
    queryFn: () => messageService.getThread(activeThreadId as string),
    enabled: Boolean(activeThreadId),
  });

  const filteredThreads = useMemo(() => threads ?? [], [threads]);
  const activeThread = activeThreadQuery.data as MessageThreadDetail | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="mt-1 text-sm text-slate-500">
            Guest conversations, support follow-ups, and operational coordination.
          </p>
        </div>
        <div className="w-full sm:max-w-sm">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations..."
            className="input"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="card flex h-full flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Inbox</p>
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
              {filteredThreads.length} Threads
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 animate-shimmer rounded-xl" />
              ))}
            </div>
          ) : filteredThreads.length > 0 ? (
            <div className="space-y-2">
              {filteredThreads.map((thread) => {
                const isActive = activeThreadId === thread.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left transition ${
                      isActive
                        ? 'border-primary-200 bg-primary-50'
                        : 'border-slate-100 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{thread.subject}</p>
                      <span className="text-xs text-slate-500">{formatDay(thread.lastMessageAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{resolveThreadSubtitle(thread)}</p>
                    <p className="text-xs text-slate-600">
                      {thread.lastMessage ? thread.lastMessage.body : 'No messages yet'}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No messages yet.
            </div>
          )}
        </div>

        <div className="card flex min-h-[540px] flex-col">
          {activeThread ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{activeThread.subject}</p>
                  <p className="text-xs text-slate-500">
                    {activeThread.messages.length} messages - {activeThread.status}
                  </p>
                </div>
                {activeThread.booking ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {activeThread.booking.bookingRef}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-2">
                {activeThread.messages.map((message) => {
                  const senderName = resolveSenderName(message);
                  const isStaff = message.senderType === 'STAFF';
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isStaff ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isStaff ? (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                          {getInitials(senderName)}
                        </div>
                      ) : null}
                      <div
                        className={`max-w-[70%] rounded-2xl border px-4 py-3 ${
                          isStaff
                            ? 'border-primary-100 bg-white text-slate-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">{senderName}</p>
                          <span className="text-xs text-slate-400">{formatTime(message.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm">{message.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-400">
                    i
                  </span>
                  Messaging is read-only for now. Replies will be enabled once we connect live guest
                  channels.
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a conversation to view the details.
            </div>
          )}
        </div>

        <div className="card space-y-4">
          {activeThread ? (
            <>
              <div>
                <p className="text-sm font-semibold text-slate-900">Conversation details</p>
                <p className="text-xs text-slate-500">Guest profile and booking context.</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">Guest</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeThread.guest
                    ? `${activeThread.guest.firstName} ${activeThread.guest.lastName}`
                    : 'Unassigned'}
                </p>
                <p className="text-xs text-slate-500">
                  {activeThread.guest?.email ?? 'No email on file'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">Booking</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeThread.booking ? activeThread.booking.bookingRef : 'Not linked'}
                </p>
                {activeThread.booking ? (
                  <p className="text-xs text-slate-500">
                    {formatDateTime(activeThread.booking.checkInDate)} to{' '}
                    {formatDateTime(activeThread.booking.checkOutDate)}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">Last update</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(activeThread.lastMessageAt)}
                </p>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">
              Select a conversation to view guest details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
