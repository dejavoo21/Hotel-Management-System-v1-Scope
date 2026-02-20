import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService, guestService, roomService } from '@/services';
import type { Booking, Guest } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { appendAuditLog } from '@/utils/auditLog';
import { PAGE_TITLE_CLASS } from '@/styles/typography';
import { getGuestImage, getRoomImage, setGuestImage } from '@/utils/mediaPrefs';

export default function GuestsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [guestImageVersion, setGuestImageVersion] = useState(0);
  const guestImageInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: roomTypes } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: roomService.getRoomTypes,
  });

  const openAddGuestModal = () => {
    setShowAddModal(true);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('action', 'add');
      return params;
    });
  };
  const closeAddGuestModal = () => {
    setShowAddModal(false);
    if (searchParams.get('action') === 'add') {
      const params = new URLSearchParams(searchParams);
      params.delete('action');
      setSearchParams(params, { replace: true });
    }
  };

  useEffect(() => {
    setShowAddModal(searchParams.get('action') === 'add');
  }, [searchParams]);

  const { data: guestsData, isLoading } = useQuery({
    queryKey: ['guests', searchQuery, page],
    queryFn: () =>
      guestService.getGuests({
        search: searchQuery || undefined,
        page,
        limit: 20,
      }),
  });

  const { data: guestBookingsData } = useQuery({
    queryKey: ['guestBookings', selectedGuest?.id],
    enabled: !!selectedGuest?.id,
    queryFn: () =>
      bookingService.getBookings({
        guestId: selectedGuest?.id,
        page: 1,
        limit: 20,
      }),
  });

  const createGuestMutation = useMutation({
    mutationFn: guestService.createGuest,
    onSuccess: (createdGuest) => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      toast.success('Guest created successfully');
      appendAuditLog({
        action: 'GUEST_CREATED',
        actorId: user?.id,
        actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
        targetId: createdGuest.id,
        targetLabel: `${createdGuest.firstName} ${createdGuest.lastName}`,
        details: {
          email: createdGuest.email,
          phone: createdGuest.phone,
          manualStays: createdGuest.manualStays ?? 0,
          preferredRoomTypeId: createdGuest.preferredRoomTypeId ?? null,
        },
      });
      closeAddGuestModal();
    },
    onError: () => {
      toast.error('Failed to create guest');
    },
  });

  const updateGuestMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Guest> }) =>
      guestService.updateGuest(id, payload),
    onSuccess: (updatedGuest) => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      toast.success('Guest updated successfully');
      appendAuditLog({
        action: 'GUEST_UPDATED',
        actorId: user?.id,
        actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
        targetId: updatedGuest.id,
        targetLabel: `${updatedGuest.firstName} ${updatedGuest.lastName}`,
        details: {
          manualStays: updatedGuest.manualStays ?? 0,
          preferredRoomTypeId: updatedGuest.preferredRoomTypeId ?? null,
        },
      });
      setShowEditModal(false);
      setSelectedGuest(null);
    },
    onError: () => {
      toast.error('Failed to update guest');
    },
  });

  const deleteGuestMutation = useMutation({
    mutationFn: guestService.deleteGuest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      toast.success('Guest deleted');
      if (selectedGuest) {
        appendAuditLog({
          action: 'GUEST_DELETED',
          actorId: user?.id,
          actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
          targetId: selectedGuest.id,
          targetLabel: `${selectedGuest.firstName} ${selectedGuest.lastName}`,
        });
      }
      setSelectedGuest(null);
    },
    onError: () => {
      toast.error('Failed to delete guest');
    },
  });

  const guests = guestsData?.data || [];
  const pagination = guestsData?.pagination;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.hotel?.currency || 'USD',
    }).format(amount);
  };

  const bookingHistory = useMemo(() => {
    const bookings = (guestBookingsData?.data || []) as Booking[];
    return [...bookings].sort(
      (a: Booking, b: Booking) =>
        new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime()
    );
  }, [guestBookingsData]);

  const latestBookingWithRoom = useMemo(
    () => bookingHistory.find((booking) => booking.room) || null,
    [bookingHistory]
  );

  const primaryBooking = useMemo(
    () => latestBookingWithRoom || bookingHistory[0] || null,
    [latestBookingWithRoom, bookingHistory]
  );

  const formatDateTime = (value?: string) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const onGuestImagePicked = (guestId: string, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : null;
      if (!value) return;
      try {
        setGuestImage(guestId, value);
        setGuestImageVersion((v) => v + 1);
        toast.success('Guest photo updated');
      } catch {
        toast.error('Failed to update guest photo');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={PAGE_TITLE_CLASS}>Guests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your guest directory
          </p>
        </div>
        <button onClick={openAddGuestModal} className="btn-primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Guest
        </button>
      </div>

      <div className="card">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      <div className="table-container">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : guests.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-2 text-sm text-slate-500">No guests found</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Country</th>
                <th>Total Stays</th>
                <th>Total Spent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {guests.map((guest) => (
                <tr
                  key={guest.id}
                  onClick={() => setSelectedGuest(guest)}
                  className="cursor-pointer"
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                        {getGuestImage(guest.id) ? (
                          <img
                            key={`${guest.id}-${guestImageVersion}`}
                            src={getGuestImage(guest.id) || undefined}
                            alt={`${guest.firstName} ${guest.lastName}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <>
                            {guest.firstName[0]}
                            {guest.lastName[0]}
                          </>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {guest.firstName} {guest.lastName}
                        </p>
                        {guest.nationality && (
                          <p className="text-xs text-slate-500">{guest.nationality}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      {guest.email && <p className="text-slate-900">{guest.email}</p>}
                      {guest.phone && <p className="text-xs text-slate-500">{guest.phone}</p>}
                    </div>
                  </td>
                  <td>{guest.country || '-'}</td>
                  <td>{guest.totalStays}</td>
                  <td>{formatCurrency(guest.totalSpent)}</td>
                  <td>
                    {guest.vipStatus && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        VIP
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * pagination.limit + 1} to{' '}
            {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} guests
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-outline"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="btn-outline"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={closeAddGuestModal} />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900">Add New Guest</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createGuestMutation.mutate({
                  firstName: formData.get('firstName') as string,
                  lastName: formData.get('lastName') as string,
                  email: (formData.get('email') as string) || undefined,
                  phone: (formData.get('phone') as string) || undefined,
                  address: (formData.get('address') as string) || undefined,
                  city: (formData.get('city') as string) || undefined,
                  country: (formData.get('country') as string) || undefined,
                  idType: (formData.get('idType') as string) || undefined,
                  idNumber: (formData.get('idNumber') as string) || undefined,
                  nationality: (formData.get('nationality') as string) || undefined,
                  manualStays: Number(formData.get('manualStays') || 0),
                  preferredRoomTypeId: (formData.get('preferredRoomTypeId') as string) || undefined,
                });
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">First Name *</label>
                  <input name="firstName" required className="input" />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input name="lastName" required className="input" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Email</label>
                  <input name="email" type="email" className="input" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input name="phone" type="tel" className="input" />
                </div>
              </div>

              <div>
                <label className="label">Address</label>
                <input name="address" className="input" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">City</label>
                  <input name="city" className="input" />
                </div>
                <div>
                  <label className="label">Country</label>
                  <input name="country" className="input" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">ID Type</label>
                  <select name="idType" className="input">
                    <option value="">Select...</option>
                    <option value="Passport">Passport</option>
                    <option value="Driver's License">Driver's License</option>
                    <option value="National ID">National ID</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">ID Number</label>
                  <input name="idNumber" className="input" />
                </div>
              </div>

              <div>
                <label className="label">Nationality</label>
                <input name="nationality" className="input" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Total Stays</label>
                  <input name="manualStays" type="number" min={0} className="input" />
                </div>
                <div>
                  <label className="label">Preferred Room Type</label>
                  <select name="preferredRoomTypeId" className="input">
                    <option value="">Select...</option>
                    {roomTypes?.map((roomType) => (
                      <option key={roomType.id} value={roomType.id}>
                        {roomType.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeAddGuestModal}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGuestMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createGuestMutation.isPending ? 'Creating...' : 'Create Guest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setSelectedGuest(null)}
          />
          <div className="relative w-full max-w-6xl h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
            <button
              onClick={() => setSelectedGuest(null)}
              className="absolute right-4 top-4 z-10 rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="h-full overflow-y-auto p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between pr-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Reservation</p>
                <h2 className="text-2xl font-bold text-slate-900">Guest Profile</h2>
              </div>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  navigate(`/bookings?guestId=${selectedGuest.id}`);
                  setSelectedGuest(null);
                }}
              >
                View Bookings
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-12">
              <div className="card xl:col-span-3">
                <h3 className="text-base font-semibold text-slate-900">Profile</h3>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-base font-semibold text-primary-700">
                    {getGuestImage(selectedGuest.id) ? (
                      <img
                        key={`${selectedGuest.id}-${guestImageVersion}`}
                        src={getGuestImage(selectedGuest.id) || undefined}
                        alt={`${selectedGuest.firstName} ${selectedGuest.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        {selectedGuest.firstName[0]}
                        {selectedGuest.lastName[0]}
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900">
                      {selectedGuest.firstName} {selectedGuest.lastName}
                    </p>
                    <p className="text-sm text-slate-500">{selectedGuest.id}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                  <p className="text-sm text-slate-700">{selectedGuest.phone || '-'}</p>
                  <p className="text-sm text-slate-700">{selectedGuest.email || '-'}</p>
                </div>

                <h4 className="mt-5 text-sm font-semibold text-slate-900">Personal Information</h4>
                <div className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Date of Birth</p>
                    <p className="font-medium text-slate-800">-</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Gender</p>
                    <p className="font-medium text-slate-800">-</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Nationality</p>
                    <p className="font-medium text-slate-800">{selectedGuest.nationality || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Passport No</p>
                    <p className="font-medium text-slate-800">{selectedGuest.idNumber || '-'}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-primary-100 bg-primary-50 p-3">
                  <p className="text-xs text-slate-500">Loyalty Program</p>
                  <p className="mt-1 inline-flex rounded bg-primary-200 px-2 py-0.5 text-xs font-semibold text-primary-800">
                    {selectedGuest.vipStatus ? 'Platinum Member' : 'Member'}
                  </p>
                  <div className="mt-2 flex justify-between text-xs text-slate-600">
                    <span>{selectedGuest.totalStays} stays</span>
                    <span>{formatCurrency(selectedGuest.totalSpent)}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    ref={guestImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      onGuestImagePicked(selectedGuest.id, event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => guestImageInputRef.current?.click()}
                    className="btn-outline w-full"
                  >
                    Change guest photo
                  </button>
                </div>
              </div>

              <div className="card xl:col-span-6">
                <h3 className="text-base font-semibold text-slate-900">Booking Info</h3>
                {primaryBooking ? (
                  <>
                    <div className="mt-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Booking Confirmed
                    </div>
                    <p className="mt-2 text-3xl font-bold text-slate-900">Booking ID: {primaryBooking.bookingRef}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(primaryBooking.checkInDate)}</p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-slate-500">Room Type</p>
                        <p className="font-semibold text-slate-900">
                          {primaryBooking.room?.roomType.name || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Room Number</p>
                        <p className="font-semibold text-slate-900">
                          {primaryBooking.room?.number || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Price</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(primaryBooking.roomRate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Guests</p>
                        <p className="font-semibold text-slate-900">
                          {primaryBooking.numberOfAdults + primaryBooking.numberOfChildren}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Check In</p>
                        <p className="font-semibold text-slate-900">{formatDateTime(primaryBooking.checkInDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Check Out</p>
                        <p className="font-semibold text-slate-900">{formatDateTime(primaryBooking.checkOutDate)}</p>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <p className="text-xs text-slate-500">Notes</p>
                      <p className="text-sm text-slate-700">
                        {primaryBooking.specialRequests ||
                          selectedGuest.notes ||
                          'Guest requested extra pillows and towels.'}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No bookings available for this guest yet.</p>
                )}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="btn-primary"
                  >
                    Edit Guest
                  </button>
                  <button
                    className="btn-outline border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      const confirmed = window.confirm(
                        'Delete this guest? This will anonymize the guest record.'
                      );
                      if (confirmed) {
                        deleteGuestMutation.mutate(selectedGuest.id);
                      }
                    }}
                    disabled={deleteGuestMutation.isPending}
                  >
                    {deleteGuestMutation.isPending ? 'Deleting...' : 'Delete Guest'}
                  </button>
                </div>
              </div>

              <div className="card xl:col-span-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Room Info</h3>
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    onClick={() => {
                      if (primaryBooking?.room?.id) {
                        navigate('/rooms');
                        setSelectedGuest(null);
                      }
                    }}
                  >
                    View Detail
                  </button>
                </div>

                {primaryBooking?.room ? (
                  <>
                    <img
                      src={getRoomImage(primaryBooking.room)}
                      alt={`Room ${primaryBooking.room.number}`}
                      className="mt-3 h-40 w-full rounded-lg object-cover"
                    />
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span>{primaryBooking.room.floor}F</span>
                      <span>•</span>
                      <span>{primaryBooking.room.roomType.name}</span>
                      <span>•</span>
                      <span>{primaryBooking.numberOfAdults + primaryBooking.numberOfChildren} guests</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Room not assigned yet.
                  </div>
                )}

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Room and offer</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(primaryBooking?.totalAmount || 0)}
                    </span>
                  </div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Extras</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(0)}</span>
                  </div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Tax</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(0)}</span>
                  </div>
                  <div className="mt-3 border-t border-slate-200 pt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Total Price</span>
                    <span className="text-2xl font-bold text-slate-900">
                      {formatCurrency(primaryBooking?.totalAmount || selectedGuest.totalSpent)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card mt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Booking History</h3>
                  <p className="text-xs text-slate-500">Arrivals and departures</p>
                </div>
                <p className="text-xs text-slate-500">{bookingHistory.length} records</p>
              </div>

              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Booking ID</th>
                      <th>Booking Date</th>
                      <th>Room Type</th>
                      <th>Room Number</th>
                      <th>Check-In</th>
                      <th>Check-Out</th>
                      <th>Guests</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {bookingHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                          No booking history found.
                        </td>
                      </tr>
                    ) : (
                      bookingHistory.map((booking) => (
                        <tr key={booking.id}>
                          <td>
                            {booking.room ? (
                              <img
                                src={getRoomImage(booking.room)}
                                alt={`Room ${booking.room.number}`}
                                className="h-10 w-16 rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-16 rounded bg-slate-100" />
                            )}
                          </td>
                          <td>{booking.bookingRef}</td>
                          <td>{formatDateTime(booking.checkInDate)}</td>
                          <td>{booking.room?.roomType.name || '-'}</td>
                          <td>{booking.room?.number || '-'}</td>
                          <td>{formatDateTime(booking.checkInDate)}</td>
                          <td>{formatDateTime(booking.checkOutDate)}</td>
                          <td>{booking.numberOfAdults + booking.numberOfChildren}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {showEditModal && selectedGuest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowEditModal(false)} />
          <div className="relative mt-2 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900">Edit Guest</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                updateGuestMutation.mutate({
                  id: selectedGuest.id,
                  payload: {
                    firstName: formData.get('firstName') as string,
                    lastName: formData.get('lastName') as string,
                    email: (formData.get('email') as string) || undefined,
                    phone: (formData.get('phone') as string) || undefined,
                    address: (formData.get('address') as string) || undefined,
                    city: (formData.get('city') as string) || undefined,
                    country: (formData.get('country') as string) || undefined,
                    idType: (formData.get('idType') as string) || undefined,
                    idNumber: (formData.get('idNumber') as string) || undefined,
                    nationality: (formData.get('nationality') as string) || undefined,
                    manualStays: Number(formData.get('manualStays') || 0),
                    preferredRoomTypeId: (formData.get('preferredRoomTypeId') as string) || undefined,
                    vipStatus: formData.get('vipStatus') === 'on',
                    notes: (formData.get('notes') as string) || undefined,
                  },
                });
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">First Name *</label>
                  <input name="firstName" defaultValue={selectedGuest.firstName} className="input" required />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input name="lastName" defaultValue={selectedGuest.lastName} className="input" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Email</label>
                  <input name="email" defaultValue={selectedGuest.email || ''} className="input" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input name="phone" defaultValue={selectedGuest.phone || ''} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <input name="address" defaultValue={selectedGuest.address || ''} className="input" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">City</label>
                  <input name="city" defaultValue={selectedGuest.city || ''} className="input" />
                </div>
                <div>
                  <label className="label">Country</label>
                  <input name="country" defaultValue={selectedGuest.country || ''} className="input" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">ID Type</label>
                  <select name="idType" defaultValue={selectedGuest.idType || ''} className="input">
                    <option value="">Select...</option>
                    <option value="Passport">Passport</option>
                    <option value="Driver's License">Driver's License</option>
                    <option value="National ID">National ID</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">ID Number</label>
                  <input name="idNumber" defaultValue={selectedGuest.idNumber || ''} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Nationality</label>
                <input name="nationality" defaultValue={selectedGuest.nationality || ''} className="input" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Total Stays</label>
                  <input
                    name="manualStays"
                    type="number"
                    min={0}
                    defaultValue={selectedGuest.manualStays ?? 0}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Preferred Room Type</label>
                  <select
                    name="preferredRoomTypeId"
                    defaultValue={selectedGuest.preferredRoomTypeId || ''}
                    className="input"
                  >
                    <option value="">Select...</option>
                    {roomTypes?.map((roomType) => (
                      <option key={roomType.id} value={roomType.id}>
                        {roomType.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input name="vipStatus" type="checkbox" defaultChecked={selectedGuest.vipStatus} />
                <span className="text-sm text-slate-600">VIP guest</span>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea name="notes" rows={3} defaultValue={selectedGuest.notes || ''} className="input" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-outline flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={updateGuestMutation.isPending} className="btn-primary flex-1">
                  {updateGuestMutation.isPending ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

