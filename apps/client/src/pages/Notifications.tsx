import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Bell } from 'lucide-react';

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
    if (user) {
      fetchNotifications();
      // Simple polling
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get(`/notifications?userId=${user?.id}`);
      setNotifications(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bell className="w-6 h-6" /> Notifications
      </h1>
      <div className="space-y-4">
        <div className="space-y-4">
          {notifications.map(n => {
            let link = '#';
            if (n.type === 'booking_payment_sent') link = '/publisher/applications'; // Publisher to review payment
            if (n.type === 'booking_confirmed') link = '/bookings'; // Renter to see confirmed booking
            if (n.type === 'application_approved') link = '/bookings'; // Renter to pay

            return (
              <Link
                key={n.id}
                to={link}
                onClick={() => !n.isRead && markAsRead(n.id)}
                className={`block p-4 rounded-xl border transition cursor-pointer hover:shadow-md ${n.isRead ? 'bg-white border-gray-200 text-gray-500' : 'bg-blue-50 border-blue-200 text-gray-900 shadow-sm'
                  }`}
              >
                <div className="flex justify-between items-start">
                  <p className="font-medium">{n.message}</p>
                  {!n.isRead && <span className="h-2 w-2 bg-blue-600 rounded-full mt-2"></span>}
                </div>
                <p className="text-xs mt-2 opacity-70">{new Date(n.createdAt).toLocaleString()}</p>
              </Link>
            );
          })}
          {notifications.length === 0 && (
            <div className="text-center py-10 text-gray-500">No notifications</div>
          )}
        </div>
      </div>
    </div>
  );
}
