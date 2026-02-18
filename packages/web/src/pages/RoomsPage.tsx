import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService } from '@/services';
import type { Room } from '@/types';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { PAGE_TITLE_CLASS } from '@/styles/typography';
import { getRoomImage, getRoomTypeImage, setRoomImage, setRoomTypeImage } from '@/utils/mediaPrefs';

type StatusFilter = 'all' | 'AVAILABLE' | 'OCCUPIED' | 'OUT_OF_SERVICE';
type HousekeepingFilter = 'all' | 'CLEAN' | 'DIRTY' | 'INSPECTION' | 'OUT_OF_SERVICE';
type SortBy = 'popular' | 'name' | 'priceAsc' | 'priceDesc';

type DisplayRoomType = {
  name: string;
  description?: string;
  baseRate: number;
  maxGuests: number;
  total: number;
  occupied: number;
  sample: Room | null;
};

const TITLE_MATCH_CLASS = 'text-2xl font-bold tracking-tight text-slate-900';

const referenceRoomSeeds = [
  {
    name: 'Standard',
    description: 'Comfortable, affordable stay for solo travelers or couples. Queen bed, en-suite bathroom, work desk, essential amenities.',
    baseRate: 100,
    maxGuests: 2,
    total: 30,
    occupied: 8,
  },
  {
    name: 'Deluxe',
    description: 'More space and luxury. King bed, separate seating, larger desk, 55-inch TV. En-suite bathroom with bathtub and shower.',
    baseRate: 150,
    maxGuests: 2,
    total: 25,
    occupied: 7,
  },
  {
    name: 'Suite',
    description: 'Spacious and private with separate living and sleeping areas. King bed, furnished living room, kitchenette.',
    baseRate: 250,
    maxGuests: 4,
    total: 10,
    occupied: 2,
  },
  {
    name: 'Family',
    description: 'Designed for comfort and practicality. Two queen beds and family-friendly setup for shared stays.',
    baseRate: 200,
    maxGuests: 4,
    total: 15,
    occupied: 5,
  },
  {
    name: 'Single',
    description: 'Cozy room designed for solo travelers with practical amenities and comfortable bedding.',
    baseRate: 90,
    maxGuests: 2,
    total: 5,
    occupied: 2,
  },
];

