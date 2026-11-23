import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_RUNTIME, type Alarm, type AlarmRuntime } from './types';

/**
 * Plain AsyncStorage access. Used by both the UI stores and headless
 * background tasks (geofence / notification / background-task), which run
 * without React and can't rely on an in-memory store being hydrated.
 */
const KEYS = {
  alarms: 'arrive/alarms/v1',
  runtime: 'arrive/runtime/v1',
  timer: 'arrive/timer/v1',
  stopwatch: 'arrive/stopwatch/v1',
  cities: 'arrive/cities/v1',
  onboarded: 'arrive/onboarded/v1',
} as const;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// Serialise read-modify-write cycles within one JS context so concurrent
// geofence events can't interleave and lose an update.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

// ---------- alarms ----------

export const loadAlarms = () => readJson<Alarm[]>(KEYS.alarms, []);
export const saveAlarms = (alarms: Alarm[]) => writeJson(KEYS.alarms, alarms);

export function updateAlarms(fn: (alarms: Alarm[]) => Alarm[]): Promise<Alarm[]> {
  return serial(async () => {
    const next = fn(await loadAlarms());
    await saveAlarms(next);
    return next;
  });
}

// ---------- runtime (written by background tasks) ----------

export type RuntimeMap = Record<string, AlarmRuntime>;

export const loadRuntime = () => readJson<RuntimeMap>(KEYS.runtime, {});

export function getRuntime(map: RuntimeMap, key: string): AlarmRuntime {
  return { ...DEFAULT_RUNTIME, ...map[key] };
}

export function updateRuntime(key: string, fn: (rt: AlarmRuntime) => AlarmRuntime | null): Promise<RuntimeMap> {
  return serial(async () => {
    const map = await loadRuntime();
    const next = fn(getRuntime(map, key));
    if (next) map[key] = next;
    else delete map[key];
    await writeJson(KEYS.runtime, map);
    return map;
  });
}

// ---------- misc ----------

export const loadJson = readJson;
export const saveJson = writeJson;
export { KEYS };
