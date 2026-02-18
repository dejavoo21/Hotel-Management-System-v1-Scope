import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarService } from '@/services';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { appendAuditLog } from '@/utils/auditLog';
import { PAGE_TITLE_CLASS } from '@/styles/typography';

type CalendarType = 'BOOKING' | 'HOUSEKEEPING' | 'MAINTENANCE' | 'EVENT' | 'OTHER';

const categories: { type: CalendarType; label: string; color: string; dot: string }[] = [
  { type: 'BOOKING', label: 'Guest Service', color: 'bg-emerald-100 text-emerald-900', dot: 'bg-emerald-500' },
  { type: 'HOUSEKEEPING', label: 'Housekeeping', color: 'bg-sky-100 text-sky-900', dot: 'bg-sky-500' },
  { type: 'MAINTENANCE', label: 'Maintenance', color: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' },
  { type: 'EVENT', label: 'Event', color: 'bg-lime-100 text-lime-900', dot: 'bg-lime-500' },
  { type: 'OTHER', label: 'Other', color: 'bg-slate-100 text-slate-900', dot: 'bg-slate-400' },
];

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfMonth(date: Date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return startOfDay(new Date(d.setDate(diff)));
}

function endOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + 6;
  return endOfDay(new Date(d.setDate(diff)));
}