const iconDot = (
  <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.415 0l-3-3a1 1 0 111.415-1.42l2.293 2.294 6.543-6.544a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

export default function RoomsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [housekeepingFilter, setHousekeepingFilter] = useState<HousekeepingFilter>('all');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  const [roomImageVersion, setRoomImageVersion] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('popular');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTypeName, setSelectedTypeName] = useState<string>('');
  const [editStatus, setEditStatus] = useState<Room['status']>('AVAILABLE');
  const [editHousekeeping, setEditHousekeeping] = useState<Room['housekeepingStatus']>('CLEAN');
  const roomImageInputRef = useRef<HTMLInputElement | null>(null);
  const roomTypeImageInputRef = useRef<HTMLInputElement | null>(null);
  const [searchParams] = useSearchParams();
  const validStatusFilters: StatusFilter[] = ['all', 'AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE'];
  const validHousekeepingFilters: HousekeepingFilter[] = ['all', 'CLEAN', 'DIRTY', 'INSPECTION', 'OUT_OF_SERVICE'];

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
    mutationFn: ({ id, status }: { id: string; status: Room['status'] }) => roomService.updateRoomStatus(id, status),
  });

  const updateHousekeepingMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Room['housekeepingStatus'] }) =>
      roomService.updateHousekeepingStatus(id, status),
  });

  const rooms = roomsData?.data || [];
  const sortedFloors = (floorsData || []).slice().sort((a, b) => a.number - b.number);

  const displayGroups = useMemo(() => {
    const map = new Map<string, DisplayRoomType>();

    for (const room of rooms) {
      const key = room.roomType.name;
      const entry = map.get(key);
      if (!entry) {
        map.set(key, {
          name: room.roomType.name,
          description: room.roomType.description,
          baseRate: Number(room.roomType.baseRate) || 0,
          maxGuests: Number(room.roomType.maxGuests) || 2,
          total: 1,
          occupied: room.status === 'OCCUPIED' ? 1 : 0,
          sample: room,
        });
      } else {
        entry.total += 1;
        if (room.status === 'OCCUPIED') entry.occupied += 1;
        if (!entry.sample) entry.sample = room;
      }
    }

    for (const roomType of roomTypes || []) {
      const key = roomType.name;
      if (!map.has(key)) {
        map.set(key, {
          name: roomType.name,
          description: roomType.description,
          baseRate: Number(roomType.baseRate) || 0,
          maxGuests: Number(roomType.maxGuests) || 2,
          total: 0,
          occupied: 0,
          sample: null,
        });
      }
    }

    for (const seed of referenceRoomSeeds) {
      if (!map.has(seed.name)) {
        map.set(seed.name, {
          name: seed.name,
          description: seed.description,
          baseRate: seed.baseRate,
          maxGuests: seed.maxGuests,
          total: seed.total,
          occupied: seed.occupied,
          sample: null,
        });
      }
    }

    return [...map.values()];
  }, [rooms, roomTypes]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = displayGroups.filter((group) => {
      if (typeFilter !== 'all' && group.name !== typeFilter) return false;
      if (!query) return true;
      return (
        group.name.toLowerCase().includes(query) ||
        (group.description || '').toLowerCase().includes(query) ||
        rooms.some(
          (room) =>
            room.roomType.name === group.name &&
            (room.number.toLowerCase().includes(query) || `floor ${room.floor}`.includes(query)),
        )
      );
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'priceAsc':
          return a.baseRate - b.baseRate;
        case 'priceDesc':
          return b.baseRate - a.baseRate;
        case 'popular':
        default:
          return b.occupied - a.occupied;
      }
    });

    return filtered;
  }, [displayGroups, searchQuery, typeFilter, sortBy, rooms]);

  useEffect(() => {
    if (!selectedTypeName && filteredGroups.length > 0) {
      setSelectedTypeName(filteredGroups[0].name);
      return;
    }
    if (selectedTypeName && !filteredGroups.some((group) => group.name === selectedTypeName)) {
      setSelectedTypeName(filteredGroups[0]?.name || '');
    }
  }, [filteredGroups, selectedTypeName]);

  const selectedGroup = filteredGroups.find((group) => group.name === selectedTypeName) || filteredGroups[0] || null;
  const selectedTypeRooms = selectedGroup ? rooms.filter((room) => room.roomType.name === selectedGroup.name) : [];
  const selectedLiveRoom = selectedTypeRooms[0] || selectedGroup?.sample || null;

  useEffect(() => {
    if (!selectedLiveRoom) return;
    setEditStatus(selectedLiveRoom.status);
    setEditHousekeeping(selectedLiveRoom.housekeepingStatus);
  }, [selectedLiveRoom]);

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

  const getAreaLabel = (roomTypeName: string) => {
    const t = roomTypeName.toLowerCase();
    if (t.includes('suite')) return '50 m2';
    if (t.includes('family')) return '45 m2';
    if (t.includes('deluxe')) return '35 m2';
    if (t.includes('single')) return '20 m2';
    return '25 m2';
  };

  const getBedLabel = (roomTypeName: string) => {
    const t = roomTypeName.toLowerCase();
    if (t.includes('family')) return '2 Queen Beds';
    if (t.includes('suite') || t.includes('deluxe')) return 'King Bed';
    if (t.includes('single')) return 'Single Bed';
    return 'Queen Bed';
  };

  const handleOpenEdit = () => {
    if (!selectedLiveRoom) {
      toast.error('No live room record available for this type yet.');
      return;
    }
    setEditStatus(selectedLiveRoom.status);
    setEditHousekeeping(selectedLiveRoom.housekeepingStatus);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedLiveRoom) return;
    try {
      if (editStatus !== selectedLiveRoom.status) {
        await updateStatusMutation.mutateAsync({ id: selectedLiveRoom.id, status: editStatus });
      }
      if (editHousekeeping !== selectedLiveRoom.housekeepingStatus) {
        await updateHousekeepingMutation.mutateAsync({ id: selectedLiveRoom.id, status: editHousekeeping });
      }
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room updated');
      setShowEditModal(false);
    } catch {
      toast.error('Failed to update room');
    }
  };

  const features = [
    'Private balcony (where applicable)',
    'Spacious layout with modern design',
    'Work desk with ergonomic chair',
    'Large windows offering city or garden views',
  ];

  const facilities = [
    'High-speed Wi-Fi',
    'In-room safe',
    'Mini-fridge',
    'Flat-screen TV',
    'Air conditioning',
    'Coffee/tea maker',
  ];

  const amenities = selectedLiveRoom?.roomType.amenities?.filter(Boolean).slice(0, 8) || [
    'WiFi',
    'AC',
    'Minibar',
    'Jacuzzi',
    'TV',
    'Mini Fridge',
    'City View',
    'Living Room',
  ];

  const heroImage = selectedLiveRoom ? getRoomImage(selectedLiveRoom) : getRoomTypeImage(selectedGroup?.name || 'standard');
  const thumbImages = selectedTypeRooms.length > 0
    ? selectedTypeRooms.slice(0, 4).map((room) => getRoomImage(room))
    : [heroImage, heroImage, heroImage];

  return (
    <div className="space-y-6">
      <div>
        <h1 className={PAGE_TITLE_CLASS}>Rooms</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_1fr]">
        <div className="card p-4">
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(200px,1fr)_auto_auto_auto]">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="input h-10 pl-9"
                placeholder="Search room type, number, etc"
              />
            </div>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)} className="input h-10 w-auto min-w-[110px]">
              <option value="popular">Popular</option>
              <option value="name">Name</option>
              <option value="priceAsc">Price: Low</option>
              <option value="priceDesc">Price: High</option>
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="input h-10 w-auto min-w-[120px]">
              <option value="all">All Type</option>
              {displayGroups.map((group) => (
                <option key={group.name} value={group.name}>{group.name}</option>
              ))}
            </select>
            <button onClick={() => setShowAddModal(true)} className="btn-primary h-10">Add Room</button>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              [...Array(6)].map((_, index) => <div key={index} className="h-36 animate-shimmer rounded-xl" />)
            ) : filteredGroups.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No rooms match your filters.</div>
            ) : (
              filteredGroups.map((group) => {
                const isActive = selectedGroup?.name === group.name;
                return (
                  <button
                    key={group.name}
                    onClick={() => setSelectedTypeName(group.name)}
                    className={`w-full rounded-xl border bg-white p-3 text-left transition ${isActive ? 'border-primary-300 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex gap-4">
                      <img
                        key={`${group.name}-${roomImageVersion}`}
                        src={group.sample ? getRoomImage(group.sample) : getRoomTypeImage(group.name)}
                        alt={group.name}
                        className="h-28 w-36 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className={TITLE_MATCH_CLASS}>{group.name} Room</h3>
                          <span className={group.occupied > 0 ? 'status-occupied' : 'status-available'}>{group.occupied > 0 ? 'Occupied' : 'Available'}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                          <span>{getAreaLabel(group.name)}</span>
                          <span>{getBedLabel(group.name)}</span>
                          <span>{group.maxGuests} guests</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{group.description || 'Comfortable room setup with modern amenities and guest essentials.'}</p>
                        <div className="mt-2 flex items-end justify-between">
                          <p className="text-xs text-slate-500">Availability: <span className="font-semibold text-slate-700">{Math.max(group.total - group.occupied, 0)}/{Math.max(group.total, 1)} Rooms</span></p>
                          <p className={TITLE_MATCH_CLASS}>
                            ${Math.round(group.baseRate || 120)}
                            <span className="ml-1 text-base font-medium text-slate-500">/night</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card p-4">
          {selectedGroup ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-900">Room Detail</p>
                <button type="button" onClick={handleOpenEdit} className="rounded-md border border-lime-300 bg-lime-100 px-3 py-1 text-xs font-semibold text-slate-900">Edit</button>
              </div>
              <div className="flex items-center gap-2">
                <h2 className={TITLE_MATCH_CLASS}>{selectedGroup.name} Room</h2>
                <span className={selectedGroup.occupied > 0 ? 'status-occupied' : 'status-available'}>{selectedGroup.occupied > 0 ? 'Occupied' : 'Available'}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">Occupied: {selectedGroup.occupied}/{Math.max(selectedGroup.total, 1)} Rooms</p>

              <div className="mt-3 grid grid-cols-[1fr_70px] gap-3">
                <img src={heroImage} alt={`${selectedGroup.name} room`} className="h-60 w-full rounded-lg object-cover" />
                <div className="space-y-2">
                  {thumbImages.map((src, index) => (
                    <img key={`${src}-${index}-${roomImageVersion}`} src={src} alt="Room preview" className="h-[56px] w-full rounded-md object-cover" />
                  ))}
                  <button className="w-full rounded-md bg-primary-100 px-2 py-2 text-xs font-semibold text-slate-700">View All</button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <span>{getAreaLabel(selectedGroup.name)}</span>
                <span>{getBedLabel(selectedGroup.name)}</span>
                <span>{selectedGroup.maxGuests} guests</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{selectedGroup.description || 'Upgrade to this room type for added comfort and practical premium amenities.'}</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Features</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">{iconDot}<span>{feature}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">Facilities</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {facilities.map((facility) => (
                      <li key={facility} className="flex items-start gap-2">{iconDot}<span>{facility}</span></li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-lg font-semibold text-slate-900">Amenities</p>
                <ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                  {amenities.map((amenity) => (
                    <li key={amenity} className="flex items-start gap-2">{iconDot}<span>{amenity}</span></li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap gap-2">
                  {selectedLiveRoom && (
                    <>
                      <input
                        ref={roomImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          onRoomImagePicked(selectedLiveRoom.id, event.target.files?.[0]);
                          event.currentTarget.value = '';
                        }}
                      />
                      <button type="button" onClick={() => roomImageInputRef.current?.click()} className="btn-outline">Change image</button>
                    </>
                  )}
                  <input
                    ref={roomTypeImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      onRoomTypeImagePicked(selectedGroup.name, event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                  <button type="button" onClick={() => roomTypeImageInputRef.current?.click()} className="btn-outline">Change type image</button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Select a room type to view details.</div>
          )}
        </div>
      </div>

      {showEditModal && selectedLiveRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowEditModal(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Edit Room {selectedLiveRoom.number}</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="label">Room Status</label>
                <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as Room['status'])} className="input">
                  <option value="AVAILABLE">Available</option>
                  <option value="OCCUPIED">Occupied</option>
                  <option value="OUT_OF_SERVICE">Out of Service</option>
                </select>
              </div>
              <div>
                <label className="label">Housekeeping Status</label>
                <select value={editHousekeeping} onChange={(event) => setEditHousekeeping(event.target.value as Room['housekeepingStatus'])} className="input">
                  <option value="CLEAN">Clean</option>
                  <option value="DIRTY">Dirty</option>
                  <option value="INSPECTION">Inspection</option>
                  <option value="OUT_OF_SERVICE">Out of Service</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-outline flex-1">Cancel</button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={updateStatusMutation.isPending || updateHousekeepingMutation.isPending}
                  className="btn-primary flex-1"
                >
                  Save
                </button>
              </div>
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
                    <option key={roomType.id} value={roomType.id}>{roomType.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea name="notes" rows={3} className="input" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-outline flex-1">Cancel</button>
                <button type="submit" disabled={createRoomMutation.isPending} className="btn-primary flex-1">
                  {createRoomMutation.isPending ? 'Creating...' : 'Create room'}
                </button>
              </div>
            </form>
            {sortedFloors.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-slate-600">Existing floors</h3>
                <div className="space-y-2">
                  {sortedFloors.map((floor) => (
                    <div key={floor.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span className="text-sm text-slate-700">Floor {floor.number}{floor.name ? ` - ${floor.name}` : ''}</span>
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
                <button type="button" onClick={() => setShowFloorModal(false)} className="btn-outline flex-1">Cancel</button>
                <button type="submit" disabled={createFloorMutation.isPending} className="btn-primary flex-1">
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
