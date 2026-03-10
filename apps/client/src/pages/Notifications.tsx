import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Bell, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Notification {
  id: number;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const res = await api.get(`/notifications?userId=${user.id}`);
        if (isMounted) {
          setNotifications(res.data);
        }
      } catch (error) {
        console.error(error);
      }
    };

    void loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error(error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getDestination = (notification: Notification) => {
    if (notification.type === 'booking_payment_sent') return '/applications';
    if (notification.type === 'booking_confirmed' || notification.type === 'application_approved') return '/bookings';
    return '/app';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-8 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Centro de alertas</p>
            <h1 className="mt-3 text-3xl font-display flex items-center gap-3">
              <Bell className="w-6 h-6" /> Tus notificaciones operativas
            </h1>
            <p className="mt-2 text-text-muted max-w-2xl">
              Resolvemos firmas pendientes, pagos, auditorías y mensajes del equipo en un solo timeline.
            </p>
          </div>
          <div className="rounded-2xl border border-border px-5 py-4 text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-text-muted">Sin leer</p>
            <p className="text-2xl font-display text-brand-500">{unreadCount}</p>
          </div>
        </div>
      </header>

      {notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const link = getDestination(notification);
            const isRead = notification.isRead;
            const Icon = isRead ? CheckCircle2 : AlertTriangle;

            return (
              <Link
                key={notification.id}
                to={link}
                onClick={() => !isRead && markAsRead(notification.id)}
                className={`block rounded-[28px] border px-6 py-5 transition shadow-soft hover:shadow-lift ${isRead ? 'bg-surface text-text-muted border-border' : 'bg-brand-500/5 border-brand-500/40 text-text'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-1 rounded-2xl p-2 ${isRead ? 'bg-surface-muted text-text-muted' : 'bg-brand-500/10 text-brand-500'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{notification.message}</p>
                    <p className="text-xs text-text-muted mt-2">
                      {new Date(notification.createdAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  {!isRead && <span className="h-2 w-2 rounded-full bg-brand-500 mt-2" />}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[32px] border border-dashed border-border bg-surface px-6 py-12 text-center shadow-soft">
          <p className="text-sm uppercase tracking-[0.4em] text-text-muted">Sin notificaciones</p>
          <p className="mt-4 text-text-muted">
            Cuando haya movimientos en tus contratos, aparecerán acá con contexto y enlaces directos a cada tarea.
          </p>
        </div>
      )}
    </div>
  );
}
