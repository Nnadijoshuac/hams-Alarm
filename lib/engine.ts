import * as BackgroundTask from 'expo-background-task';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { distanceMeters } from './geo';
import {
  applyPlan,
  dismissRing,
  dismissStatus,
  presentActive,
  presentRing,
  setupNotifications,
  showStatus,
} from './notifications';
import { alarmBody, alarmTitle, CHAIN_SPAN_MS, planNotifications } from './ringPlan';
import { getRuntime, loadAlarms, loadJson, loadRuntime, saveJson, updateAlarms, updateRuntime } from './storage';
import { setSyncHandler, type SyncReason } from './syncBus';
import { decideBoth, oneShotOccurrence, timeAlarmIsSpent } from './time';
import { SNOOZE_MINUTES, TIMER_KEY, type Alarm } from './types';

export const GEOFENCE_TASK = 'arrive-geofence';
export const KEEPALIVE_TASK = 'arrive-location-keepalive';
export const NOTIFICATION_TASK = 'arrive-notification';
export const RESYNC_TASK = 'arrive-resync';

const log = (...args: unknown[]) => {
  if (__DEV__) console.log('[arrive]', ...args);
};

// ---------- ring events (so the UI can open the ring screen) ----------

type RingListener = (key: string) => void;
const ringListeners = new Set<RingListener>();
export function onRing(fn: RingListener): () => void {
  ringListeners.add(fn);
  return () => ringListeners.delete(fn);
}

// ---------- ring / stop / snooze ----------

export function ringInfo(alarms: Alarm[], key: string): { title: string; body: string; alarm: Alarm | null } {
  if (key === TIMER_KEY) return { title: "Time's up", body: 'Timer finished', alarm: null };
  const alarm = alarms.find((a) => a.id === key) ?? null;
  return alarm ? { title: alarmTitle(alarm), body: alarmBody(alarm), alarm } : { title: 'Alarm', body: '', alarm: null };
}

/** Start ringing now: first notification immediately, follow-ups scheduled by sync. */
export async function ringNow(key: string): Promise<void> {
  const now = Date.now();
  await updateRuntime(key, (rt) => ({ ...rt, pendingRingAt: now, lastFiredAt: now }));
  const { title, body } = ringInfo(await loadAlarms(), key);
  await setupNotifications();
  await presentRing(key, now, title, body);
  log('ring', key);
  ringListeners.forEach((fn) => fn(key));
}

export async function stopRing(key: string): Promise<void> {
  const now = Date.now();
  await updateRuntime(key, (rt) => ({
    ...rt,
    ackUntil: Math.max(rt.ackUntil, now),
    pendingRingAt: rt.pendingRingAt !== null && rt.pendingRingAt > now ? rt.pendingRingAt : null,
  }));
  await dismissRing(key);
  await syncAll('ring');
}

export async function snoozeRing(key: string): Promise<void> {
  const now = Date.now();
  await updateRuntime(key, (rt) => ({
    ...rt,
    ackUntil: Math.max(rt.ackUntil, now),
    pendingRingAt: now + SNOOZE_MINUTES * 60_000,
  }));
  await dismissRing(key);
  await syncAll('ring');
}

/**
 * The ring screen is open and plays the sound itself: silence the OS chain and
 * swap in a quiet notification that keeps Stop / Snooze reachable.
 */
export async function takeOverRing(key: string): Promise<void> {
  const now = Date.now();
  await updateRuntime(key, (rt) => ({ ...rt, ackUntil: Math.max(rt.ackUntil, now) }));
  await dismissRing(key);
  const { title, body } = ringInfo(await loadAlarms(), key);
  await presentActive(key, now, title, body).catch(() => undefined);
  await syncAll('ring');
}

// ---------- geofence transitions ----------

