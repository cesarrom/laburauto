import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { useLocation } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  // Don't show sidebar on public pages if not logged in
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (!user && isAuthPage) {
    return <>{children}</>;
  }

  // If user is not logged in but on a protected route, PrivateRoute triggers.
  // But if we are effectively authenticated, we show layout.
  // Actually, for public home page (if we allow it), we might want navbar. 
  // But our app seems to be login-gated for most parts or we want sidebar always for consistency if logged in.

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="md:ml-64 transition-all duration-300">
        {/* Mobile header spacer */}
        <div className="h-16 md:h-0" />
        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
