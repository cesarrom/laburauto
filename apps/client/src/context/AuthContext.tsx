import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
} from '@tanstack/react-query';
import type { User } from '@laburauto/shared';
import api from '../lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export function QueryClientProvider({ children }: { children: ReactNode }) {
  return (
    <TanStackQueryClientProvider client={queryClient}>
      {children}
    </TanStackQueryClientProvider>
  );
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshSession: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ENABLE_DEBUG_LOGS = (import.meta.env.VITE_ENABLE_DEBUG_LOGS ?? 'true') !== 'false';
const authLog = (...args: unknown[]) => {
  if (ENABLE_DEBUG_LOGS) {
    console.log('[AuthContext]', ...args);
  }
};

const readStoredToken = () => {
  try {
    return localStorage.getItem('token');
  } catch (error) {
    authLog('Failed to read token from storage', error);
    return null;
  }
};

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    authLog('Failed to parse user from storage', error);
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const loading = false; // Hydration is synchronous now
  const loggedMount = useRef(false);

  useEffect(() => {
    if (!loggedMount.current) {
      loggedMount.current = true;
      authLog('AuthProvider mounted', { hasToken: !!token, hasUser: !!user });
    }
  }, [token, user]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    authLog('login()', { userId: newUser.id, role: newUser.role });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    authLog('logout() called');
  };

  const updateUser = (updatedUser: User) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    authLog('updateUser()', { userId: updatedUser.id, role: updatedUser.role });
  };

  const refreshSession = async () => {
    try {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) return;

      const response = await api.get('/auth/me');
      const refreshedUser = response.data.user;

      localStorage.setItem('user', JSON.stringify(refreshedUser));
      setUser(refreshedUser);
      authLog('refreshSession() success', { userId: refreshedUser.id });
    } catch (error) {
      console.error('Failed to refresh session', error);
      authLog('refreshSession() failed', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, refreshSession, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
