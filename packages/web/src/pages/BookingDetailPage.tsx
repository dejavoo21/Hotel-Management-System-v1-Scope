import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService, roomService, invoiceService, paymentService } from '@/services';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { formatEnumLabel } from '@/utils';
import { getApiError } from '@/services/api';
import { appendAuditLog } from '@/utils/auditLog';
import { getRoomImage } from '@/utils/mediaPrefs';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingService.getBooking(id!),
    enabled: !!id,
  });

  const { data: availableRooms } = useQuery({
    queryKey: ['availableRooms', booking?.checkInDate, booking?.checkOutDate],
    queryFn: () =>
      roomService.getRooms({
        status: 'AVAILABLE',
        housekeepingStatus: 'CLEAN',
        limit: 50,
      }),
    enabled: !!booking && booking.status === 'CONFIRMED',
  });

  const totalAmount = Number(booking?.totalAmount ?? 0);
  const paidAmount = Number(booking?.paidAmount ?? 0);
  const balance = Math.max(0, totalAmount - paidAmount);

  const checkInMutation = useMutation({
    mutationFn: () =>
      bookingService.checkIn(id!, {
        roomId: selectedRoomId || booking?.room?.id || '',
        idVerified: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      toast.success('Guest checked in successfully');
      if (booking) {
        appendAuditLog({
          action: 'BOOKING_CHECKED_IN',
          actorId: user?.id,
          actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
          targetId: booking.id,
          targetLabel: booking.bookingRef,
          details: {
            guest: `${booking.guest.firstName} ${booking.guest.lastName}`,
            room: booking.room?.number || null,
          },
        });
      }
      setShowCheckInModal(false);
    },
    onError: () => {
      toast.error('Failed to check in guest');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => bookingService.checkOut(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      toast.success('Guest checked out successfully');
      if (booking) {
        appendAuditLog({
          action: 'BOOKING_CHECKED_OUT',
          actorId: user?.id,
          actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
          targetId: booking.id,
          targetLabel: booking.bookingRef,
          details: {
            guest: `${booking.guest.firstName} ${booking.guest.lastName}`,
          },
        });
      }
      setShowCheckOutModal(false);
    },
    onError: () => {
      toast.error('Failed to check out guest');
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (bookingId: string) => invoiceService.createForBooking(bookingId),
    onSuccess: (createdInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      toast.success('Invoice created');
      if (booking) {
        appendAuditLog({
          action: 'INVOICE_CREATED',
          actorId: user?.id,
          actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
          targetId: createdInvoice.id,
          targetLabel: createdInvoice.invoiceNo,
          details: {
            bookingRef: booking.bookingRef,
            total: createdInvoice.total,
            status: createdInvoice.status,
          },
        });
      }
    },
    onError: () => {
      toast.error('Failed to create invoice');
    },
  });

  const emailInvoiceMutation = useMutation({
    mutationFn: (payload: { invoiceId: string; recipientEmail?: string }) =>
      invoiceService.sendEmail(payload.invoiceId, payload.recipientEmail),
    onSuccess: () => {
      toast.success('Invoice emailed');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to email invoice';
      toast.error(message);
    },
  });

  const emailReceiptMutation = useMutation({
    mutationFn: (payload: { paymentId: string; recipientEmail?: string }) =>
      paymentService.emailReceipt(payload.paymentId, payload.recipientEmail),
    onSuccess: () => {
      toast.success('Receipt emailed');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to email receipt';
      toast.error(message);
    },
  });

  const paymentMethods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER'] as const;
  const [paymentForm, setPaymentForm] = useState({
    amount: balance,
    method: 'CASH',
    reference: '',
    notes: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
  });

  useEffect(() => {
    setPaymentForm((prev) => ({
      ...prev,
      amount: balance > 0 ? balance : prev.amount,
    }));
  }, [balance]);

  const isCardMethod =
    paymentForm.method === 'CREDIT_CARD' || paymentForm.method === 'DEBIT_CARD';

  const recordPaymentMutation = useMutation({
    mutationFn: () => {
      if (!booking) {
        return Promise.reject(new Error('Booking data is not available'));
      }
      return bookingService.addPayment(booking.id, {
        amount: Number(paymentForm.amount) || 0,
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: (() => {
          const parts = [];
          if (paymentForm.notes) {
            parts.push(paymentForm.notes);
          }
          if (
            (paymentForm.method === 'CREDIT_CARD' || paymentForm.method === 'DEBIT_CARD') &&
            paymentForm.cardNumber
          ) {
            parts.push(`Card ending ${paymentForm.cardNumber.slice(-4)}`);
          }
          return parts.length > 0 ? parts.join(' · ') : undefined;
        })(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      toast.success('Payment recorded');
      if (booking) {
        appendAuditLog({
          action: 'PAYMENT_RECORDED',
          actorId: user?.id,
          actorName: user ? `${user.firstName} ${user.lastName}` : 'System',
          targetId: booking.id,
          targetLabel: booking.bookingRef,
          details: {
            amount: Number(paymentForm.amount) || 0,
            method: paymentForm.method,
            reference: paymentForm.reference || null,
          },
        });
      }
      setShowPaymentModal(false);
      setPaymentForm((prev) => ({
        ...prev,
        reference: '',
        notes: '',
        cardNumber: '',
        cardExpiry: '',
        cardCvv: '',
      }));
    },
    onError: (error: unknown) => {
      const { message } = getApiError(error);
      toast.error(message);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.hotel?.currency || 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      CONFIRMED: 'status-confirmed',
      CHECKED_IN: 'status-checked-in',
      CHECKED_OUT: 'status-checked-out',
      CANCELLED: 'status-cancelled',
      NO_SHOW: 'status-cancelled',
    };
    return classes[status] || 'status-pill bg-slate-100 text-slate-700';
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-900">Booking not found</h2>
        <button onClick={() => navigate('/bookings')} className="btn-primary mt-4">
          Back to Bookings
        </button>
      </div>
    );
  }

  const nights = Math.ceil(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const latestInvoice = booking.invoices && booking.invoices.length > 0
    ? [...booking.invoices].sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())[0]
    : undefined;

  const completedPayments = booking.payments?.filter((payment) => payment.status === 'COMPLETED') || [];
  const latestCompletedPayment = completedPayments.length > 0
    ? [...completedPayments].sort(
        (a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
      )[0]
    : undefined;
  const showReceipt = Boolean(latestCompletedPayment && balance <= 0);

  const handleDownloadInvoice = async () => {
    if (!latestInvoice) {
      toast.error('No invoice available');
      return;
    }
    const blob = await invoiceService.downloadPdf(latestInvoice.id);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `invoice-${latestInvoice.invoiceNo}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handlePrintInvoice = async () => {
    if (!latestInvoice) {
      toast.error('No invoice available');
      return;
    }
    try {
      const blob = await invoiceService.downloadPdf(latestInvoice.id);
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.addEventListener(
          'load',
          () => {
            printWindow.focus();
            printWindow.print();
          },
          { once: true }
        );
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        URL.revokeObjectURL(url);
        toast.error('Unable to open invoice window');
      }
    } catch {
      toast.error('Failed to print invoice');
    }
  };

  const handleDownloadReceipt = async () => {
    if (!latestCompletedPayment) {
      toast.error('No receipt available');
      return;
    }
    const blob = await paymentService.downloadReceipt(latestCompletedPayment.id);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `receipt-${latestCompletedPayment.id}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handlePrintReceipt = async () => {
    if (!latestCompletedPayment) {
      toast.error('No receipt available');
      return;
    }
    try {
      const blob = await paymentService.downloadReceipt(latestCompletedPayment.id);
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.addEventListener(
          'load',
          () => {
            printWindow.focus();
            printWindow.print();
          },
          { once: true }
        );
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        URL.revokeObjectURL(url);
        toast.error('Unable to open receipt window');
      }
    } catch {
      toast.error('Failed to print receipt');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/bookings')}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{booking.bookingRef}</h1>
              <span className={getStatusBadge(booking.status)}>
                {formatEnumLabel(booking.status)}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Created on {formatDate(booking.checkInDate)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {booking.status === 'CONFIRMED' && (
            <button onClick={() => setShowCheckInModal(true)} className="btn-success">
              Check In
            </button>
          )}
          {booking.status === 'CHECKED_IN' && (
            <button onClick={() => setShowCheckOutModal(true)} className="btn-primary">
              Check Out
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Guest Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900">Guest Information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Name</p>
                <p className="font-medium text-slate-900">
                  {booking.guest.firstName} {booking.guest.lastName}
                  {booking.guest.vipStatus && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      VIP
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium text-slate-900">{booking.guest.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="font-medium text-slate-900">{booking.guest.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">ID</p>
                <p className="font-medium text-slate-900">
                  {booking.guest.idType && booking.guest.idNumber
                    ? `${booking.guest.idType}: ${booking.guest.idNumber}`
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Stay Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900">Stay Details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-slate-500">Check-in</p>
                <p className="font-medium text-slate-900">{formatDate(booking.checkInDate)}</p>
                {booking.actualCheckIn && (
                  <p className="text-xs text-slate-500">
                    Actual: {formatDateTime(booking.actualCheckIn)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-slate-500">Check-out</p>
                <p className="font-medium text-slate-900">{formatDate(booking.checkOutDate)}</p>
                {booking.actualCheckOut && (
                  <p className="text-xs text-slate-500">
                    Actual: {formatDateTime(booking.actualCheckOut)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-slate-500">Nights</p>
                <p className="font-medium text-slate-900">{nights}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Guests</p>
                <p className="font-medium text-slate-900">
                  {booking.numberOfAdults} Adults
                  {booking.numberOfChildren > 0 && `, ${booking.numberOfChildren} Children`}
                </p>
              </div>
            </div>

            {booking.room && (
              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Assigned Room</p>
                <p className="font-medium text-slate-900">
                  Room {booking.room.number} - {booking.room.roomType.name}
                </p>
              </div>
            )}

            {booking.specialRequests && (
              <div className="mt-4">
                <p className="text-sm text-slate-500">Special Requests</p>
                <p className="text-slate-700">{booking.specialRequests}</p>
              </div>
            )}
          </div>

          {/* Charges */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Charges</h2>
              {booking.status === 'CHECKED_IN' && (
                <button onClick={() => setShowChargeModal(true)} className="btn-outline text-sm">
                  Add Charge
                </button>
              )}
            </div>
            <div className="mt-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                    <th className="pb-2">Description</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Unit</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Room charge */}
                  <tr>
                    <td className="py-2 font-medium">Room - {booking.room?.roomType?.name || 'Standard'}</td>
                    <td className="py-2 text-slate-500">Room</td>
                    <td className="py-2 text-right">{nights}</td>
                    <td className="py-2 text-right">{formatCurrency(booking.roomRate)}</td>
                    <td className="py-2 text-right font-medium">
                      {formatCurrency(booking.roomRate * nights)}
                    </td>
                  </tr>
                  {/* Additional charges */}
                  {booking.charges?.map((charge) => (
                    <tr key={charge.id} className={charge.isVoided ? 'line-through opacity-50' : ''}>
                      <td className="py-2 font-medium">{charge.description}</td>
                      <td className="py-2 text-slate-500">{charge.category}</td>
                      <td className="py-2 text-right">{charge.quantity}</td>
                      <td className="py-2 text-right">{formatCurrency(charge.unitPrice)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(charge.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={4} className="pt-3 text-right font-semibold">
                      Total
                    </td>
                    <td className="pt-3 text-right font-bold text-slate-900">
                      {formatCurrency(booking.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payments */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Payments</h2>
              <button onClick={() => setShowPaymentModal(true)} className="btn-outline text-sm">
                Record Payment
              </button>
            </div>
            <div className="mt-4">
              {booking.payments && booking.payments.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Method</th>
                      <th className="pb-2">Reference</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Amount</th>
                      <th className="pb-2 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {booking.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="py-2">{formatDateTime(payment.processedAt)}</td>
                        <td className="py-2">{formatEnumLabel(payment.method)}</td>
                        <td className="py-2 text-slate-500">{payment.reference || '-'}</td>
                        <td className="py-2">
                          <span
                            className={`status-pill ${
                              payment.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : payment.status === 'REFUNDED'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {payment.status}
                          </span>
                        </td>
                        <td className="py-2 text-right font-medium">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            className="btn-ghost text-xs"
                            onClick={() =>
                              emailReceiptMutation.mutate({
                                paymentId: payment.id,
                                recipientEmail: booking.guest.email,
                              })
                            }
                            disabled={emailReceiptMutation.isPending}
                          >
                            Email
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-500">No payments recorded</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {booking.room ? (
            <div className="card">
              <h3 className="font-semibold text-slate-900">Room Info</h3>
              <img
                src={getRoomImage(booking.room)}
                alt={`Room ${booking.room.number}`}
                className="mt-3 h-40 w-full rounded-xl object-cover"
              />
              <div className="mt-3 text-sm">
                <div className="font-semibold text-slate-900">Room {booking.room.number}</div>
                <div className="text-slate-500">{booking.room.roomType.name}</div>
              </div>
            </div>
          ) : null}

          {/* Balance */}
          <div className={`card ${balance > 0 ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}`}>
            <p className="text-sm text-slate-500">Balance Due</p>
            <p className={`text-3xl font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatCurrency(balance)}
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total</span>
                <span className="font-medium">{formatCurrency(booking.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid</span>
                <span className="font-medium text-emerald-600">
                  -{formatCurrency(booking.paidAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Booking Info */}
          <div className="card">
            <h3 className="font-semibold text-slate-900">Booking Info</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Source</span>
                <span className="font-medium">{formatEnumLabel(booking.source)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment method</span>
                <span className="font-medium">
                  {booking.paymentMethod ? formatEnumLabel(booking.paymentMethod) : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Room Rate</span>
                <span className="font-medium">{formatCurrency(booking.roomRate)}/night</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-slate-900">Invoice & Receipts</h3>
            <p className="mt-1 text-sm text-slate-500">
              Share invoices and payment receipts with the guest.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              {showReceipt && latestCompletedPayment ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Receipt</span>
                    <span className="font-medium">
                      {latestCompletedPayment.reference || latestCompletedPayment.id}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-outline flex-1" onClick={handleDownloadReceipt}>
                      Download PDF
                    </button>
                    <button className="btn-ghost flex-1" onClick={handlePrintReceipt}>
                      Print Receipt
                    </button>
                    <button
                      className="btn-primary flex-1"
                      onClick={() =>
                        emailReceiptMutation.mutate({
                          paymentId: latestCompletedPayment.id,
                          recipientEmail: booking.guest.email,
                        })
                      }
                      disabled={emailReceiptMutation.isPending}
                    >
                      {emailReceiptMutation.isPending ? 'Sending...' : 'Email Receipt'}
                    </button>
                  </div>
                </>
              ) : latestInvoice ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Invoice</span>
                    <span className="font-medium">{latestInvoice.invoiceNo}</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-outline flex-1" onClick={handleDownloadInvoice}>
                      Download PDF
                    </button>
                    <button className="btn-ghost flex-1" onClick={handlePrintInvoice}>
                      Print Invoice
                    </button>
                    <button
                      className="btn-primary flex-1"
                      onClick={() =>
                        emailInvoiceMutation.mutate({
                          invoiceId: latestInvoice.id,
                          recipientEmail: booking.guest.email,
                        })
                      }
                      disabled={emailInvoiceMutation.isPending}
                    >
                      {emailInvoiceMutation.isPending ? 'Sending...' : 'Email Invoice'}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="btn-primary w-full"
                  onClick={() => createInvoiceMutation.mutate(booking.id)}
                  disabled={createInvoiceMutation.isPending}
                >
                  {createInvoiceMutation.isPending ? 'Generating...' : 'Generate Invoice'}
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          {booking.internalNotes && (
            <div className="card bg-amber-50">
              <h3 className="font-semibold text-amber-900">Internal Notes</h3>
              <p className="mt-2 text-sm text-amber-800">{booking.internalNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Check-in Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowCheckInModal(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Check In Guest</h2>
            <p className="mt-1 text-sm text-slate-500">
              {booking.guest.firstName} {booking.guest.lastName}
            </p>

            <div className="mt-6 space-y-4">
              {!booking.room && (
                <div>
                  <label className="label">Assign Room</label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="input"
                  >
                    <option value="">Select a room</option>
                    {availableRooms?.data?.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.number} - {room.roomType.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-lg bg-slate-50 p-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600"
                    defaultChecked
                  />
                  <span className="text-sm text-slate-700">ID verified</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCheckInModal(false)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => checkInMutation.mutate()}
                disabled={checkInMutation.isPending || (!booking.room && !selectedRoomId)}
                className="btn-success flex-1"
              >
                {checkInMutation.isPending ? 'Checking in...' : 'Check In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-out Modal */}
      {showCheckOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowCheckOutModal(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Check Out Guest</h2>
            <p className="mt-1 text-sm text-slate-500">
              {booking.guest.firstName} {booking.guest.lastName} - Room {booking.room?.number}
            </p>

            <div className="mt-6">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-medium">{formatCurrency(booking.totalAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-500">Paid</span>
                  <span className="font-medium">{formatCurrency(booking.paidAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-medium">Balance Due</span>
                  <span className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>

              {balance > 0 && (
                <p className="mt-4 text-sm text-amber-600">
                  Note: There is an outstanding balance of {formatCurrency(balance)}
                </p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCheckOutModal(false)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => checkOutMutation.mutate()}
                disabled={checkOutMutation.isPending}
                className="btn-primary flex-1"
              >
                {checkOutMutation.isPending ? 'Checking out...' : 'Check Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setShowPaymentModal(false)}
          />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              recordPaymentMutation.mutate();
            }}
            className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-bold text-slate-900">Record Payment</h2>
            <p className="mt-1 text-sm text-slate-500">Add a payment against this booking.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="label">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: Number(event.target.value),
                    }))
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Payment method</label>
                <select
                  value={paymentForm.method}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, method: event.target.value }))
                  }
                  className="input"
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {formatEnumLabel(method)}
                    </option>
                  ))}
                </select>
              </div>

              {isCardMethod && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="label">Card number</label>
                    <input
                      type="text"
                      value={paymentForm.cardNumber}
                      onChange={(event) =>
                        setPaymentForm((prev) => ({ ...prev, cardNumber: event.target.value }))
                      }
                      className="input"
                      placeholder="•••• •••• •••• 1234"
                    />
                  </div>
                  <div>
                    <label className="label">Expiry</label>
                    <input
                      type="text"
                      value={paymentForm.cardExpiry}
                      onChange={(event) =>
                        setPaymentForm((prev) => ({ ...prev, cardExpiry: event.target.value }))
                      }
                      className="input"
                      placeholder="MM/YY"
                    />
                  </div>
                  <div>
                    <label className="label">CVV</label>
                    <input
                      type="text"
                      value={paymentForm.cardCvv}
                      onChange={(event) =>
                        setPaymentForm((prev) => ({ ...prev, cardCvv: event.target.value }))
                      }
                      className="input"
                      placeholder="123"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Reference</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, reference: event.target.value }))
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className="input"
                  rows={3}
                  placeholder="Add any internal notes..."
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordPaymentMutation.isPending}
                className="btn-primary flex-1"
              >
                {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

