import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const isDevEnv = import.meta.env.DEV;
const routeLog = (...args: unknown[]) => {
  if (isDevEnv) {
    console.log('[PrivateRoute]', ...args);
  }
};

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  routeLog('render', { pathname: location.pathname, loading, hasUser: !!user });

  if (loading) {
    routeLog('still loading, showing skeleton', location.pathname);
    return <div>Loading...</div>;
  }

  if (!user) {
    routeLog('no user, redirecting to /login', location.pathname);
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  routeLog('user authenticated, rendering child', { pathname: location.pathname, role: user.role });
  return <>{children}</>;
}
