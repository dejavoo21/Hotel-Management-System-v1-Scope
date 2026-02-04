import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bookingService, guestService, roomService } from '@/services';
import type { Booking, Guest, Room } from '@/types';
import type { CreateBookingData } from '@/services/bookings';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { formatEnumLabel } from '@/utils';
import { appendAuditLog } from '@/utils/auditLog';

type StatusFilter = 'all' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [guestIdFilter, setGuestIdFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState('');
  const [bookingCardInfo, setBookingCardInfo] = useState({ number: '', expiry: '', cvv: '' });

  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [roomRateValue, setRoomRateValue] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const validStatusFilters: StatusFilter[] = [
    'all',
    'CONFIRMED',
    'CHECKED_IN',
    'CHECKED_OUT',
    'CANCELLED',
    'NO_SHOW',
  ];
  const parseStatusFilter = (value: string | null): StatusFilter | null => {
    if (!value) return null;
    return validStatusFilters.includes(value as StatusFilter) ? (value as StatusFilter) : null;
  };
  const mapFilterToStatus = (filter: string | null): StatusFilter | null => {
    if (!filter) return null;
    switch (filter.toLowerCase()) {
      case 'arrivals':
        return 'CONFIRMED';
      case 'departures':
      case 'checked-in':
        return 'CHECKED_IN';
      default:
        return null;
    }
  };
  const openCreateModal = () => {
    setBookingPaymentMethod('');
    setBookingCardInfo({ number: '', expiry: '', cvv: '' });
    setShowCreateModal(true);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('action', 'new');
      return params;
    });
  };
  const closeCreateModal = () => {
    setShowCreateModal(false);
    if (searchParams.get('action') === 'new') {
      const params = new URLSearchParams(searchParams);
      params.delete('action');
      setSearchParams(params, { replace: true });
    }
  };

  useEffect(() => {
    const statusParam = parseStatusFilter(searchParams.get('status'));
    if (statusParam) {
      setStatusFilter(statusParam);
      return;
    }
    const mapped = mapFilterToStatus(searchParams.get('filter'));
    if (mapped) {
      setStatusFilter(mapped);
    }
  }, [searchParams]);

  useEffect(() => {
    const guestIdParam = searchParams.get('guestId');
    setGuestIdFilter(guestIdParam || null);
    if (guestIdParam) {
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    setShowCreateModal(searchParams.get('action') === 'new');
  }, [searchParams]);
  useEffect(() => {
    if (!showCreateModal) {
      setBookingPaymentMethod('');
      setBookingCardInfo({ number: '', expiry: '', cvv: '' });
    }
  }, [showCreateModal]);
  const isBookingCardMethod = ['CREDIT_CARD', 'DEBIT_CARD'].includes(bookingPaymentMethod);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['bookings', statusFilter, searchQuery, page, guestIdFilter],
    queryFn: () =>
      bookingService.getBookings({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
        guestId: guestIdFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const { data: roomTypes } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: roomService.getRoomTypes,
  });

  const { data: guestResults } = useQuery({
    queryKey: ['guestSearch', guestSearch],
    queryFn: () => guestService.searchGuests(guestSearch),
    enabled: guestSearch.length >= 2,
  });

  const createBookingMutation = useMutation({
    mutationFn: bookingService.createBooking,
    onSuccess: (createdBooking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking created');
      appendAuditLog({
        action: 'BOOKING_CREATED',
        actorId: user?.id,
        actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
        targetId: createdBooking.id,
        targetLabel: createdBooking.bookingRef,
        details: {
          guest: `${createdBooking.guest.firstName} ${createdBooking.guest.lastName}`,
          checkInDate: createdBooking.checkInDate,
          checkOutDate: createdBooking.checkOutDate,
          roomType: createdBooking.room?.roomType?.name || null,
          status: createdBooking.status,
        },
      });
      // Navigate to bookings if guest was selected
      if (guestIdFilter) {
        setPage(1);
      }
      closeCreateModal();
    },
    onError: () => {
      toast.error('Failed to create booking');
    },
  });

  const bookings = bookingsData?.data || [];
  const pagination = bookingsData?.pagination;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.hotel?.currency || 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return 'status-confirmed';
      case 'CHECKED_IN':
        return 'status-checked-in';
      case 'CHECKED_OUT':
        return 'status-checked-out';
      case 'CANCELLED':
        return 'status-cancelled';
      case 'NO_SHOW':
        return 'status-cancelled';
    }
  };

  const getSourceBadge = (source: Booking['source']) => {
    const colors: Record<Booking['source'], string> = {
      DIRECT: 'bg-primary-50 text-primary-700',
      BOOKING_COM: 'bg-blue-50 text-blue-700',
      EXPEDIA: 'bg-yellow-50 text-yellow-700',
      AIRBNB: 'bg-red-50 text-red-700',
      WALK_IN: 'bg-emerald-50 text-emerald-700',
      PHONE: 'bg-purple-50 text-purple-700',
      CORPORATE: 'bg-slate-100 text-slate-700',
      WEBSITE: 'bg-indigo-50 text-indigo-700',
    };
    return `status-pill ${colors[source]}`;
  };

  const selectedRoomType = useMemo(
    () => roomTypes?.find((roomType) => roomType.id === roomTypeId),
    [roomTypes, roomTypeId]
  );

  useEffect(() => {
    if (selectedRoomType) {
      setRoomRateValue(String(selectedRoomType.baseRate));
    } else {
      setRoomRateValue('');
    }
  }, [selectedRoomType]);

  useEffect(() => {
    if (!showCreateModal) {
      setRoomRateValue('');
    }
  }, [showCreateModal]);

  const handleCheckAvailability = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const checkInDate = formData.get('checkInDate') as string;
    const checkOutDate = formData.get('checkOutDate') as string;

    if (!checkInDate || !checkOutDate) {
      return;
    }

    const availability = await bookingService.checkAvailability({
      checkInDate,
      checkOutDate,
      roomTypeId: roomTypeId || undefined,
    });
    setAvailableRooms(availability.rooms || []);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage reservations and check-ins
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Booking
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
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
              placeholder="Search by guest name, booking ref, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="input w-auto"
          >
            <option value="all">All Status</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="CHECKED_OUT">Checked Out</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : bookings.length === 0 ? (
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-slate-500">No bookings found</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Booking Ref</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Status</th>
                <th>Source</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  onClick={() => navigate(`/bookings/${booking.id}`)}
                  className="cursor-pointer"
                >
                  <td className="font-medium text-primary-600">{booking.bookingRef}</td>
                  <td>
                    <div>
                      <p className="font-medium text-slate-900">
                        {booking.guest.firstName} {booking.guest.lastName}
                      </p>
                      {booking.guest.email && (
                        <p className="text-xs text-slate-500">{booking.guest.email}</p>
                      )}
                    </div>
                  </td>
                  <td>{booking.room?.number || '-'}</td>
                  <td>{formatDate(booking.checkInDate)}</td>
                  <td>{formatDate(booking.checkOutDate)}</td>
                  <td>
                    <span className={getStatusBadge(booking.status)}>
                      {formatEnumLabel(booking.status)}
                    </span>
                  </td>
                  <td>
                    <span className={getSourceBadge(booking.source)}>
                      {formatEnumLabel(booking.source)}
                    </span>
                  </td>
                  <td className="text-sm text-slate-600">
                    {booking.paymentMethod ? formatEnumLabel(booking.paymentMethod) : '-'}
                  </td>
                  <td>{formatCurrency(booking.totalAmount)}</td>
                  <td>
                    {booking.totalAmount - booking.paidAmount > 0 ? (
                      <span className="text-red-600">
                        {formatCurrency(booking.totalAmount - booking.paidAmount)}
                      </span>
                    ) : (
                      <span className="text-emerald-600">Paid</span>
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
            {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} bookings
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

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={closeCreateModal} />
          <div className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900">New Booking</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const rawPaymentMethod = formData.get('paymentMethod');
                const paymentMethod =
                  typeof rawPaymentMethod === 'string' && rawPaymentMethod.length > 0
                    ? (rawPaymentMethod as CreateBookingData['paymentMethod'])
                    : undefined;
                const roomRate = Number(roomRateValue || selectedRoomType?.baseRate || 0);
                const payload: CreateBookingData = {
                  guestId: selectedGuest?.id,
                  guest: selectedGuest
                    ? undefined
                    : {
                        firstName: formData.get('guestFirstName') as string,
                        lastName: formData.get('guestLastName') as string,
                        email: (formData.get('guestEmail') as string) || undefined,
                        phone: (formData.get('guestPhone') as string) || undefined,
                      },
                  roomTypeId: roomTypeId || undefined,
                  roomId: (formData.get('roomId') as string) || undefined,
                  checkInDate: formData.get('checkInDate') as string,
                  checkOutDate: formData.get('checkOutDate') as string,
                  numberOfAdults: Number(formData.get('adults') || 1),
                  numberOfChildren: Number(formData.get('children') || 0),
                  source: formData.get('source') as string,
                  paymentMethod,
                  specialRequests: (formData.get('requests') as string) || undefined,
                  roomRate,
                };
                createBookingMutation.mutate(payload);
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Guest search</label>
                  <input
                    value={guestSearch}
                    onChange={(event) => setGuestSearch(event.target.value)}
                    className="input"
                    placeholder="Search guests..."
                  />
                  {guestResults && guestResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                      {guestResults.map((guest) => (
                        <button
                          type="button"
                          key={guest.id}
                          onClick={() => {
                            setSelectedGuest(guest);
                            setGuestSearch(`${guest.firstName} ${guest.lastName}`);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          {guest.firstName} {guest.lastName} • {guest.email || '-'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Room type</label>
                  <select
                    value={roomTypeId}
                    onChange={(event) => setRoomTypeId(event.target.value)}
                    className="input"
                  >
                    <option value="">Select room type</option>
                    {roomTypes?.map((roomType) => (
                      <option key={roomType.id} value={roomType.id}>
                        {roomType.name} ({formatCurrency(roomType.baseRate)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedGuest && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">First name *</label>
                    <input name="guestFirstName" className="input" required={!selectedGuest} />
                  </div>
                  <div>
                    <label className="label">Last name *</label>
                    <input name="guestLastName" className="input" required={!selectedGuest} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input name="guestEmail" className="input" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input name="guestPhone" className="input" />
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Check-in</label>
                  <input name="checkInDate" type="date" className="input" required onBlur={(event) => handleCheckAvailability(event.currentTarget.form!)} />
                </div>
                <div>
                  <label className="label">Check-out</label>
                  <input name="checkOutDate" type="date" className="input" required onBlur={(event) => handleCheckAvailability(event.currentTarget.form!)} />
                </div>
              </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="label">Adults</label>
                    <input name="adults" type="number" min={1} defaultValue={1} className="input" />
                  </div>
                  <div>
                    <label className="label">Children</label>
                    <input name="children" type="number" min={0} defaultValue={0} className="input" />
                  </div>
                  <div>
                    <label className="label">Room rate</label>
                    <input
                      name="roomRate"
                      type="number"
                      min={0}
                      value={roomRateValue}
                      onChange={(event) => setRoomRateValue(event.target.value)}
                      className="input"
                    />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label">Source</label>
                  <select name="source" className="input" defaultValue="DIRECT">
                    <option value="DIRECT">Direct</option>
                    <option value="BOOKING_COM">Booking.com</option>
                    <option value="EXPEDIA">Expedia</option>
                    <option value="AIRBNB">Airbnb</option>
                    <option value="WALK_IN">Walk-in</option>
                    <option value="PHONE">Phone</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="WEBSITE">Website</option>
                  </select>
                </div>
                <div>
                  <label className="label">Payment method</label>
                  <select
                name="paymentMethod"
                value={bookingPaymentMethod}
                onChange={(event) => setBookingPaymentMethod(event.target.value)}
                className="input"
              >
                    <option value="">Select method</option>
                    <option value="CASH">Cash</option>
                    <option value="CREDIT_CARD">Credit card</option>
                    <option value="DEBIT_CARD">Debit card</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="STRIPE">Stripe</option>
                    <option value="CHECK">Check</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Assign room (optional)</label>
                  <select name="roomId" className="input">
                    <option value="">Unassigned</option>
                    {availableRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.number} - {room.roomType.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                {isBookingCardMethod && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="label">Card number</label>
                    <input
                      name="cardNumber"
                      value={bookingCardInfo.number}
                      onChange={(event) =>
                        setBookingCardInfo((prev) => ({ ...prev, number: event.target.value }))
                      }
                      className="input"
                      placeholder="0000 0000 0000 0000"
                    />
                  </div>
                  <div>
                    <label className="label">Expiry</label>
                    <input
                      name="cardExpiry"
                      value={bookingCardInfo.expiry}
                      onChange={(event) =>
                        setBookingCardInfo((prev) => ({ ...prev, expiry: event.target.value }))
                      }
                      className="input"
                      placeholder="MM/YY"
                    />
                  </div>
                  <div>
                    <label className="label">CVV</label>
                    <input
                      name="cardCvv"
                      value={bookingCardInfo.cvv}
                      onChange={(event) =>
                        setBookingCardInfo((prev) => ({ ...prev, cvv: event.target.value }))
                      }
                      className="input"
                      placeholder="123"
                    />
                  </div>
                </div>
              )}
              <label className="label">Special requests</label>
                <textarea name="requests" rows={3} className="input" />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBookingMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createBookingMutation.isPending ? 'Creating...' : 'Create booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
