import { useState, useCallback } from 'react';

export interface PushNotifState {
  supported: boolean;
  permission: NotificationPermission;
  request: () => Promise<NotificationPermission>;
  notify: (title: string, body: string, icon?: string) => void;
}

export function usePushNotifications(): PushNotifState {
  const supported = typeof Notification !== 'undefined';

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied'
  );

  const request = useCallback(async (): Promise<NotificationPermission> => {
    if (!supported) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [supported]);

  const notify = useCallback(
    (title: string, body: string, icon?: string): void => {
      if (!supported || permission !== 'granted') return;
      new Notification(title, { body, icon });
    },
    [supported, permission]
  );

  return { supported, permission, request, notify };
}
