import { memo, useMemo } from 'react';
import type { MessageThreadSummary } from '@/types';
import type { Ticket } from '@/services/tickets';
import { getTimeRemaining, getEscalationBadge } from '@/services/tickets';
import { PresenceDot } from '@/components/presence';
import { usePresenceStore } from '@/stores/presenceStore';

type ConversationListProps = {
  threads: MessageThreadSummary[];
  ticketsByConversationId: Map<string, Ticket>;
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  activeTab: 'open' | 'assigned' | 'breach' | 'resolved';
  onTabChange: (tab: 'open' | 'assigned' | 'breach' | 'resolved') => void;
  currentUserId?: string;
};

const PRIORITY_DOTS: Record<string, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-sky-500',
  HIGH: 'bg-amber-500',
  CRITICAL: 'bg-red-500',
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const resolveThreadName = (thread: MessageThreadSummary) => {
  if (thread.guest) return `${thread.guest.firstName} ${thread.guest.lastName}`;
  return thread.subject || 'Guest';
};

export const ConversationList = memo(function ConversationList({
  threads,
  ticketsByConversationId,
  activeThreadId,
  onSelectThread,
  search,
  onSearchChange,
  activeTab,
  onTabChange,
  currentUserId,
}: ConversationListProps) {
  const { getEffectiveStatus } = usePresenceStore();

  // Filter threads based on active tab
  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      const ticket = ticketsByConversationId.get(thread.id);
      
      switch (activeTab) {
        case 'open':
          return !ticket || (ticket.status !== 'RESOLVED' && ticket.escalatedLevel === 0);
        case 'assigned':
          return ticket?.assignedToId === currentUserId;
        case 'breach':
          if (!ticket) return false;
          const isBreached = ticket.status === 'BREACHED' || 
            (ticket.responseDueAtUtc && !ticket.firstResponseAtUtc && new Date() > new Date(ticket.responseDueAtUtc));
          return isBreached || ticket.escalatedLevel > 0;
        case 'resolved':
          return ticket?.status === 'RESOLVED';
        default:
          return true;
      }
    });
  }, [threads, ticketsByConversationId, activeTab, currentUserId]);

  // Sort by SLA soonest first for open/breach tabs
  const sortedThreads = useMemo(() => {
    if (activeTab === 'resolved') {
      return [...filteredThreads].sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    }

    return [...filteredThreads].sort((a, b) => {
      const ticketA = ticketsByConversationId.get(a.id);
      const ticketB = ticketsByConversationId.get(b.id);
      
      // Escalated items first
      const escA = ticketA?.escalatedLevel || 0;
      const escB = ticketB?.escalatedLevel || 0;
      if (escA !== escB) return escB - escA;

      // Then by SLA due time (soonest first)
      const dueA = ticketA?.responseDueAtUtc ? new Date(ticketA.responseDueAtUtc).getTime() : Infinity;
      const dueB = ticketB?.responseDueAtUtc ? new Date(ticketB.responseDueAtUtc).getTime() : Infinity;
      if (dueA !== dueB) return dueA - dueB;

      // Finally by last message
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [filteredThreads, ticketsByConversationId, activeTab]);

  // Search filter
  const displayedThreads = useMemo(() => {
    if (!search.trim()) return sortedThreads;
    const q = search.toLowerCase();
    return sortedThreads.filter(thread => {
      const name = resolveThreadName(thread).toLowerCase();
      const subject = (thread.subject || '').toLowerCase();
      return name.includes(q) || subject.includes(q);
    });
  }, [sortedThreads, search]);

  const tabs = [
    { id: 'open' as const, label: 'Open', count: threads.filter(t => {
      const ticket = ticketsByConversationId.get(t.id);
      return !ticket || (ticket.status !== 'RESOLVED' && ticket.escalatedLevel === 0);
    }).length },
    { id: 'assigned' as const, label: 'Assigned', count: threads.filter(t => 
      ticketsByConversationId.get(t.id)?.assignedToId === currentUserId
    ).length },
    { id: 'breach' as const, label: 'SLA Breach', count: threads.filter(t => {
      const ticket = ticketsByConversationId.get(t.id);
      if (!ticket) return false;
      return ticket.status === 'BREACHED' || ticket.escalatedLevel > 0 ||
        (ticket.responseDueAtUtc && !ticket.firstResponseAtUtc && new Date() > new Date(ticket.responseDueAtUtc));
    }).length },
    { id: 'resolved' as const, label: 'Resolved', count: threads.filter(t => 
      ticketsByConversationId.get(t.id)?.status === 'RESOLVED'
    ).length },
  ];

  return (
    <div className="flex flex-col h-full w-80 bg-white border-r border-slate-200 shrink-0">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 px-2 py-3 text-xs font-medium transition-colors relative
              ${activeTab === tab.id 
                ? 'text-slate-800' 
                : 'text-slate-500 hover:text-slate-700'
              }
            `}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`
                ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold
                ${activeTab === tab.id 
                  ? 'bg-slate-800 text-white' 
                  : tab.id === 'breach' && tab.count > 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-600'
                }
              `}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800" />
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {displayedThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No conversations</p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Try a different search' : 'All caught up!'}
            </p>
          </div>
        ) : (
          displayedThreads.map((thread) => {
            const ticket = ticketsByConversationId.get(thread.id);
            const isActive = thread.id === activeThreadId;
            const slaInfo = ticket ? getTimeRemaining(ticket) : null;
            const escalationInfo = ticket ? getEscalationBadge(ticket) : null;
            const priorityDot = PRIORITY_DOTS[ticket?.priority || 'MEDIUM'];
            const hasUnread = Boolean(thread.lastMessage && thread.lastMessage.senderType === 'GUEST');
            // Get presence status for the assigned support agent (if any)
            const assignedUserId = ticket?.assignedToId;
            const agentPresence = assignedUserId ? getEffectiveStatus(assignedUserId, false) : null;

            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelectThread(thread.id)}
                className={`
                  w-full px-4 py-3 text-left transition-all
                  border-b border-slate-100
                  ${isActive 
                    ? 'bg-slate-50' 
                    : 'hover:bg-slate-50/50'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar with priority indicator and presence dot */}
                  <div className="relative shrink-0">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                      ${isActive ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'}
                    `}>
                      {getInitials(resolveThreadName(thread))}
                    </div>
                    {/* Priority indicator on bottom-right */}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${priorityDot}`} />
                    {/* Presence dot for assigned agent (top-right) */}
                    {agentPresence && (
                      <div className="absolute -top-0.5 -right-0.5">
                        <PresenceDot status={agentPresence} size="xs" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                        {resolveThreadName(thread)}
                      </span>
                      {hasUnread && (
                        <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                      )}
                    </div>

                    {/* Last message preview */}
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {thread.lastMessage?.body || 'No messages yet'}
                    </p>

                    {/* SLA and escalation badges */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {slaInfo && (
                        <span className={`
                          inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
                          ${slaInfo.isOverdue ? 'bg-red-100 text-red-700' : slaInfo.minutes < 30 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}
                        `}>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {slaInfo.isOverdue ? 'Overdue' : slaInfo.display}
                        </span>
                      )}
                      {escalationInfo && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-medium">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          {escalationInfo.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(thread.lastMessageAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});
