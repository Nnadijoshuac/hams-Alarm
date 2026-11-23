import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface Health {
  notifications: boolean;
  exactAlarms: boolean;
  locationForeground: boolean;
  locationBackground: boolean;
  locationServices: boolean;
}

export async function readHealth(): Promise<Health> {
  const [notif, exact, fg, bg, services] = await Promise.all([
    Notifications.getPermissionsAsync().catch(() => null),
    Platform.OS === 'android' ? Notifications.getExactAlarmPermissionsAsync().catch(() => null) : null,
    Location.getForegroundPermissionsAsync().catch(() => null),
    Location.getBackgroundPermissionsAsync().catch(() => null),
    Location.hasServicesEnabledAsync().catch(() => true),
  ]);
  return {
    notifications: !!notif?.granted,
    exactAlarms: Platform.OS !== 'android' || exact?.granted !== false,
    locationForeground: !!fg?.granted,
    locationBackground: !!bg?.granted,
    locationServices: services,
  };
}