function buildCalendarDays(month: Date) {
  const start = startOfMonth(month);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<CalendarType[]>(() =>
    categories.map((category) => category.type)
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [draftSchedule, setDraftSchedule] = useState({
    title: '',
    type: 'BOOKING' as CalendarType,
    startAt: '',
    endAt: '',
    notes: '',
  });

  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const createMutation = useMutation({
    mutationFn: () =>
      calendarService.create({
        title: draftSchedule.title.trim(),
        type: draftSchedule.type,
        status: 'SCHEDULED',
        startAt: new Date(draftSchedule.startAt).toISOString(),
        endAt: new Date(draftSchedule.endAt).toISOString(),
        notes: draftSchedule.notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Schedule created');
      appendAuditLog({
        action: 'SCHEDULE_CREATED',
        actorId: currentUser?.id,
        actorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
        targetLabel: draftSchedule.title,
        details: {
          type: draftSchedule.type,
          startAt: draftSchedule.startAt,
          endAt: draftSchedule.endAt,
        },
      });
      setShowCreateModal(false);
      setDraftSchedule({ title: '', type: 'BOOKING', startAt: '', endAt: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to create schedule';
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      calendarService.update(selectedEvent.id, {
        title: draftSchedule.title.trim(),
        type: draftSchedule.type,
        startAt: new Date(draftSchedule.startAt).toISOString(),
        endAt: new Date(draftSchedule.endAt).toISOString(),
        notes: draftSchedule.notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Schedule updated');
      appendAuditLog({
        action: 'SCHEDULE_UPDATED',
        actorId: currentUser?.id,
        actorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
        targetLabel: draftSchedule.title,
        details: {
          type: draftSchedule.type,
          startAt: draftSchedule.startAt,
          endAt: draftSchedule.endAt,
        },
      });
      setShowEditModal(false);
      setSelectedEvent(null);
      setDraftSchedule({ title: '', type: 'BOOKING', startAt: '', endAt: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to update schedule';
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => calendarService.remove(selectedEvent.id),
    onSuccess: () => {
      toast.success('Schedule deleted');
      setShowEditModal(false);
      setSelectedEvent(null);
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to delete schedule';
      toast.error(errorMessage);
    },
  });

  const today = new Date();
  
  // Calculate range based on viewMode
  let rangeStart: Date;
  let rangeEnd: Date;

  if (viewMode === 'month') {
    rangeStart = startOfMonth(currentMonth);
    rangeEnd = endOfMonth(currentMonth);
  } else if (viewMode === 'week') {
    rangeStart = startOfWeek(selectedDate);
    rangeEnd = endOfWeek(selectedDate);
  } else {
    // day view
    rangeStart = startOfDay(selectedDate);
    rangeEnd = endOfDay(selectedDate);
  }

  const rangeStartISO = rangeStart.toISOString();
  const rangeEndISO = rangeEnd.toISOString();

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar', rangeStartISO, rangeEndISO, viewMode],
    queryFn: () =>
      calendarService.list({
        startDate: rangeStartISO,
        endDate: rangeEndISO,
      }),
  });

  const filteredEvents = useMemo(() => {
    if (!events) {
      return [];
    }
    return events.filter((event) => {
      const matchesType = selectedTypes.includes(event.type as CalendarType);
      const matchesSearch =
        search.trim().length === 0 ||
        event.title.toLowerCase().includes(search.toLowerCase()) ||
        event.room?.number?.toLowerCase().includes(search.toLowerCase()) ||
        event.booking?.bookingRef?.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [events, search, selectedTypes]);

  const eventsByDay = useMemo(() => {
    return filteredEvents.reduce<Record<string, typeof filteredEvents>>((acc, event) => {
      const key = toKey(new Date(event.startAt));
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(event);
      return acc;
    }, {});
  }, [filteredEvents]);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const monthLabel = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const todayKey = toKey(today);

  const dayEvents = useMemo(() => {
    const key = toKey(selectedDate);
    return eventsByDay[key] || [];
  }, [eventsByDay, selectedDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(startOfWeek(selectedDate));
      day.setDate(day.getDate() + index);
      return day;
    });
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={PAGE_TITLE_CLASS}>Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">Bookings, housekeeping, and events in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm">
              {['Day', 'Week', 'Month'].map((label) => {
              const isActive = viewMode === label.toLowerCase();
              return (
              <button
                key={label}
                className={`rounded-full px-3 py-1 ${isActive ? 'bg-primary-600 text-white' : 'text-slate-500'}`}
                type="button"
                onClick={() => setViewMode(label.toLowerCase() as 'day' | 'week' | 'month')}
              >
                {label}
              </button>
              );
            })}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search schedule..."
            className="input w-full sm:w-60"
          />
          <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
            Add Schedule
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              >
                Prev
              </button>
              <p className="text-sm font-semibold text-slate-700">{monthLabel}</p>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              >
                Next
              </button>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
              {daysOfWeek.map((day) => (
                <span key={day}>{day}</span>
              ))}
              {calendarDays.map((day) => {
                const key = toKey(day);
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const hasEvents = Boolean(eventsByDay[key]?.length);
                const isSelected = key === toKey(selectedDate);
                return (
                  <div
                    key={key}
                    className={`rounded-lg px-2 py-1 text-xs ${
                      isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                    } ${key === todayKey ? 'bg-primary-100 text-primary-700' : ''} ${
                      isSelected && key !== todayKey ? 'bg-slate-100 text-slate-700' : ''
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{day.getDate()}</span>
                      {hasEvents && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-slate-900">Category</h2>
            <div className="mt-3 space-y-2 text-sm">
              {categories.map((category) => (
                <label key={category.type} className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(category.type)}
                    onChange={(event) => {
                      setSelectedTypes((prev) => {
                        if (event.target.checked) {
                          return [...prev, category.type];
                        }
                        return prev.filter((type) => type !== category.type);
                      });
                    }}
                  />
                  <span className={`h-2 w-2 rounded-full ${category.dot}`} />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Schedule</p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 px-2 py-0.5">All Category</span>
              <span className="rounded-full border border-slate-200 px-2 py-0.5">
                {viewMode === 'month' ? 'Month' : viewMode === 'week' ? 'Week' : 'Day'}
              </span>
            </div>
          </div>

          {viewMode === 'month' && (
            <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-sm">
              {daysOfWeek.map((day) => (
                <div key={day} className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  {day}
                </div>
              ))}
              {calendarDays.map((day) => {
                const key = toKey(day);
                const dayEvents = eventsByDay[key] || [];
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isSelected = key === toKey(selectedDate);
                return (
                  <div
                    key={key}
                    className={`min-h-[120px] bg-white px-2 py-2 ${
                      isCurrentMonth ? '' : 'bg-slate-50/60 text-slate-400'
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{day.getDate()}</span>
                      {key === todayKey && (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] text-primary-700">
                          Today
                        </span>
                      )}
                      {isSelected && key !== todayKey && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-2">
                      {isLoading ? (
                        <div className="h-8 rounded-lg bg-slate-100" />
                      ) : (
                        dayEvents.slice(0, 3).map((event) => {
                          const category = categories.find((entry) => entry.type === event.type) || categories[4];
                          return (
                            <div
                              key={event.id}
                              onClick={() => {
                                setSelectedEvent(event);
                                setDraftSchedule({
                                  title: event.title,
                                  type: event.type,
                                  startAt: new Date(event.startAt).toISOString().slice(0, 16),
                                  endAt: new Date(event.endAt).toISOString().slice(0, 16),
                                  notes: event.notes || '',
                                });
                                setShowEditModal(true);
                              }}
                              className={`cursor-pointer rounded-lg px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${category.color}`}
                            >
                              <p className="truncate">{event.title}</p>
                              <p className="truncate text-[10px] text-slate-600">
                                {event.room?.number ? `Room ${event.room.number}` : 'No room'}
                              </p>
                            </div>
                          );
                        })
                      )}
                      {!isLoading && dayEvents.length === 0 && (
                        <p className="text-[10px] text-slate-400">No schedule</p>
                      )}
                      {!isLoading && dayEvents.length > 3 && (
                        <p className="text-[10px] text-slate-500">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === 'day' && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{selectedDate.toDateString()}</p>
                  <p className="text-xs text-slate-500">Daily schedule</p>
                </div>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
                  {dayEvents.length} events
                </span>
              </div>

              {isLoading ? (
                <div className="h-16 animate-shimmer rounded-xl" />
              ) : dayEvents.length > 0 ? (
                dayEvents.map((event) => {
                  const category = categories.find((entry) => entry.type === event.type) || categories[4];
                  return (
                    <div 
                      key={event.id} 
                      onClick={() => {
                        setSelectedEvent(event);
                        setDraftSchedule({
                          title: event.title,
                          type: event.type,
                          startAt: new Date(event.startAt).toISOString().slice(0, 16),
                          endAt: new Date(event.endAt).toISOString().slice(0, 16),
                          notes: event.notes || '',
                        });
                        setShowEditModal(true);
                      }}
                      className="cursor-pointer rounded-xl border border-slate-100 px-4 py-3 transition-all hover:border-primary-300 hover:bg-primary-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                          <p className="text-xs text-slate-500">
                            {event.room?.number ? `Room ${event.room.number}` : 'No room'}{' '}
                            {event.booking?.bookingRef ? `- ${event.booking.bookingRef}` : ''}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${category.color}`}>
                          {category.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {new Date(event.startAt).toLocaleTimeString()} -{' '}
                        {new Date(event.endAt).toLocaleTimeString()}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No events scheduled today.
                </div>
              )}
            </div>
          )}

          {viewMode === 'week' && (
            <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-sm">
              {daysOfWeek.map((day) => (
                <div key={day} className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  {day}
                </div>
              ))}
              {weekDays.map((day) => {
                const key = toKey(day);
                const dayEvents = eventsByDay[key] || [];
                return (
                  <div key={key} className="min-h-[160px] bg-white px-2 py-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{day.getDate()}</span>
                      {key === todayKey && (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] text-primary-700">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-2">
                      {isLoading ? (
                        <div className="h-8 rounded-lg bg-slate-100" />
                      ) : (
                        dayEvents.map((event) => {
                          const category = categories.find((entry) => entry.type === event.type) || categories[4];
                          return (
                            <div
                              key={event.id}
                              className={`rounded-lg px-2 py-1 text-xs font-medium ${category.color}`}
                            >
                              <p className="truncate">{event.title}</p>
                              <p className="truncate text-[10px] text-slate-600">
                                {event.room?.number ? `Room ${event.room.number}` : 'No room'}
                              </p>
                            </div>
                          );
                        })
                      )}
                      {!isLoading && dayEvents.length === 0 && (
                        <p className="text-[10px] text-slate-400">No schedule</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Add Schedule</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!draftSchedule.title.trim() || !draftSchedule.startAt || !draftSchedule.endAt) {
                  toast.error('Please provide a title and dates');
                  return;
                }
                createMutation.mutate();
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="label">Title *</label>
                <input
                  className="input"
                  value={draftSchedule.title}
                  onChange={(event) =>
                    setDraftSchedule((prev) => ({ ...prev, title: event.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Type *</label>
                <select
                  className="input"
                  value={draftSchedule.type}
                  onChange={(event) =>
                    setDraftSchedule((prev) => ({ ...prev, type: event.target.value as CalendarType }))
                  }
                >
                  {categories.map((category) => (
                    <option key={category.type} value={category.type}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Start *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={draftSchedule.startAt}
                    onChange={(event) =>
                      setDraftSchedule((prev) => ({ ...prev, startAt: event.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="label">End *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={draftSchedule.endAt}
                    onChange={(event) =>
                      setDraftSchedule((prev) => ({ ...prev, endAt: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={draftSchedule.notes}
                  onChange={(event) =>
                    setDraftSchedule((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setShowEditModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Edit Schedule</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!draftSchedule.title.trim() || !draftSchedule.startAt || !draftSchedule.endAt) {
                  toast.error('Please provide a title and dates');
                  return;
                }
                updateMutation.mutate();
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="label">Title *</label>
                <input
                  className="input"
                  value={draftSchedule.title}
                  onChange={(event) =>
                    setDraftSchedule((prev) => ({ ...prev, title: event.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Type *</label>
                <select
                  className="input"
                  value={draftSchedule.type}
                  onChange={(event) =>
                    setDraftSchedule((prev) => ({ ...prev, type: event.target.value as CalendarType }))
                  }
                >
                  {categories.map((category) => (
                    <option key={category.type} value={category.type}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Start *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={draftSchedule.startAt}
                    onChange={(event) =>
                      setDraftSchedule((prev) => ({ ...prev, startAt: event.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="label">End *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={draftSchedule.endAt}
                    onChange={(event) =>
                      setDraftSchedule((prev) => ({ ...prev, endAt: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={draftSchedule.notes}
                  onChange={(event) =>
                    setDraftSchedule((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this schedule?')) {
                      deleteMutation.mutate();
                    }
                  }}
                  className="btn-outline flex-1 text-red-600 hover:bg-red-50"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Updating...' : 'Update Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