/** Shared by the OS geofence task, the keep-alive location fallback, and the dev "Test trigger". */
export async function handleTransition(alarmId: string, entered: boolean, source: string): Promise<void> {
  const alarms = await loadAlarms();
  const alarm = alarms.find((a) => a.id === alarmId);
  if (!alarm || !alarm.enabled || alarm.mode === 'time') return;
  const runtime = getRuntime(await loadRuntime(), alarmId);
  log('transition', alarmId, entered ? 'enter' : 'exit', 'via', source);

  if (!entered) {
    const now = Date.now();
    await updateRuntime(alarmId, (rt) => ({
      ...rt,
      inside: false,
      ignoreUntilExit: false,
      // Left before the set time: cancel the early-arrival ring.
      ...(rt.pendingRingAt !== null && rt.pendingRingAt > now
        ? { pendingRingAt: null, lastFiredOccurrence: rt.lastFiredOccurrence === rt.pendingRingAt ? null : rt.lastFiredOccurrence }
        : {}),
    }));
    await syncAll('geofence');
    return;
  }

  if (alarm.mode === 'location') {
    if (runtime.ignoreUntilExit) {
      await updateRuntime(alarmId, (rt) => ({ ...rt, inside: true }));
      return;
    }
    await updateRuntime(alarmId, (rt) => ({ ...rt, inside: true }));
    // Location alarms are one-shot: switch off (which removes the geofence), then ring.
    await updateAlarms((list) => list.map((a) => (a.id === alarmId ? { ...a, enabled: false } : a)));
    await ringNow(alarmId);
    await syncAll('geofence');
    return;
  }

  // Time + Location: evaluated by the state machine in syncAll.
  await updateRuntime(alarmId, (rt) => ({ ...rt, inside: true }));
  await syncAll('geofence');
}

/** Fallback detection from keep-alive location updates, with hysteresis. */
export async function handleLocationUpdate(position: Location.LocationObject): Promise<void> {
  const alarms = (await loadAlarms()).filter((a) => a.enabled && a.mode !== 'time' && a.destination);
  if (alarms.length === 0) return;
  const runtime = await loadRuntime();
  const accuracy = position.coords.accuracy ?? 999;
  for (const alarm of alarms) {
    const rt = getRuntime(runtime, alarm.id);
    const d = distanceMeters(position.coords, alarm.destination!);
    if (!rt.inside && d <= alarm.radius && accuracy <= Math.max(150, alarm.radius)) {
      await handleTransition(alarm.id, true, 'keepalive');
    } else if (rt.inside && d > alarm.radius * 1.15 + Math.min(accuracy, 200)) {
      await handleTransition(alarm.id, false, 'keepalive');
    }
  }
}

/** When an alarm is switched on in the app, record whether we're already inside it. */
async function primeInsideState(alarmId: string): Promise<void> {
  const alarm = (await loadAlarms()).find((a) => a.id === alarmId);
  if (!alarm?.enabled || alarm.mode === 'time' || !alarm.destination) return;
  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return;
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 200 })) ??
    (await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]));
  if (!pos) return;
  const inside = distanceMeters(pos.coords, alarm.destination) <= alarm.radius;
  await updateRuntime(alarmId, (rt) => ({
    ...rt,
    inside,
    // Already here when a location alarm is set: wait until the user leaves and comes back.
    ignoreUntilExit: alarm.mode === 'location' && inside,
  }));
}

// ---------- the sync ----------

let running: Promise<void> | null = null;
let queued: { reason: SyncReason; alarmId?: string } | null = null;

/**
 * Idempotent: rebuilds every schedule, geofence and service from storage.
 * Safe to call from anywhere (UI, headless tasks, periodic background task).
 * Concurrent calls are coalesced.
 */
export async function syncAll(reason: SyncReason, alarmId?: string): Promise<void> {
  if (running) {
    queued = { reason, alarmId };
    return running;
  }
  running = (async () => {
    try {
      await doSync(reason, alarmId);
    } finally {
      running = null;
    }
    if (queued) {
      const q = queued;
      queued = null;
      await syncAll(q.reason, q.alarmId);
    }
  })();
  return running;
}

