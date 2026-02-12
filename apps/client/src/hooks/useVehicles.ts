import { useQuery } from '@tanstack/react-query';
import type { Vehicle, Shift } from '@laburauto/shared';
import api from '../lib/api';

// Re-export commonly used types for convenience
export type { Vehicle, Shift };

export interface ApiVehicle extends Omit<Vehicle, 'photos' | 'documentUrls' | 'status'> {
  make: string;
  model: string;
  version: string;
  photos: string[];
  documentUrls: string[];
  imageUrl: string | null;
  status: string;
  shifts?: Shift[];
  approxLat: number;
  approxLng: number;
  radius: number;
}

export function useVehicles(publisherId?: number) {
  return useQuery({
    queryKey: ['vehicles', { publisherId }],
    queryFn: async () => {
      const url = publisherId ? `/vehicles?publisherId=${publisherId}` : '/vehicles';
      const response = await api.get(url);
      return response.data as ApiVehicle[];
    },
  });
}

export function useVehicle(id: number | string) {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: async () => {
      const response = await api.get(`/vehicles/${id}`);
      return response.data as ApiVehicle;
    },
    enabled: !!id,
  });
}
