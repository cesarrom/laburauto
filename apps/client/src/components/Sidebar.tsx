import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { User } from '@laburauto/shared';
import {
  Car,
  Calendar,
  Bell,
  LogOut,
  Menu,
  X,
  PlusCircle,
  List,
  FileCheck,
  CreditCard,
  AlertCircle,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';

type ReputationUser = User & { reputationScore?: number };

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const toggleSidebar = () => setIsOpen(!isOpen);

  const navItems = [
    { label: 'Panel', path: '/app', icon: Car, show: true },
    { label: 'Reservas', path: '/bookings', icon: Calendar, show: true },
    { label: 'Notificaciones', path: '/notifications', icon: Bell, show: true },
    { label: 'Publicar vehículo', path: '/publish-vehicle', icon: PlusCircle, show: user.role === 'publisher' },
    { label: 'Mis vehículos', path: '/my-vehicles', icon: List, show: user.role === 'publisher' },
    { label: 'Postulaciones', path: '/applications', icon: FileCheck, show: user.role === 'publisher' },
    { label: 'Suscripción', path: '/subscription', icon: CreditCard, show: user.role === 'publisher' },
    { label: 'Revisión de autos', path: '/admin/vehicles', icon: List, show: user.role === 'admin' },
    { label: 'Disputas', path: '/admin/disputes', icon: AlertCircle, show: user.role === 'admin' },
    { label: 'Plantillas', path: '/admin/templates', icon: FileText, show: user.role === 'admin' },
    { label: 'DocuSeal', path: '/admin/docuseal', icon: ShieldCheck, show: user.role === 'admin' },
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-surface/95 border-b border-border fixed top-0 left-0 right-0 z-50 h-16 backdrop-blur">
        <div className="flex items-center gap-2 font-display text-lg text-text">
          <div className="h-9 w-9 rounded-2xl bg-brand-500/15 text-brand-600 flex items-center justify-center">
            <Car className="h-5 w-5" />
          </div>
          <span>Laburauto</span>
        </div>
        <button onClick={toggleSidebar} className="p-2 text-text hover:bg-surface-muted rounded-md border border-border">
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed top-0 left-0 h-full w-72 bg-surface border-r border-border/70 transform transition-transform duration-300 ease-in-out z-50 pt-16 md:pt-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="hidden md:flex h-16 items-center px-6 border-b border-border/70">
          <Link to="/app" className="flex items-center gap-2 font-display text-lg text-text">
            <div className="h-10 w-10 rounded-2xl bg-brand-500/15 text-brand-600 flex items-center justify-center">
              <Car className="h-5 w-5" />
            </div>
            <span>Laburauto</span>
          </Link>
        </div>

        <div className="p-4 space-y-1">
          {navItems.filter(item => item.show).map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all animate-fade-up",
                  isActive
                    ? "bg-brand-500/10 text-brand-600 border border-brand-500/30"
                    : "text-text-muted border border-transparent hover:border-border hover:bg-surface-muted"
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/70 bg-surface">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="h-10 w-10 bg-brand-500/15 text-brand-600 rounded-2xl flex items-center justify-center font-semibold text-sm">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text truncate">{user.name || user.email}</p>
              <div className="flex items-center gap-2 text-[10px] text-text-muted uppercase tracking-[0.2em]">
                <span>{user.role}</span>
                <div className="h-1 w-1 bg-border rounded-full" />
                <span className="text-emerald-500 font-black">🏆 {(user as ReputationUser).reputationScore ?? 100}</span>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
