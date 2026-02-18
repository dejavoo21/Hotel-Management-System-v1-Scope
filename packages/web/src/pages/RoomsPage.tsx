import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService } from '@/services';
import type { Room } from '@/types';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { formatEnumLabel } from '@/utils';
import { PAGE_TITLE_CLASS } from '@/styles/typography';
import { getRoomImage, setRoomImage, setRoomTypeImage } from '@/utils/mediaPrefs';

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'AVAILABLE' | 'OCCUPIED' | 'OUT_OF_SERVICE';
type HousekeepingFilter = 'all' | 'CLEAN' | 'DIRTY' | 'INSPECTION' | 'OUT_OF_SERVICE';

export default function RoomsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [housekeepingFilter, setHousekeepingFilter] = useState<HousekeepingFilter>('all');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  const [roomImageVersion, setRoomImageVersion] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const roomImageInputRef = useRef<HTMLInputElement | null>(null);
  const roomTypeImageInputRef = useRef<HTMLInputElement | null>(null);
  const [searchParams] = useSearchParams();
  const validStatusFilters: StatusFilter[] = ['all', 'AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE'];
  const validHousekeepingFilters: HousekeepingFilter[] = [
    'all',
    'CLEAN',
    'DIRTY',
    'INSPECTION',
    'OUT_OF_SERVICE',
  ];
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam && validStatusFilters.includes(statusParam as StatusFilter)) {
      setStatusFilter(statusParam as StatusFilter);
    }
    const housekeepingParam = searchParams.get('housekeeping');
    if (housekeepingParam && validHousekeepingFilters.includes(housekeepingParam as HousekeepingFilter)) {
      setHousekeepingFilter(housekeepingParam as HousekeepingFilter);
    }
  }, [searchParams]);

  const queryClient = useQueryClient();

  const { data: roomsData, isLoading } = useQuery({
    queryKey: ['rooms', statusFilter, housekeepingFilter, floorFilter],
        queryFn: () =>
          roomService.getRooms({
            status: statusFilter !== 'all' ? statusFilter : undefined,
            housekeepingStatus: housekeepingFilter !== 'all' ? housekeepingFilter : undefined,
            floor: floorFilter !== 'all' ? floorFilter : undefined,
            limit: 100,
          }),
  });

  const { data: roomTypes } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: roomService.getRoomTypes,
  });

  const { data: floorsData } = useQuery({
    queryKey: ['floors'],
    queryFn: roomService.getFloors,
  });

  const createRoomMutation = useMutation({
    mutationFn: roomService.createRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room created');
      setShowAddModal(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to create room';
      toast.error(errorMessage);
    },
  });

  const createFloorMutation = useMutation({
    mutationFn: roomService.createFloor,
    onSuccess: (floor) => {
      queryClient.invalidateQueries({ queryKey: ['floors'] });
      toast.success('Floor added');
      setShowFloorModal(false);
      setFloorFilter(floor.number);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to add floor';
      toast.error(errorMessage);
    },
  });

  const deleteFloorMutation = useMutation({
    mutationFn: (id: string) => roomService.deleteFloor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floors'] });
      toast.success('Floor removed');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to delete floor';
      toast.error(errorMessage);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Room['status'] }) =>
      roomService.updateRoomStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room status updated');
      setSelectedRoom(null);
    },
    onError: () => {
      toast.error('Failed to update room status');
    },
  });

  const updateHousekeepingMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Room['housekeepingStatus'] }) =>
      roomService.updateHousekeepingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Housekeeping status updated');
      setSelectedRoom(null);
    },
    onError: () => {
      toast.error('Failed to update housekeeping status');
    },
  });

  const rooms = roomsData?.data || [];
  const sortedFloors = (floorsData || []).slice().sort((a, b) => a.number - b.number);

  const getStatusColor = (status: Room['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-500';
      case 'OCCUPIED':
        return 'bg-blue-500';
      case 'OUT_OF_SERVICE':
        return 'bg-slate-400';
    }
  };

  const getHousekeepingColor = (status: Room['housekeepingStatus']) => {
    switch (status) {
      case 'CLEAN':
        return 'border-emerald-500';
      case 'DIRTY':
        return 'border-amber-500';
      case 'INSPECTION':
        return 'border-blue-500';
      case 'OUT_OF_SERVICE':
        return 'border-slate-400';
    }
  };

  const getStatusBadge = (status: Room['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return 'status-available';
      case 'OCCUPIED':
        return 'status-occupied';
      case 'OUT_OF_SERVICE':
        return 'status-oos';
    }
  };

  const getHousekeepingBadge = (status: Room['housekeepingStatus']) => {
    switch (status) {
      case 'CLEAN':
        return 'status-available';
      case 'DIRTY':
        return 'status-dirty';
      case 'INSPECTION':
        return 'status-confirmed';
      case 'OUT_OF_SERVICE':
        return 'status-oos';
    }
  };

  const onRoomImagePicked = (roomId: string, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : null;
      if (!value) return;
      try {
        setRoomImage(roomId, value);
        setRoomImageVersion((v) => v + 1);
        toast.success('Room image updated');
      } catch {
        toast.error('Failed to update room image');
      }
    };
    reader.readAsDataURL(file);
  };

  const onRoomTypeImagePicked = (roomTypeName: string, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : null;
      if (!value) return;
      try {
        setRoomTypeImage(roomTypeName, value);
        setRoomImageVersion((v) => v + 1);
        toast.success('Room type image updated');
      } catch {
        toast.error('Failed to update room type image');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={PAGE_TITLE_CLASS}>Rooms</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage room status and availability
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </button>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex rounded-lg border border-slate-200 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="input w-auto"
          >
            <option value="all">All Status</option>
            <option value="AVAILABLE">Available</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="OUT_OF_SERVICE">Out of Service</option>
          </select>

          <select
            value={housekeepingFilter}
            onChange={(e) => setHousekeepingFilter(e.target.value as HousekeepingFilter)}
            className="input w-auto"
          >
            <option value="all">All Housekeeping</option>
            <option value="CLEAN">Clean</option>
            <option value="DIRTY">Dirty</option>
            <option value="INSPECTION">Inspection</option>
            <option value="OUT_OF_SERVICE">Out of Service</option>
          </select>

          <select
            value={floorFilter}
            onChange={(e) =>
              setFloorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="input w-auto"
          >
            <option value="all">All Floors</option>
            {sortedFloors.map((floor) => (
              <option key={floor.id} value={floor.number}>
                Floor {floor.number}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowFloorModal(true)}
            className="btn-outline h-full whitespace-nowrap rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            Add floor
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium text-slate-700">Status:</span>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-slate-600">Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-slate-400" />
          <span className="text-slate-600">Out of Service</span>
        </div>
        <span className="mx-2 text-slate-300">|</span>
        <span className="font-medium text-slate-700">Housekeeping:</span>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded border-2 border-emerald-500" />
          <span className="text-slate-600">Clean</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded border-2 border-amber-500" />
          <span className="text-slate-600">Dirty</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded border-2 border-blue-500" />
          <span className="text-slate-600">Inspection</span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-32 animate-shimmer rounded-xl" />
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`card card-hover text-left border-l-4 ${getHousekeepingColor(room.housekeepingStatus)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <img
                  key={`${room.id}-${roomImageVersion}`}
                  src={getRoomImage(room)}
                  alt={`Room ${room.number}`}
                  className="h-16 w-24 shrink-0 rounded-lg object-cover"
                />
                <div>
                  <p className="text-lg font-bold text-slate-900">{room.number}</p>
                  <p className="text-sm text-slate-500">{room.roomType.name}</p>
                  <p className="text-xs text-slate-500">Floor {room.floor}</p>
                </div>
                <div className={`h-3 w-3 rounded-full ${getStatusColor(room.status)}`} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={getStatusBadge(room.status)}>{formatEnumLabel(room.status)}</span>
              </div>
              {room.currentGuest && (
                <p className="mt-2 text-sm text-slate-600">
                  {room.currentGuest.firstName} {room.currentGuest.lastName}
                </p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th>Floor</th>
                <th>Status</th>
                <th>Housekeeping</th>
                <th>Guest</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="font-medium">{room.number}</td>
                  <td>{room.roomType.name}</td>
                  <td>{room.floor}</td>
                  <td>
                    <span className={getStatusBadge(room.status)}>
                      {formatEnumLabel(room.status)}
                    </span>
                  </td>
                  <td>
                    <span className={getHousekeepingBadge(room.housekeepingStatus)}>
                      {formatEnumLabel(room.housekeepingStatus)}
                    </span>
                  </td>
                  <td>
                    {room.currentGuest
                      ? `${room.currentGuest.firstName} ${room.currentGuest.lastName}`
                      : '-'}
                  </td>
                  <td>
                    <button
                      onClick={() => setSelectedRoom(room)}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setSelectedRoom(null)}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedRoom(null)}
              aria-label="Close room details"
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-bold text-slate-900">Room {selectedRoom.number}</h2>
            <p className="text-sm text-slate-500">
              {selectedRoom.roomType.name} • Floor {selectedRoom.floor}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <img
                  key={`${selectedRoom.id}-${roomImageVersion}`}
                  src={getRoomImage(selectedRoom)}
                  alt={`Room ${selectedRoom.number}`}
                  className="h-40 w-full rounded-xl object-cover"
                />
                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={roomImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      onRoomImagePicked(selectedRoom.id, event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => roomImageInputRef.current?.click()}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Change image
                  </button>
                  <input
                    ref={roomTypeImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      onRoomTypeImagePicked(selectedRoom.roomType.name, event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => roomTypeImageInputRef.current?.click()}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Change type image
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Room Status</label>
                <div className="flex flex-wrap gap-2">
                  {(['AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatusMutation.mutate({ id: selectedRoom.id, status })}
                      disabled={updateStatusMutation.isPending}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        selectedRoom.status === status
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {formatEnumLabel(status)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Housekeeping Status</label>
                <div className="flex flex-wrap gap-2">
                  {(['CLEAN', 'DIRTY', 'INSPECTION', 'OUT_OF_SERVICE'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateHousekeepingMutation.mutate({ id: selectedRoom.id, status })}
                      disabled={updateHousekeepingMutation.isPending}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        selectedRoom.housekeepingStatus === status
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {formatEnumLabel(status)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedRoom.currentGuest && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Current Guest</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {selectedRoom.currentGuest.firstName} {selectedRoom.currentGuest.lastName}
                  </p>
                  {selectedRoom.currentBooking && (
                    <p className="text-sm text-slate-600">
                      Booking: {selectedRoom.currentBooking.bookingRef}
                    </p>
                  )}
                </div>
              )}

              {selectedRoom.notes && (
                <div>
                  <label className="label">Notes</label>
                  <p className="text-sm text-slate-600">{selectedRoom.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Add Room</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                createRoomMutation.mutate({
                  roomTypeId: formData.get('roomTypeId') as string,
                  number: formData.get('number') as string,
                  floor: Number(formData.get('floor')),
                  notes: (formData.get('notes') as string) || undefined,
                });
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Room number *</label>
                  <input name="number" className="input" required />
                </div>
                <div>
                  <label className="label">Floor *</label>
                  <input name="floor" type="number" className="input" required />
                </div>
              </div>
              <div>
                <label className="label">Room type *</label>
                <select name="roomTypeId" className="input" required>
                  <option value="">Select room type</option>
                  {roomTypes?.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea name="notes" rows={3} className="input" />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRoomMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createRoomMutation.isPending ? 'Creating...' : 'Create room'}
                </button>
              </div>
            </form>
            {sortedFloors.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-slate-600">Existing floors</h3>
                <div className="space-y-2">
                  {sortedFloors.map((floor) => (
                    <div
                      key={floor.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <span className="text-sm text-slate-700">
                        Floor {floor.number}
                        {floor.name ? ` — ${floor.name}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteFloorMutation.mutate(floor.id)}
                        disabled={deleteFloorMutation.isPending}
                        className="text-xs text-red-600 hover:underline disabled:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showFloorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowFloorModal(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Add Floor</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                createFloorMutation.mutate({
                  number: Number(formData.get('floorNumber')),
                  name: (formData.get('floorName') as string) || undefined,
                });
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="label">Floor number *</label>
                <input name="floorNumber" type="number" className="input" required />
              </div>
              <div>
                <label className="label">Name (optional)</label>
                <input name="floorName" className="input" />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowFloorModal(false)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createFloorMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createFloorMutation.isPending ? 'Saving...' : 'Save floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

