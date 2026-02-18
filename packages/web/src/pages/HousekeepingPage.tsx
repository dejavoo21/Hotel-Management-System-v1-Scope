import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { housekeepingService } from '@/services';
import { getHousekeepingFloors, getHousekeepingRooms } from '@/data/dataSource';
import type { Room } from '@/types';
import { formatEnumLabel } from '@/utils';
import { PAGE_TITLE_CLASS } from '@/styles/typography';

type StatusFilter = 'all' | Room['housekeepingStatus'];
type PriorityFilter = 'all' | 'HIGH' | 'MEDIUM' | 'LOW';

function derivePriority(room: Room): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (room.housekeepingStatus === 'DIRTY') return 'HIGH';
  if (room.housekeepingStatus === 'INSPECTION') return 'MEDIUM';
  if (room.housekeepingStatus === 'OUT_OF_SERVICE') return 'MEDIUM';
  return 'LOW';
}

function priorityPill(priority: 'HIGH' | 'MEDIUM' | 'LOW') {
  if (priority === 'HIGH') return 'bg-rose-100 text-rose-700';
  if (priority === 'MEDIUM') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

function statusPill(status: Room['housekeepingStatus']) {
  if (status === 'CLEAN') return 'bg-lime-200 text-lime-800';
  if (status === 'DIRTY') return 'bg-rose-100 text-rose-700';
  if (status === 'INSPECTION') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

function reservationLabel(room: Room) {
  if (room.status === 'OCCUPIED') return 'Checked-In';
  if (room.housekeepingStatus === 'DIRTY' || room.housekeepingStatus === 'INSPECTION') return 'Checked-Out';
  return 'Reserved';
}

function fallbackNote(room: Room) {
  if (room.notes) return room.notes;
  if (room.housekeepingStatus === 'DIRTY') return 'Ensure room is stocked and ready for next arrival.';
  if (room.housekeepingStatus === 'INSPECTION') return 'Verify all amenities and electronics before release.';
  if (room.housekeepingStatus === 'CLEAN') return 'Ready for guest check-in.';
  return 'Temporarily unavailable for operational checks.';
}

function ordinalFloor(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export default function HousekeepingPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [floor, setFloor] = useState<number | 'all'>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const pageSize = 13;

  const { data: floorsData } = useQuery({
    queryKey: ['floors'],
    queryFn: getHousekeepingFloors,
  });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['housekeeping', 'rooms', status, floor, search],
    queryFn: () =>
      getHousekeepingRooms({
        search,
        status: status !== 'all' ? status : undefined,
        floor: floor !== 'all' ? floor : undefined,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ roomId, housekeepingStatus }: { roomId: string; housekeepingStatus: Room['housekeepingStatus'] }) =>
      housekeepingService.updateRoomStatus(roomId, { housekeepingStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] });
      toast.success('Room updated');
    },
    onError: () => toast.error('Failed to update room'),
  });

  const floorOptions = useMemo(() => {
    const nums = (floorsData ?? []).map((f) => f.number).sort((a, b) => a - b);
    return Array.from(new Set(nums));
  }, [floorsData]);

  const filtered = useMemo(() => {
    const list = rooms ?? [];
    const withPriorityFilter = list.filter((r) => (priority === 'all' ? true : derivePriority(r) === priority));
    return withPriorityFilter.sort((a, b) => Number(a.number) - Number(b.number));
  }, [rooms, priority]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const showingStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, filtered.length);

  const toggleSelect = (roomId: string, checked: boolean) => {
    setSelectedRoomIds((prev) =>
      checked ? (prev.includes(roomId) ? prev : [...prev, roomId]) : prev.filter((id) => id !== roomId)
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className={PAGE_TITLE_CLASS}>Housekeeping</h1>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search room, floor, etc"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={floor}
              onChange={(e) => {
                setFloor(e.target.value === 'all' ? 'all' : Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-lime-300 bg-lime-200 px-3 py-2 text-sm font-semibold text-slate-800"
            >
              <option value="all">All Room</option>
              {floorOptions.map((n) => (
                <option key={n} value={n}>
                  Floor {n}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="rounded-lg border border-lime-300 bg-lime-200 px-3 py-2 text-sm font-semibold text-slate-800"
            >
              <option value="all">All Status</option>
              <option value="CLEAN">Ready</option>
              <option value="DIRTY">Needs Cleaning</option>
              <option value="INSPECTION">Needs Inspection</option>
              <option value="OUT_OF_SERVICE">Out of service</option>
            </select>

            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as PriorityFilter);
                setPage(1);
              }}
              className="rounded-lg border border-lime-300 bg-lime-200 px-3 py-2 text-sm font-semibold text-slate-800"
            >
              <option value="all">All Priority</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-600">Loading rooms...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No rooms match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-emerald-50/40">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" aria-label="Select all rooms" className="h-4 w-4 rounded border-slate-300" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Room Number</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Room Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Housekeeping Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Floor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Reservation Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((room) => {
                  const p = derivePriority(room);
                  return (
                    <tr key={room.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRoomIds.includes(room.id)}
                          onChange={(e) => toggleSelect(room.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label={`Select room ${room.number}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">Room {room.number}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{room.roomType?.name ?? '-'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={room.housekeepingStatus}
                          onChange={(e) =>
                            updateStatusMutation.mutate({
                              roomId: room.id,
                              housekeepingStatus: e.target.value as Room['housekeepingStatus'],
                            })
                          }
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusPill(room.housekeepingStatus)}`}
                          aria-label={`Update housekeeping status for room ${room.number}`}
                        >
                          <option value="CLEAN">{formatEnumLabel('CLEAN')}</option>
                          <option value="DIRTY">{formatEnumLabel('DIRTY')}</option>
                          <option value="INSPECTION">{formatEnumLabel('INSPECTION')}</option>
                          <option value="OUT_OF_SERVICE">{formatEnumLabel('OUT_OF_SERVICE')}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${priorityPill(p)}`}>
                          {formatEnumLabel(p)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{ordinalFloor(room.floor)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{reservationLabel(room)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{fallbackNote(room)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
          <div className="text-slate-500">
            Showing {showingStart}-{showingEnd} of {filtered.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border border-slate-200 px-2 py-1 text-slate-600 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(3, totalPages) }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold ${
                    currentPage === pageNum ? 'bg-lime-200 text-slate-900' : 'border border-slate-200 text-slate-600'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 3 ? <span className="px-1 text-slate-400">...</span> : null}
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              className={`h-8 w-8 rounded-lg text-xs font-semibold ${
                currentPage === totalPages ? 'bg-lime-200 text-slate-900' : 'border border-slate-200 text-slate-600'
              }`}
            >
              {totalPages}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-slate-200 px-2 py-1 text-slate-600 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
