import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Booking } from '@laburauto/shared';
import api from '../lib/api';

// Re-export for convenience
export type { Booking };

// Custom type including relations
export interface BookingWithDetails extends Booking {
  vehicle: {
    id: number;
    year: number;
    plate: string;
    vehicleModel: {
      brandName: string;
      modelName: string;
    };
  };
}

export function useBookings(params: { driverId?: number; publisherId?: number }) {
  const { driverId, publisherId } = params;
  return useQuery({
    queryKey: ['bookings', params],
    queryFn: async () => {
      if (!driverId && !publisherId) return [];

      const queryParams = new URLSearchParams();
      if (driverId) queryParams.append('driverId', driverId.toString());
      if (publisherId) queryParams.append('publisherId', publisherId.toString());

      const res = await api.get(`/bookings?${queryParams.toString()}`);
      return res.data as BookingWithDetails[];
    },
    enabled: !!driverId || !!publisherId,
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await api.put(`/bookings/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/bookings/${id}/payment/confirm-receipt`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useDisputePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, disputeNotes }: { id: number; disputeNotes: string }) => {
      const res = await api.post(`/bookings/${id}/payment/dispute`, { disputeNotes });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { vehicleId: number; driverId: number; shiftId: number }) => {
      const res = await api.post('/bookings', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useStartRental() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/bookings/${id}/start-rental`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useReturnVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, returnPhotoUrl }: { id: number; returnPhotoUrl: string }) => {
      const res = await api.post(`/bookings/${id}/return`, { returnPhotoUrl });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useResendInvitation() {
  return useMutation({
    mutationFn: async (contractId: number) => {
      await api.post(`/contracts/instances/${contractId}/resend-invitation`);
    },
    onError: (error) => {
      console.error('Failed to resend invitation', error);
      alert('Failed to resend invitation');
    }
  });
}
