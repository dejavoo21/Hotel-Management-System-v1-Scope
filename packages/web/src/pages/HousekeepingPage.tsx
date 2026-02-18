import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { housekeepingService } from '@/services';
import { getHousekeepingFloors, getHousekeepingRooms } from '@/data/dataSource';
import type { Room } from '@/types';
import { formatEnumLabel } from '@/utils';
import { useUiStore } from '@/stores/uiStore';

type StatusFilter = 'all' | Room['housekeepingStatus'];
type PriorityFilter = 'all' | 'HIGH' | 'MEDIUM' | 'LOW';

function derivePriority(room: Room): 'HIGH' | 'MEDIUM' | 'LOW' {
  // No explicit priority in the Room model. This maps to a believable operational priority.
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
  if (status === 'CLEAN') return 'bg-emerald-100 text-emerald-700';
  if (status === 'DIRTY') return 'bg-rose-100 text-rose-700';
  if (status === 'INSPECTION') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

export default function HousekeepingPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [floor, setFloor] = useState<number | 'all'>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const globalSearch = useUiStore((s) => s.globalSearch);

  const queryClient = useQueryClient();

  const { data: floorsData } = useQuery({
    queryKey: ['floors'],
    queryFn: getHousekeepingFloors,
  });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['housekeeping', 'rooms', status, floor, globalSearch],
    queryFn: () =>
      getHousekeepingRooms({
        search: globalSearch,
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
    return list
      .filter((r) => {
        if (priority === 'all') return true;
        return derivePriority(r) === priority;
      })
      .sort((a, b) => Number(a.number) - Number(b.number));
  }, [rooms, priority]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Housekeeping</h1>
          <p className="mt-1 text-sm text-slate-600">Manage room status, priority, and notes.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={floor}
              onChange={(e) => setFloor(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="all">All Rooms</option>
              {floorOptions.map((n) => (
                <option key={n} value={n}>
                  Floor {n}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              <option value="CLEAN">Clean</option>
              <option value="DIRTY">Dirty</option>
              <option value="INSPECTION">Needs inspection</option>
              <option value="OUT_OF_SERVICE">Out of service</option>
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
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
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Rooms</h2>
            <div className="text-sm font-semibold text-slate-500">{filtered.length} result(s)</div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-slate-600">Loading rooms...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No rooms match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Room
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Room Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Housekeeping Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Priority
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Floor
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reservation Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((room) => {
                  const p = derivePriority(room);
                  const reservation =
                    room.status === 'OCCUPIED'
                      ? 'Checked-In'
                      : room.status === 'OUT_OF_SERVICE'
                        ? 'Out of service'
                        : 'Available';

                  return (
                    <tr key={room.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm font-bold text-slate-900">{room.number}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{room.roomType?.name ?? '-'}</td>
                      <td className="px-5 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(room.housekeepingStatus)}`}>
                            {formatEnumLabel(room.housekeepingStatus)}
                          </span>
                          <select
                            value={room.housekeepingStatus}
                            onChange={(e) =>
                              updateStatusMutation.mutate({
                                roomId: room.id,
                                housekeepingStatus: e.target.value as Room['housekeepingStatus'],
                              })
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                            aria-label={`Update housekeeping status for room ${room.number}`}
                          >
                            <option value="CLEAN">Clean</option>
                            <option value="DIRTY">Dirty</option>
                            <option value="INSPECTION">Needs inspection</option>
                            <option value="OUT_OF_SERVICE">Out of service</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityPill(p)}`}>
                          {formatEnumLabel(p)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">{room.floor}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{reservation}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{room.notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

