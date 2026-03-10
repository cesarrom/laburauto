import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (!user && isAuthPage) {
    return <div className="min-h-screen bg-background text-text">{children}</div>;
  }

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_55%)] bg-background text-text">
      <Sidebar />
      <div className="md:ml-72 transition-all duration-300">
        <div className="h-16 md:h-0" />
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md px-4 md:px-8 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-text-muted">Panel operativo</p>
            <p className="text-lg font-display">Hola, {user.name || user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 rounded-full border border-border px-3 py-1.5 text-xs text-text-muted">
              <span>Estado</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-text">Online</span>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
