import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { LocalNotifications } from '@capacitor/local-notifications';

export function useNotificationPolling() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const poll = async () => {
      try {
        const res = await api.get(`/notifications?userId=${user.id}&unread=true`);
        const newNotifications = res.data;

        if (newNotifications.length > 0) {
          // Trigger Local Notification
          await LocalNotifications.schedule({
            notifications: newNotifications.map((n: any) => ({
              title: 'Laburauto Update',
              body: n.message,
              id: n.id,
              schedule: { at: new Date(Date.now() + 1000) },
              actionTypeId: "",
              extra: null
            }))
          });
        }
      } catch (error) {
        console.error('Polling error', error);
      }
    };

    const interval = setInterval(poll, 30000); // 30s
    return () => clearInterval(interval);
  }, [user]);
}
