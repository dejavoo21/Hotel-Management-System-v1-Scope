import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { housekeepingService, roomService } from '@/services';
import type { Room } from '@/types';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { formatEnumLabel } from '@/utils';

type StatusFilter = 'all' | 'CLEAN' | 'DIRTY' | 'INSPECTION' | 'OUT_OF_SERVICE';

export default function HousekeepingPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const validStatusFilters: StatusFilter[] = ['all', 'CLEAN', 'DIRTY', 'INSPECTION', 'OUT_OF_SERVICE'];
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam && validStatusFilters.includes(statusParam as StatusFilter)) {
      setStatusFilter(statusParam as StatusFilter);
    }
  }, [searchParams]);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['housekeeping', 'rooms', statusFilter, floorFilter],
    queryFn: () =>
      housekeepingService.getRooms({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        floor: floorFilter !== 'all' ? floorFilter : undefined,
      }),
  });

  const { data: floorsData } = useQuery({
    queryKey: ['floors'],
    queryFn: roomService.getFloors,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      roomId,
      status,
      notes,
    }: {
      roomId: string;
      status: Room['housekeepingStatus'];
      notes?: string;
    }) => housekeepingService.updateRoomStatus(roomId, { housekeepingStatus: status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] });
      toast.success('Room status updated');
      setSelectedRoom(null);
      setNotes('');
    },
    onError: () => {
      toast.error('Failed to update room status');
    },
  });

  const roomsList = rooms ?? [];

  const roomsByFloorNumbers = useMemo(() => {
    const numbers = new Set<number>();
    roomsList.forEach((room) => numbers.add(room.floor));
    return Array.from(numbers).sort((a, b) => a - b);
  }, [roomsList]);

  const floorOptions = useMemo(() => {
    const numbers = new Set<number>(roomsByFloorNumbers);
    (floorsData ?? []).forEach((floor) => numbers.add(floor.number));
    return Array.from(numbers).sort((a, b) => a - b);
  }, [floorsData, roomsByFloorNumbers]);

  const roomsByFloor = useMemo(() => {
    return roomsList.reduce((acc, room) => {
      acc[room.floor] = acc[room.floor] || [];
      acc[room.floor].push(room);
      return acc;
    }, {} as Record<number, Room[]>);
  }, [roomsList]);

  useEffect(() => {
    if (floorFilter !== 'all' && !floorOptions.includes(floorFilter)) {
      setFloorFilter('all');
    }
  }, [floorFilter, floorOptions]);

  const getStatusColor = (status: Room['housekeepingStatus']) => {
    switch (status) {
      case 'CLEAN':
        return 'bg-emerald-500';
      case 'DIRTY':
        return 'bg-amber-500';
      case 'INSPECTION':
        return 'bg-blue-500';
      case 'OUT_OF_SERVICE':
        return 'bg-slate-400';
    }
  };

  const getStatusBgColor = (status: Room['housekeepingStatus']) => {
    switch (status) {
      case 'CLEAN':
        return 'bg-emerald-50 border-emerald-200';
      case 'DIRTY':
        return 'bg-amber-50 border-amber-200';
      case 'INSPECTION':
        return 'bg-blue-50 border-blue-200';
      case 'OUT_OF_SERVICE':
        return 'bg-slate-50 border-slate-200';
    }
  };

  const counts = {
    all: rooms?.length || 0,
    CLEAN: rooms?.filter((r) => r.housekeepingStatus === 'CLEAN').length || 0,
    DIRTY: rooms?.filter((r) => r.housekeepingStatus === 'DIRTY').length || 0,
    INSPECTION: rooms?.filter((r) => r.housekeepingStatus === 'INSPECTION').length || 0,
    OUT_OF_SERVICE: rooms?.filter((r) => r.housekeepingStatus === 'OUT_OF_SERVICE').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Housekeeping</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage room cleanliness and housekeeping tasks
        </p>
      </div>

      {/* Status summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => setStatusFilter('DIRTY')}
          className={`card text-left transition-all ${
            statusFilter === 'DIRTY' ? 'ring-2 ring-amber-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-amber-600">{counts.DIRTY}</p>
          <p className="text-sm text-slate-500">Dirty Rooms</p>
        </button>

        <button
          onClick={() => setStatusFilter('INSPECTION')}
          className={`card text-left transition-all ${
            statusFilter === 'INSPECTION' ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-blue-600">{counts.INSPECTION}</p>
          <p className="text-sm text-slate-500">Ready for Inspection</p>
        </button>

        <button
          onClick={() => setStatusFilter('CLEAN')}
          className={`card text-left transition-all ${
            statusFilter === 'CLEAN' ? 'ring-2 ring-emerald-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-emerald-600">{counts.CLEAN}</p>
          <p className="text-sm text-slate-500">Clean Rooms</p>
        </button>

        <button
          onClick={() => setStatusFilter('all')}
          className={`card text-left transition-all ${
            statusFilter === 'all' ? 'ring-2 ring-primary-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">{counts.all}</p>
          <p className="text-sm text-slate-500">Total Rooms</p>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={floorFilter}
            onChange={(e) =>
              setFloorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="input w-auto"
          >
            <option value="all">All Floors</option>
            {floorOptions.map((floor) => (
              <option key={floor} value={floor}>
                Floor {floor}
              </option>
            ))}
          </select>

          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              Clear filter
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Rooms by floor */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-24 animate-shimmer rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {roomsByFloorNumbers
            .filter((floor) => floorFilter === 'all' || floor === floorFilter)
            .map((floor) => {
            const floorRooms = roomsByFloor[floor].filter(
              (r) => statusFilter === 'all' || r.housekeepingStatus === statusFilter
            );

            if (floorRooms.length === 0) return null;

            return (
              <div key={floor}>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Floor {floor}</h2>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {floorRooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${getStatusBgColor(
                        room.housekeepingStatus
                      )}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-bold text-slate-900">{room.number}</p>
                          <p className="text-sm text-slate-500">{room.roomType.name}</p>
                        </div>
                        <div className={`h-3 w-3 rounded-full ${getStatusColor(room.housekeepingStatus)}`} />
                      </div>

                      <div className="mt-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            room.housekeepingStatus === 'CLEAN'
                              ? 'bg-emerald-100 text-emerald-700'
                              : room.housekeepingStatus === 'DIRTY'
                              ? 'bg-amber-100 text-amber-700'
                              : room.housekeepingStatus === 'INSPECTION'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {formatEnumLabel(room.housekeepingStatus)}
                        </span>
                      </div>

                      {room.status === 'OCCUPIED' && (
                        <p className="mt-2 text-xs text-slate-500">
                          {room.currentGuest
                            ? `${room.currentGuest.firstName} ${room.currentGuest.lastName}`
                            : 'Occupied'}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Room status update modal */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => {
              setSelectedRoom(null);
              setNotes('');
            }}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <button
              onClick={() => {
                setSelectedRoom(null);
                setNotes('');
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-bold text-slate-900">Room {selectedRoom.number}</h2>
            <p className="text-sm text-slate-500">
              {selectedRoom.roomType.name} • Floor {selectedRoom.floor}
            </p>

            <div className="mt-6">
              <label className="label">Update Status</label>
              <div className="grid grid-cols-2 gap-2">
                {(['CLEAN', 'DIRTY', 'INSPECTION', 'OUT_OF_SERVICE'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() =>
                    updateStatusMutation.mutate({
                      roomId: selectedRoom.id,
                      status,
                      notes: notes || undefined,
                    })
                  }
                  disabled={updateStatusMutation.isPending}
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    selectedRoom.housekeepingStatus === status
                      ? 'bg-primary-600 text-white'
                      : status === 'CLEAN'
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : status === 'DIRTY'
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : status === 'INSPECTION'
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {formatEnumLabel(status)}
                </button>
              ))}
            </div>
          </div>

            <div className="mt-4">
              <label className="label">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                rows={3}
                placeholder="Add any notes about this room..."
              />
            </div>

            {selectedRoom.status === 'OCCUPIED' && selectedRoom.currentGuest && (
              <div className="mt-4 rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">Currently Occupied</p>
                <p className="text-sm text-blue-700">
                  Guest: {selectedRoom.currentGuest.firstName} {selectedRoom.currentGuest.lastName}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
