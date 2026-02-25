import { memo, useEffect, useRef } from 'react';
import type { MessageThreadSummary } from '@/types';
import type { Ticket } from '@/services/tickets';

type ContextDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  thread: MessageThreadSummary | null;
  ticket: Ticket | null;
  onChargeGuest?: () => void;
};

const formatDate = (date?: string) =>
  date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const ContextDrawer = memo(function ContextDrawer({
  isOpen,
  onClose,
  thread,
  ticket,
  onChargeGuest,
}: ContextDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (drawerRef.current && !drawerRef.current.contains(target)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const guest = thread?.guest;
  const booking = thread?.booking;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40
          transition-opacity duration-200
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`
          fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Guest details"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Guest Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close drawer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Guest Profile */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Profile</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                <span className="text-lg font-semibold text-white">
                  {guest ? `${guest.firstName?.[0] || ''}${guest.lastName?.[0] || ''}` : '?'}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800">
                  {guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown Guest'}
                </p>
                <p className="text-sm text-slate-500">{guest?.email || '—'}</p>
                <p className="text-sm text-slate-500">{guest?.phone || '—'}</p>
              </div>
            </div>

            {/* VIP Status */}
            {(thread as any)?.isVip && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100">
                <svg className="h-4 w-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-medium text-amber-700">VIP Guest</span>
              </div>
            )}
          </section>

          {/* Current Booking */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Current Booking</h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Booking Ref</span>
                <span className="text-sm font-mono font-semibold text-slate-800">
                  {booking?.bookingRef || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Room</span>
                <span className="text-sm font-medium text-slate-700">
                  {(thread as any)?.roomNumber || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Room Status</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {(thread as any)?.roomStatus || 'Occupied'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Check-in</span>
                <span className="text-sm text-slate-700">{formatDate(booking?.checkInDate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Check-out</span>
                <span className="text-sm text-slate-700">{formatDate(booking?.checkOutDate)}</span>
              </div>
            </div>

            {/* Charge Guest Button */}
            {onChargeGuest && (
              <button
                type="button"
                onClick={onChargeGuest}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Charge Guest
              </button>
            )}
          </section>

          {/* Ticket History */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Ticket Info</h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Ticket ID</span>
                <span className="text-sm font-mono text-slate-700">
                  {ticket ? `#${ticket.id.slice(0, 8)}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Category</span>
                <span className="text-sm text-slate-700">{ticket?.category || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Created</span>
                <span className="text-sm text-slate-700">
                  {ticket?.createdAtUtc ? formatDate(ticket.createdAtUtc) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">First Response</span>
                <span className="text-sm text-slate-700">
                  {ticket?.firstResponseAtUtc ? formatDate(ticket.firstResponseAtUtc) : 'Pending'}
                </span>
              </div>
            </div>
          </section>

          {/* Guest Stats */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Guest History</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">—</p>
                <p className="text-xs text-slate-500 mt-1">Total Stays</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">—</p>
                <p className="text-xs text-slate-500 mt-1">Total Spend</p>
              </div>
            </div>
          </section>

          {/* Past Conversations */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Past Tickets</h3>
            <div className="space-y-2">
              <div className="text-center py-6 text-slate-400">
                <p className="text-sm">No previous tickets</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
});
