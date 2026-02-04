import api from './api';
import type { Booking, Charge, Payment, Invoice, PaginatedResponse } from '@/types';

export interface BookingFilters {
  status?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  guestId?: string;
  roomId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateBookingData {
  guestId?: string;
  guest?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  roomId?: string;
  roomTypeId?: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfAdults: number;
  numberOfChildren?: number;
  source?: string;
  paymentMethod?: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'STRIPE' | 'CHECK' | 'OTHER';
  specialRequests?: string;
  internalNotes?: string;
  roomRate: number;
}

export interface UpdateBookingData {
  roomId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  numberOfAdults?: number;
  numberOfChildren?: number;
  status?: string;
  specialRequests?: string;
  internalNotes?: string;
  roomRate?: number;
  paymentMethod?: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'STRIPE' | 'CHECK' | 'OTHER';
}

export interface CheckInData {
  roomId: string;
  idVerified?: boolean;
  notes?: string;
}

export interface CheckOutData {
  processPayment?: boolean;
  paymentMethod?: string;
  paymentAmount?: number;
  notes?: string;
}

export interface AvailabilityQuery {
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: string;
}

export const bookingService = {
  async getBookings(filters?: BookingFilters): Promise<PaginatedResponse<Booking>> {
    const response = await api.get('/bookings', { params: filters });
    return response.data;
  },

  async getBooking(id: string): Promise<Booking> {
    const response = await api.get(`/bookings/${id}`);
    return response.data.data;
  },

  async createBooking(data: CreateBookingData): Promise<Booking> {
    const response = await api.post('/bookings', data);
    return response.data.data;
  },

  async updateBooking(id: string, data: UpdateBookingData): Promise<Booking> {
    const response = await api.patch(`/bookings/${id}`, data);
    return response.data.data;
  },

  async deleteBooking(id: string): Promise<void> {
    await api.delete(`/bookings/${id}`);
  },

  async checkIn(id: string, data: CheckInData): Promise<Booking> {
    const response = await api.post(`/bookings/${id}/check-in`, data);
    return response.data.data;
  },

  async checkOut(id: string, data?: CheckOutData): Promise<Booking> {
    const response = await api.post(`/bookings/${id}/check-out`, data);
    return response.data.data;
  },

  async cancelBooking(id: string, reason?: string): Promise<void> {
    await api.delete(`/bookings/${id}`, { data: { reason } });
  },

  async checkAvailability(query: AvailabilityQuery): Promise<{ available: boolean; rooms: any[] }> {
    const response = await api.get('/bookings/availability', { params: query });
    return response.data.data;
  },

  // Charges
  async getCharges(bookingId: string): Promise<Charge[]> {
    const response = await api.get(`/bookings/${bookingId}/charges`);
    return response.data.data;
  },

  async addCharge(
    bookingId: string,
    data: { description: string; category: string; amount: number; quantity?: number }
  ): Promise<Charge> {
    const response = await api.post(`/bookings/${bookingId}/charges`, data);
    return response.data.data;
  },

  async voidCharge(bookingId: string, chargeId: string): Promise<void> {
    await api.delete(`/bookings/${bookingId}/charges/${chargeId}`);
  },

  // Payments
  async getPayments(bookingId: string): Promise<Payment[]> {
    const response = await api.get(`/bookings/${bookingId}/payments`);
    return response.data.data;
  },

  async addPayment(
    bookingId: string,
    data: { amount: number; method: string; reference?: string; notes?: string }
  ): Promise<Payment> {
    const payload = {
      bookingId,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      notes: data.notes,
    };
    const response = await api.post('/payments/record', payload);
    return response.data.data;
  },

  async confirmPayment(bookingId: string, paymentMethod?: string): Promise<Booking> {
    const response = await api.post(`/bookings/${bookingId}/payments/confirm`, { paymentMethod });
    return response.data.data;
  },

  async refundPayment(bookingId: string, paymentId: string, amount?: number): Promise<Payment> {
    const response = await api.post(`/bookings/${bookingId}/payments/${paymentId}/refund`, {
      amount,
    });
    return response.data.data;
  },

  // Invoices
  async generateInvoice(bookingId: string): Promise<Invoice> {
    const response = await api.post(`/bookings/${bookingId}/invoice`);
    return response.data.data;
  },

  async getInvoice(bookingId: string): Promise<Invoice> {
    const response = await api.get(`/bookings/${bookingId}/invoice`);
    return response.data.data;
  },
};

export default bookingService;
