import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { validatedRequest } from '../lib/api';
import {
  authResponseSchema,
  selectVehicleSchema
} from '@laburauto/shared/zod';

// File Upload Hook
export function useFileUpload() {
  return useMutation({
    mutationFn: async ({ files, type }: { files: File[], type?: 'vehicle' | 'kyc' }) => {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      const response = await api.post(`/upload/multiple?type=${type || 'general'}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Return raw paths for storage in DB (they will be signed on-the-fly when fetched)
      return response.data.urls as string[];
    },
  });
}

// AI Vehicle Inference Hook
export function useVehicleInference() {
  return useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await api.post('/ai/infer-vehicle', { imageUrl });
      return response.data.data;
    },
  });
}

// Vehicle Database Hooks
// Vehicle Database Hooks
export function useBrands(query: string) {
  return useQuery({
    queryKey: ['brands', query],
    queryFn: async () => {
      const response = await api.get(`/vehicles-db/brands?q=${query}`);
      return response.data.results as string[];
    },
    enabled: query.length >= 0, // Enable even for empty query to get defaults
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useModels(brand: string, query: string) {
  return useQuery({
    queryKey: ['models', brand, query],
    queryFn: async () => {
      const response = await api.get(`/vehicles-db/models?brand=${encodeURIComponent(brand)}&q=${query}`);
      return response.data.results as string[];
    },
    enabled: brand.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useVersions(brand: string, model: string, query: string) {
  return useQuery({
    queryKey: ['versions', brand, model, query],
    queryFn: async () => {
      // If brand/model are empty, return empty array to prevent 400
      if (!brand || !model) return [];

      const response = await api.get(`/vehicles-db/versions?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&q=${query}`);
      return response.data.results as { id: string; version: string; year: string }[];
    },
    enabled: brand.length > 0 && model.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// Vehicle Creation Hook
export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vehicleData: any) => {
      return validatedRequest(
        () => api.post('/vehicles', vehicleData),
        selectVehicleSchema
      );
    },
    onSuccess: () => {
      // Invalidate vehicles list
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

// Onboarding Completion Hook
export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (data: { userId: number; role: string; kycData: string }) => {
      const response = await api.post('/auth/complete-onboarding', data);
      return response.data; // Now returns { token, user }
    },
  });
}

export function useResendEnrollment() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/auth/resend-enrollment');
      return response.data;
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; confirmPassword: string }) => {
      return validatedRequest(
        () => api.post('/auth/register', data),
        authResponseSchema
      );
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      return validatedRequest(
        () => api.post('/auth/login', data),
        authResponseSchema
      );
    },
  });
}

// Navigation / Map Hooks
export function useAddressSearch(query: string) {
  return useQuery({
    queryKey: ['addressSearch', query],
    queryFn: async () => {
      if (!query || query.length < 3) return [];
      const response = await api.get(`/navigation/search?text=${encodeURIComponent(query)}`);
      return response.data.results as { title: string; address: string; lat: number; lng: number }[];
    },
    enabled: query.length >= 3,
    staleTime: 5 * 60 * 1000,
  });
}

export function useReverseGeocode(lat?: number | null, lng?: number | null) {
  return useQuery({
    queryKey: ['reverseGeocode', lat, lng],
    queryFn: async () => {
      if (!lat || !lng) return null;
      const response = await api.get(`/navigation/reverse?lat=${lat}&lng=${lng}`);
      return response.data;
    },
    enabled: !!lat && !!lng,
    staleTime: 30 * 60 * 1000,
  });
}

// Renter Documents Hooks
export function useSubmitRenterDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: number;
      uberRating?: string;
      cabifyRating?: string;
      indriveRating?: string;
      didiRating?: string;
      criminalBackground: string;
    }) => {
      const response = await api.post('/renter-documents', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renterDocuments'] });
    },
  });
}

export function useRenterDocuments(userId?: number) {
  return useQuery({
    queryKey: ['renterDocuments', userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await api.get(`/renter-documents/${userId}`);
      return response.data;
    },
    enabled: !!userId,
  });
}

// Publisher Documents Hooks
export function useSubmitPublisherDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      publisherId: number;
      vehicleId?: number;
      registrationCertificate: string;
      proofOfInsurance: string;
      technicalInspection: string;
    }) => {
      const response = await api.post('/publisher-documents', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publisherDocuments'] });
    },
  });
}

export function usePublisherDocuments(publisherId?: number) {
  return useQuery({
    queryKey: ['publisherDocuments', publisherId],
    queryFn: async () => {
      if (!publisherId) return null;
      const response = await api.get(`/publisher-documents/${publisherId}`);
      return response.data;
    },
    enabled: !!publisherId,
  });
}

export function useContractInstance(instanceId?: number) {
  return useQuery({
    queryKey: ['contractInstance', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      const res = await api.get(`/contracts/instances/${instanceId}`);
      return res.data;
    },
    enabled: !!instanceId,
  });
}

export function useCreateContractInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      contractType: string;
      bookingId?: number;
      publisherId?: number;
      renterId?: number;
      userId?: number;
    }) => {
      const response = await api.post('/contracts/instances', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractInstances'] });
    },
  });
}

// Rental Applications Hooks
export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { vehicleId: number; selectedShiftIds: number[]; selectedDates: string[]; renterId: number }) => {
      const response = await api.post('/applications', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useMyApplications(renterId?: number) {
  return useQuery({
    queryKey: ['applications', 'renter', renterId],
    queryFn: async () => {
      if (!renterId) return [];
      const response = await api.get(`/applications?renterId=${renterId}`);
      return response.data;
    },
    enabled: !!renterId,
  });
}

export function usePublisherApplications(publisherId?: number) {
  return useQuery({
    queryKey: ['applications', 'publisher', publisherId],
    queryFn: async () => {
      if (!publisherId) return [];
      const response = await api.get(`/applications?publisherId=${publisherId}`);
      return response.data;
    },
    enabled: !!publisherId,
    refetchInterval: 30000, // Refetch every 30 seconds to check for new applications
  });
}

export function useApplication(applicationId?: number) {
  return useQuery({
    queryKey: ['application', applicationId],
    queryFn: async () => {
      if (!applicationId) return null;
      const response = await api.get(`/applications/${applicationId}`);
      return response.data;
    },
    enabled: !!applicationId,
  });
}

export function useApproveApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: number) => {
      const response = await api.put(`/applications/${applicationId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useRejectApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: number) => {
      const response = await api.put(`/applications/${applicationId}/reject`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
