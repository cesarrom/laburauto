import { useEffect } from 'react';
import api from '../lib/api';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';

export function useAxiosInterceptors() {
  const { openLogin, openSubscription } = useUI();
  const { logout } = useAuth(); // If we need to clear state on hard fail

  useEffect(() => {
    // Response Interceptor
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        // Ensure we don't loop indefinitely
        if (!originalRequest || (originalRequest as any)._retry) {
          return Promise.reject(error);
        }

        // Handle 401 Unauthorized (Session Expired / Not Logged In)
        if (error.response?.status === 401) {
          (originalRequest as any)._retry = true;

          try {
            await openLogin();
            // If openLogin resolves, it means user successfully logged in
            // Retry original request with new token (api instance should pick up new token from localStorage automatically if set correctly in intercepted flow or we passed it)
            // Ideally, the token is in localStorage, so the next request gets it.
            return api(originalRequest);
          } catch (loginError) {
            // Login failed or was cancelled
            logout();
            return Promise.reject(loginError);
          }
        }

        // Handle 403 Forbidden (Subscription Required)
        // Check for specific error code if possible
        if (error.response?.status === 403 && (error.response?.data as any)?.code === 'SUBSCRIPTION_REQUIRED') {
          (originalRequest as any)._retry = true;

          try {
            await openSubscription();
            // If resolves, subscription is presumably active
            return api(originalRequest);
          } catch (subError) {
            return Promise.reject(subError);
          }
        }

        return Promise.reject(error);
      }
    );

    // Cleanup
    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [openLogin, openSubscription, logout]);
}
