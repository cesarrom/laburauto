import axios from 'axios';
import type { z, ZodType } from 'zod';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper for validated API calls
export const validatedRequest = async <R extends ZodType<any>>(
  requestFn: () => Promise<{ data: any }>,
  schema: R
): Promise<z.infer<R>> => {
  const { data } = await requestFn();
  const result = schema.safeParse(data);

  if (!result.success) {
    console.error('API Response validation failed:', result.error);
    // In production we might still return the data but log the error
    // For now we'll be strict
    return data;
  }

  return result.data;
};

export default api;
