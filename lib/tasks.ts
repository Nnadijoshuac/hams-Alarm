import * as BackgroundTask from 'expo-background-task';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import {
  GEOFENCE_TASK,
  handleLocationUpdate,
  handleTransition,
  KEEPALIVE_TASK,
  NOTIFICATION_TASK,
  RESYNC_TASK,
  snoozeRing,
  stopRing,
  syncAll,
} from './engine';
import { ACTION_SNOOZE, ACTION_STOP, isRingData } from './notifications';
import { loadJson, saveJson } from './storage';

/**
 * All task definitions live here, imported first from index.ts. Android may
 * boot the JS runtime headless (no UI) just to run one of these.
 */

TaskManager.defineTask<{ eventType: Location.LocationGeofencingEventType; region: Location.LocationRegion }>(
  GEOFENCE_TASK,
  async ({ data, error }) => {
    if (error || !data?.region?.identifier) return;
    const entered = data.eventType === Location.LocationGeofencingEventType.Enter;
    await handleTransition(data.region.identifier, entered, 'geofence');
  },
);

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(KEEPALIVE_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await handleLocationUpdate(data.locations[data.locations.length - 1]);
});

const HANDLED_KEY = 'arrive/handled-responses/v1';

/**
 * The same tap can reach us via the background task, the in-app listener and
 * getLastNotificationResponseAsync(). Acting twice would re-snooze an alarm
 * that was already stopped, so each response is handled once (persisted).
 */
async function firstTime(response: Notifications.NotificationResponse): Promise<boolean> {
  const id = `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
  const handled = await loadJson<string[]>(HANDLED_KEY, []);
  if (handled.includes(id)) return false;
  await saveJson(HANDLED_KEY, [id, ...handled].slice(0, 30));
  return true;
}

/** Stop / Snooze tapped in the notification shade, including when the app was killed (Android). */
export async function handleNotificationResponse(response: Notifications.NotificationResponse): Promise<'stop' | 'snooze' | 'open' | null> {
  const data = response.notification.request.content.data;
  if (!isRingData(data)) return null;
  const isAction = response.actionIdentifier === ACTION_STOP || response.actionIdentifier === ACTION_SNOOZE;
  if (isAction && !(await firstTime(response))) return null;
  if (response.actionIdentifier === ACTION_STOP) {
    await stopRing(data.key);
    return 'stop';
  }
  if (response.actionIdentifier === ACTION_SNOOZE) {
    await snoozeRing(data.key);
    return 'snooze';
  }
  return 'open';
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  if ('actionIdentifier' in data) {
    await handleNotificationResponse(data as unknown as Notifications.NotificationResponse);
  }
});
Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => undefined);

TaskManager.defineTask(RESYNC_TASK, async () => {
  try {
    await syncAll('background');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
