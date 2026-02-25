import { useState, memo } from 'react';
import { PresenceDot } from '@/components/presence';

type PanelTab = 'guest' | 'ticket' | 'activity';

interface GuestInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  roomNumber?: string;
  checkIn?: string;
  checkOut?: string;
  vipStatus?: boolean;
  loyaltyTier?: string;
  preferences?: string[];
  avatarUrl?: string;
}

interface TicketInfo {
  id: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  slaDeadline?: string;
  slaBreached?: boolean;
}

interface ActivityItem {
  id: string;
  type: 'message' | 'call' | 'note' | 'status_change' | 'assignment';
  description: string;
  timestamp: string;
  actor: string;
}

interface SupportRightPanelProps {
  guest?: GuestInfo | null;
  ticket?: TicketInfo | null;
  activities?: ActivityItem[];
  onUpdateTicket?: (field: string, value: string) => void;
}

const tabs: { id: PanelTab; label: string }[] = [
  { id: 'guest', label: 'Guest' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'activity', label: 'Activity' },
];

const statusColors = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-700',
};

const priorityColors = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

/**
 * Guest Information Tab
 */
const GuestInfoTab = memo(function GuestInfoTab({ guest }: { guest?: GuestInfo | null }) {
  if (!guest) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400">
        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <p className="text-sm">No guest selected</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Guest Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          {guest.avatarUrl ? (
            <img
              src={guest.avatarUrl}
              alt={guest.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-semibold">
                {guest.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5">
            <PresenceDot status="AVAILABLE" size="sm" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{guest.name}</h3>
            {guest.vipStatus && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">
                VIP
              </span>
            )}
          </div>
          {guest.roomNumber && (
            <p className="text-xs text-slate-500">Room {guest.roomNumber}</p>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate">{guest.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{guest.phone}</span>
          </div>
        </div>
      </div>

      {/* Stay Info */}
      {(guest.checkIn || guest.checkOut) && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stay Details</h4>
          <div className="grid grid-cols-2 gap-2">
            {guest.checkIn && (
              <div className="p-2 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase">Check-in</p>
                <p className="text-sm font-medium text-slate-900">{guest.checkIn}</p>
              </div>
            )}
            {guest.checkOut && (
              <div className="p-2 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase">Check-out</p>
                <p className="text-sm font-medium text-slate-900">{guest.checkOut}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loyalty */}
      {guest.loyaltyTier && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loyalty</h4>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
              {guest.loyaltyTier}
            </span>
          </div>
        </div>
      )}

      {/* Preferences */}
      {guest.preferences && guest.preferences.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Preferences</h4>
          <div className="flex flex-wrap gap-1">
            {guest.preferences.map((pref, i) => (
              <span key={i} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                {pref}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Ticket Information Tab
 */
const TicketInfoTab = memo(function TicketInfoTab({
  ticket,
  onUpdate: _onUpdate,
}: {
  ticket?: TicketInfo | null;
  onUpdate?: (field: string, value: string) => void;
}) {
  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400">
        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No ticket selected</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Ticket ID and Subject */}
      <div className="space-y-1">
        <p className="text-xs text-slate-500">#{ticket.id}</p>
        <h3 className="text-sm font-semibold text-slate-900">{ticket.subject}</h3>
      </div>

      {/* Status and Priority */}
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[ticket.status]}`}>
          {ticket.status.replace('_', ' ')}
        </span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors[ticket.priority]}`}>
          {ticket.priority}
        </span>
      </div>

      {/* SLA Warning */}
      {ticket.slaDeadline && (
        <div className={`p-2.5 rounded-lg ${ticket.slaBreached ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 ${ticket.slaBreached ? 'text-red-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-xs font-medium ${ticket.slaBreached ? 'text-red-700' : 'text-amber-700'}`}>
              {ticket.slaBreached ? 'SLA Breached' : `SLA: ${formatDate(ticket.slaDeadline)}`}
            </span>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-slate-100">
          <span className="text-xs text-slate-500">Category</span>
          <span className="text-xs font-medium text-slate-900">{ticket.category}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-slate-100">
          <span className="text-xs text-slate-500">Assigned To</span>
          <span className="text-xs font-medium text-slate-900">{ticket.assignedTo || 'Unassigned'}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-slate-100">
          <span className="text-xs text-slate-500">Created</span>
          <span className="text-xs font-medium text-slate-900">{formatDate(ticket.createdAt)}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-xs text-slate-500">Updated</span>
          <span className="text-xs font-medium text-slate-900">{formatDate(ticket.updatedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-2">
        <button className="w-full px-3 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors">
          Resolve Ticket
        </button>
        <button className="w-full px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
          Reassign
        </button>
      </div>
    </div>
  );
});

/**
 * Activity Timeline Tab
 */
const ActivityTab = memo(function ActivityTab({ activities }: { activities?: ActivityItem[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400">
        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'message':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'call':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        );
      case 'note':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'status_change':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        );
      case 'assignment':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3.5 top-2 bottom-2 w-px bg-slate-200" />

        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="relative flex gap-3">
              {/* Icon */}
              <div className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400">
                {getActivityIcon(activity.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-sm text-slate-900">{activity.description}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-slate-500">{activity.actor}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-400">{formatTimestamp(activity.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/**
 * Combined Right Panel with Tabs
 */
export function SupportRightPanel({
  guest,
  ticket,
  activities,
  onUpdateTicket,
}: SupportRightPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('guest');

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-4 py-2.5 text-xs font-medium transition-colors
              border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'text-sky-600 border-sky-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'guest' && <GuestInfoTab guest={guest} />}
        {activeTab === 'ticket' && <TicketInfoTab ticket={ticket} onUpdate={onUpdateTicket} />}
        {activeTab === 'activity' && <ActivityTab activities={activities} />}
      </div>
    </div>
  );
}

export default SupportRightPanel;