async function doSync(reason: SyncReason, alarmId?: string): Promise<void> {
  await setupNotifications();
  if ((reason === 'enable' || reason === 'upsert') && alarmId) {
    await primeInsideState(alarmId).catch((e) => log('prime failed', e));
  }

  const now = Date.now();
  const toDisable = new Set<string>();
  const toRing: string[] = [];

  // 1. Advance alarm state machines.
  for (const alarm of await loadAlarms()) {
    if (!alarm.enabled) continue;
    const rt = getRuntime(await loadRuntime(), alarm.id);

    if (alarm.mode === 'time' && timeAlarmIsSpent(alarm, now)) {
      const occ = oneShotOccurrence(alarm);
      // Keep it on until it has finished ringing (or was stopped).
      if (now >= occ + CHAIN_SPAN_MS || rt.ackUntil >= occ) toDisable.add(alarm.id);
    }

    if (alarm.mode === 'both') {
      const decision = decideBoth(alarm, rt, now);
      switch (decision.type) {
        case 'ring':
          await updateRuntime(alarm.id, (r) => ({ ...r, lastFiredOccurrence: decision.occurrence }));
          toRing.push(alarm.id);
          break;
        case 'scheduleAt': {
          // Don't clobber a session that is ringing now or a pending snooze.
          const sessionLive =
            rt.pendingRingAt !== null && rt.pendingRingAt > rt.ackUntil && rt.pendingRingAt + CHAIN_SPAN_MS > now;
          if (!sessionLive && rt.pendingRingAt !== decision.at) {
            // Pre-claim the occurrence; the scheduled chain rings even if the app is dead.
            await updateRuntime(alarm.id, (r) => ({ ...r, pendingRingAt: decision.at, lastFiredOccurrence: decision.at }));
          }
          break;
        }
        case 'waitForArrival':
          break;
        case 'done':
          toDisable.add(alarm.id);
          break;
      }
    }
  }

  if (toDisable.size > 0) {
    await updateAlarms((list) => list.map((a) => (toDisable.has(a.id) ? { ...a, enabled: false } : a)));
    log('disabled', [...toDisable]);
  }
  for (const id of toRing) await ringNow(id);

  // 2. Notifications.
  const alarms = await loadAlarms();
  const plan = planNotifications(alarms, await loadRuntime(), Date.now());
  const { added, removed } = await applyPlan(plan);

  // 3. Geofences — only for enabled location alarms (battery).
  const fenced = alarms.filter((a) => a.enabled && a.mode !== 'time' && a.destination);
  const geo = await syncGeofences(fenced, reason);

  log(`sync(${reason}) plan=${plan.length} +${added} -${removed} fences=${fenced.length} ${geo}`);

  // 4. Periodic re-sync (re-registers geofences after reboot, tops up schedules).
  await syncBackgroundTask(alarms.some((a) => a.enabled) || plan.length > 0);
}

const FENCES_KEY = 'arrive/fences/v1';

async function syncGeofences(fenced: Alarm[], reason: SyncReason): Promise<string> {
  const geofencing = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
  const keepalive = await Location.hasStartedLocationUpdatesAsync(KEEPALIVE_TASK).catch(() => false);

  if (fenced.length === 0) {
    if (geofencing) await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => undefined);
    await saveJson(FENCES_KEY, '');
    if (keepalive) await Location.stopLocationUpdatesAsync(KEEPALIVE_TASK).catch(() => undefined);
    await dismissStatus('resume');
    return 'geofence=off';
  }

  const bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted) return 'geofence=no-permission';

  const regions = fenced.map((a) => ({
    identifier: a.id,
    latitude: a.destination!.latitude,
    longitude: a.destination!.longitude,
    radius: a.radius,
    notifyOnEnter: true,
    notifyOnExit: true,
  }));
  // Re-registering resets Android's geofences, so only do it when the regions
  // changed — or on launch / periodic runs, which covers reboots.
  const signature = JSON.stringify(regions);
  const force = reason === 'launch' || reason === 'background';
  if (force || !geofencing || signature !== (await loadJson<string>(FENCES_KEY, ''))) {
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    await saveJson(FENCES_KEY, signature);
  }

  // Android won't wake a killed app for geofence events, so a low-power
  // foreground service keeps the process alive while location alarms are on.
  if (!keepalive) {
    try {
      await Location.startLocationUpdatesAsync(KEEPALIVE_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60_000,
        distanceInterval: 50,
        deferredUpdatesInterval: 60_000,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'Watching for your arrival',
          notificationBody: 'Hams_Alarm will ring when you reach your destination.',
          notificationColor: '#0F5E5B',
          killServiceOnDestroy: false,
        },
      });
      await dismissStatus('resume');
    } catch (e) {
      // Android 12+ forbids starting a foreground service from the background
      // (e.g. right after a reboot). Ask the user to open the app once.
      log('keepalive start failed', e);
      if (AppState.currentState !== 'active') {
        await showStatus('resume', 'Location alarms paused', 'Tap to resume watching for your arrival.').catch(() => undefined);
      }
      return 'geofence=on keepalive=failed';
    }
  }
  return 'geofence=on keepalive=on';
}

async function syncBackgroundTask(wanted: boolean): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (wanted) await BackgroundTask.registerTaskAsync(RESYNC_TASK, { minimumInterval: 15 });
    else await BackgroundTask.unregisterTaskAsync(RESYNC_TASK).catch(() => undefined);
  } catch (e) {
    log('background task registration failed', e);
  }
}

setSyncHandler(syncAll);
