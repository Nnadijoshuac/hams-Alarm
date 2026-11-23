import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

export async function requestNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    await Linking.openSettings();
    return false;
  }
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Opens the system "Alarms & reminders" page (Android 12+). Don't await the
 * result: per the docs, revoking the permission restarts the app and the
 * promise never settles. Re-check when the app returns to the foreground.
 */
export function requestExactAlarms(): void {
  if (Platform.OS !== 'android') return;
  Notifications.requestExactAlarmPermissionsAsync().catch(() =>
    IntentLauncher.startActivityAsync('android.settings.REQUEST_SCHEDULE_EXACT_ALARM').catch(() => Linking.openSettings()),
  );
}

export async function requestForegroundLocation(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    await Linking.openSettings();
    return false;
  }
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

/**
 * Android 11+ can't grant "Allow all the time" from a dialog: this opens the
 * app's location settings page. Foreground permission must be granted first.
 */
export async function requestBackgroundLocation(): Promise<boolean> {
  if (!(await requestForegroundLocation())) return false;
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    await Linking.openSettings();
    return false;
  }
  return (await Location.requestBackgroundPermissionsAsync()).granted;
}

/** Shows the Android "turn on location" dialog. */
export async function enableLocationServices(): Promise<void> {
  try {
    await Location.enableNetworkProviderAsync();
  } catch {
    if (Platform.OS === 'android') {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS).catch(() => undefined);
    }
  }
}

/** Battery optimisation list, so the user can exempt the app (helps on aggressive OEMs). */
export async function openBatterySettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS).catch(() =>
    Linking.openSettings(),
  );
}
