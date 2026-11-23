import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseId, ringId, sig, type Planned } from './ringPlan';
import { colors } from './theme';

/**
 * Channels can't be changed after creation (except name/description), so the
 * id is versioned: bump it if the sound or importance ever changes.
 */
export const ALARM_CHANNEL = 'alarm-v1';
/** Silent, high-priority channel for the "alarm is ringing" notification shown while the app plays the sound itself. */
export const ACTIVE_CHANNEL = 'alarm-active-v1';
/** Low-priority channel for status messages ("tap to resume location alarms"). */
export const STATUS_CHANNEL = 'status-v1';

/** Category identifiers must not contain ':' or '-'. */
export const RING_CATEGORY = 'arrivering';
export const ACTION_STOP = 'stop';
export const ACTION_SNOOZE = 'snooze';
export const SOUND = 'alarm.wav';

export interface RingData {
  kind: 'ring';
  key: string;
  anchor: number;
  [k: string]: unknown;
}

export function isRingData(data: unknown): data is RingData {
  return !!data && typeof data === 'object' && (data as RingData).kind === 'ring' && typeof (data as RingData).key === 'string';
}

let setupDone = false;

export async function setupNotifications(): Promise<void> {
  if (setupDone) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
      name: 'Alarms',
      description: 'Ringing alarms and timers',
      importance: Notifications.AndroidImportance.MAX,
      sound: SOUND,
      // Plays on the alarm stream: follows alarm volume and still sounds in silent mode.
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      bypassDnd: true,
      enableVibrate: true,
      vibrationPattern: [0, 700, 350, 700, 350, 700],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableLights: true,
      lightColor: colors.accent,
      showBadge: false,
    });
    await Notifications.setNotificationChannelAsync(ACTIVE_CHANNEL, {
      name: 'Ringing alarm controls',
      description: 'Stop / snooze controls while an alarm is ringing in the app',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      enableVibrate: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
    });
    await Notifications.setNotificationChannelAsync(STATUS_CHANNEL, {
      name: 'Status',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      showBadge: false,
    });
  }
  await Notifications.setNotificationCategoryAsync(RING_CATEGORY, [
    { identifier: ACTION_STOP, buttonTitle: 'Stop', options: { opensAppToForeground: false } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze 2 min', options: { opensAppToForeground: false } },
  ]);
  setupDone = true;
}

function ringContent(p: { key: string; anchor: number; title: string; body: string }): Notifications.NotificationContentInput {
  return {
    title: p.title,
    body: p.body,
    sound: SOUND,
    priority: Notifications.AndroidNotificationPriority.MAX,
    sticky: true,
    autoDismiss: false,
    categoryIdentifier: RING_CATEGORY,
    threadIdentifier: `ring-${p.key}`,
    color: colors.accent,
    data: { kind: 'ring', key: p.key, anchor: p.anchor } satisfies RingData,
  };
}

function triggerFor(p: Planned): Notifications.NotificationTriggerInput {
  if (p.kind === 'weekly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: p.weekday,
      hour: p.hour,
      minute: p.minute,
      channelId: ALARM_CHANNEL,
      delivery: 'alarmClock',
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: p.at,
    channelId: ALARM_CHANNEL,
    delivery: 'alarmClock',
  };
}

/**
 * Make the OS schedule match `plan` exactly: cancel what's no longer wanted,
 * add what's missing. Identifiers encode key/anchor/content, so unchanged
 * entries are left alone.
 */
export async function applyPlan(plan: Planned[]): Promise<{ added: number; removed: number }> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter((r) => parseId(r.identifier));
  const desired = new Map(plan.map((p) => [p.id, p]));
  const existing = new Set(ours.map((r) => r.identifier));

  const stale = ours.filter((r) => !desired.has(r.identifier));
  await Promise.all(stale.map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)));

  let added = 0;
  for (const p of plan) {
    if (existing.has(p.id)) continue;
    const anchor = p.kind === 'date' ? p.anchor : 0;
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: ringContent({ key: p.key, anchor, title: p.title, body: p.body }),
      trigger: triggerFor(p),
    });
    added++;
  }
  return { added, removed: stale.length };
}

/** Show the first notification of a ring session right now. */
export async function presentRing(key: string, anchor: number, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: ringId(key, anchor, 0, sig(title + body)),
    content: ringContent({ key, anchor, title, body }),
    trigger: { channelId: ALARM_CHANNEL },
  });
}

/** Silent ongoing notification with Stop / Snooze while the ring screen plays the sound. */
export async function presentActive(key: string, anchor: number, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `active:${key}`,
    content: { ...ringContent({ key, anchor, title, body }), sound: false },
    trigger: { channelId: ACTIVE_CHANNEL },
  });
}

/** Remove any shown notifications for a ring session (this also silences them). */
export async function dismissRing(key: string): Promise<void> {
  const shown = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    shown
      .filter((n) => {
        const data = n.request.content.data;
        return (isRingData(data) && data.key === key) || n.request.identifier === `active:${key}`;
      })
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
  );
}

/** Ring sessions that currently have a notification on screen. */
export async function presentedRings(): Promise<RingData[]> {
  const shown = await Notifications.getPresentedNotificationsAsync();
  const seen = new Map<string, RingData>();
  for (const n of shown) {
    const data = n.request.content.data;
    if (isRingData(data) && !seen.has(data.key)) seen.set(data.key, data);
  }
  return [...seen.values()];
}

export async function showStatus(id: string, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `status:${id}`,
    content: { title, body, data: { kind: 'status', id }, color: colors.accent },
    trigger: { channelId: STATUS_CHANNEL },
  });
}

export async function dismissStatus(id: string): Promise<void> {
  await Notifications.dismissNotificationAsync(`status:${id}`).catch(() => undefined);
}
