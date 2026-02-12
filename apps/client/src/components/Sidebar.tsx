import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  FileText
} from 'lucide-react';
import { clsx } from 'clsx';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const toggleSidebar = () => setIsOpen(!isOpen);

  const navItems = [
    { label: 'Browse Cars', path: '/', icon: Car, show: true },
    { label: 'My Bookings', path: '/bookings', icon: Calendar, show: true },
    { label: 'Notifications', path: '/notifications', icon: Bell, show: true },
    { label: 'Publish Vehicle', path: '/publish-vehicle', icon: PlusCircle, show: user.role === 'publisher' },
    { label: 'My Vehicles', path: '/my-vehicles', icon: List, show: user.role === 'publisher' },
    { label: 'Applications', path: '/applications', icon: FileCheck, show: user.role === 'publisher' },
    { label: 'Subscription', path: '/subscription', icon: CreditCard, show: user.role === 'publisher' },
    { label: 'Review Vehicles', path: '/admin/vehicles', icon: List, show: user.role === 'admin' },
    { label: 'Manage Disputes', path: '/admin/disputes', icon: AlertCircle, show: user.role === 'admin' },
    { label: 'Contract Templates', path: '/admin/templates', icon: FileText, show: user.role === 'admin' },
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16">
        <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
          <Car className="h-6 w-6" />
          <span>Laburauto</span>
        </div>
        <button onClick={toggleSidebar} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out z-50 pt-16 md:pt-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="hidden md:flex h-16 items-center px-6 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <Car className="h-6 w-6" />
            <span>Laburauto</span>
          </Link>
        </div>

        <div className="p-4 space-y-1">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                )}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{user.name || user.email}</p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-tighter">{user.role}</p>
                <div className="h-1 w-1 bg-gray-300 rounded-full" />
                <div className="flex items-center gap-0.5 text-emerald-600 font-black text-[10px]">
                  <span>🏆 {(user as any).reputationScore || 100}</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
