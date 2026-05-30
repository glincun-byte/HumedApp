import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

interface NotificationContextValue {
  isSupported: boolean;
  permission: NotificationPermission | 'default' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'granted';
  requestPermission: () => Promise<NotificationPermission | 'default' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'granted'>;
  notify: (title: string, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permission, setPermission] = useState<NotificationPermission | 'default' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'granted'>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        setIsSupported(true);
        try {
          const current = await LocalNotifications.checkPermissions();
          setPermission(current.display as any);
          if (current.display !== 'granted') {
            const requested = await LocalNotifications.requestPermissions();
            setPermission(requested.display as any);
          }
        } catch {
          setPermission('default');
        }
        return;
      }

      if (typeof window !== 'undefined' && 'Notification' in window) {
        setIsSupported(true);
        setPermission(Notification.permission);
      }
    };

    init().catch(() => undefined);
  }, []);

  const requestPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const requested = await LocalNotifications.requestPermissions();
        setPermission(requested.display as any);
        return requested.display as any;
      } catch {
        return 'default';
      }
    }

    if (!isSupported || !('Notification' in window) || Notification.permission === 'granted') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
        return Notification.permission;
      }
      return 'default';
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const notify = (title: string, options?: NotificationOptions) => {
    if (!isSupported) return;

    if (Capacitor.isNativePlatform()) {
      LocalNotifications.checkPermissions()
        .then(current => {
          if (current.display !== 'granted') return;
          return LocalNotifications.schedule({
            notifications: [
              {
                id: Date.now() % 2147483000,
                title,
                body: options?.body ?? '',
                schedule: { at: new Date(Date.now() + 300) },
              },
            ],
          });
        })
        .catch(() => undefined);
      return;
    }

    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, options);
    } catch {
      // ignore
    }
  };

  return (
    <NotificationContext.Provider value={{ isSupported, permission, requestPermission, notify }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications debe usarse dentro de NotificationProvider');
  }
  return ctx;
};
