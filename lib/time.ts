import type { Alarm, AlarmRuntime, ClockTime, Weekday } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-time timestamp for `time` on the calendar day containing `dayRef`. */
export function atTimeOnDay(dayRef: number, time: ClockTime): number {
  const d = new Date(dayRef);
  d.setHours(time.hour, time.minute, 0, 0);
  return d.getTime();
}

/** Shift a timestamp by whole calendar days (DST-safe: keeps the wall-clock time). */
function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function matchesDay(alarm: Pick<Alarm, 'repeatDays'>, ts: number): boolean {
  if (alarm.repeatDays.length === 0) return true;
  return alarm.repeatDays.includes(new Date(ts).getDay() as Weekday);
}

type TimeFields = Pick<Alarm, 'time' | 'repeatDays' | 'armedAt'>;

/** A one-shot alarm's single occurrence: the first `time` strictly after it was armed. */
export function oneShotOccurrence(alarm: TimeFields): number {
  const sameDay = atTimeOnDay(alarm.armedAt, alarm.time);
  return sameDay > alarm.armedAt ? sameDay : addDays(sameDay, 1);
}

/** Earliest occurrence strictly after `after`, or null if a one-shot has already passed. */
export function nextOccurrence(alarm: TimeFields, after: number): number | null {
  if (alarm.repeatDays.length === 0) {
    const occ = oneShotOccurrence(alarm);
    return occ > after ? occ : null;
  }
  const from = Math.max(after, alarm.armedAt);
  for (let i = 0; i <= 7; i++) {
    const candidate = atTimeOnDay(addDays(from, i), alarm.time);
    if (candidate > from && matchesDay(alarm, candidate)) return candidate;
  }
  return null; // unreachable when repeatDays is non-empty
}

/** Latest occurrence at or before `now` that began after the alarm was armed. */
export function latestOccurrence(alarm: TimeFields, now: number): number | null {
  if (alarm.repeatDays.length === 0) {
    const occ = oneShotOccurrence(alarm);
    return occ <= now ? occ : null;
  }
  for (let i = 0; i <= 7; i++) {
    const candidate = atTimeOnDay(addDays(now, -i), alarm.time);
    if (candidate <= now && candidate > alarm.armedAt && matchesDay(alarm, candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Window length in minutes (end before start wraps to the next day; equal = 24 h). */
export function windowMinutes(start: ClockTime, end: ClockTime): number {
  const diff = end.hour * 60 + end.minute - (start.hour * 60 + start.minute);
  return diff > 0 ? diff : diff + 24 * 60;
}

export function windowDeadline(alarm: Pick<Alarm, 'time' | 'windowEnd'>, occurrence: number): number | null {
  if (!alarm.windowEnd) return null;
  return occurrence + windowMinutes(alarm.time, alarm.windowEnd) * 60_000;
}

export type BothDecision =
  /** Both conditions met: ring now for this occurrence. */
  | { type: 'ring'; occurrence: number }
  /** Inside the area but too early: ring exactly at `at` (cancel if the user leaves). */
  | { type: 'scheduleAt'; at: number }
  /** Waiting for the user to arrive (the geofence wakes us up). */
  | { type: 'waitForArrival'; deadline: number | null }
  /** One-shot alarm is finished (rang, or its window expired): switch it off. */
  | { type: 'done'; reason: 'fired' | 'expired' };

/**
 * The Time + Location state machine. Pure: given the alarm, what we know about
 * its geofence, and the current time, decide what should happen.
 *
 * - Arrive early  → schedule an exact ring for the set time.
 * - Time hits first → wait; ring as soon as the user arrives.
 * - Window passes without arrival → that occurrence expires.
 */
export function decideBoth(
  alarm: Pick<Alarm, 'time' | 'repeatDays' | 'armedAt' | 'windowEnd'>,
  runtime: Pick<AlarmRuntime, 'inside' | 'lastFiredOccurrence'>,
  now: number,
): BothDecision {
  const oneShot = alarm.repeatDays.length === 0;
  const occ = latestOccurrence(alarm, now);

  if (occ !== null && runtime.lastFiredOccurrence !== occ) {
    const deadline = windowDeadline(alarm, occ);
    const open = deadline === null || now < deadline;
    if (open) {
      return runtime.inside ? { type: 'ring', occurrence: occ } : { type: 'waitForArrival', deadline };
    }
    if (oneShot) return { type: 'done', reason: 'expired' };
  } else if (occ !== null && oneShot) {
    return { type: 'done', reason: 'fired' };
  }

  const next = nextOccurrence(alarm, now);
  if (next === null) return { type: 'done', reason: 'fired' };
  if (runtime.inside) return { type: 'scheduleAt', at: next };
  return { type: 'waitForArrival', deadline: windowDeadline(alarm, next) };
}

/** Time-only one-shot alarms switch themselves off once their moment has passed. */
export function timeAlarmIsSpent(alarm: TimeFields, now: number): boolean {
  return alarm.repeatDays.length === 0 && nextOccurrence(alarm, now) === null;
}

// ---------- formatting ----------

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatClock(time: ClockTime, use24h = true): string {
  if (use24h) return `${pad2(time.hour)}:${pad2(time.minute)}`;
  const h = time.hour % 12 === 0 ? 12 : time.hour % 12;
  return `${h}:${pad2(time.minute)} ${time.hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** mm:ss or h:mm:ss for timers. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** mm:ss.cc for the stopwatch. */
export function formatStopwatch(ms: number): string {
  const cs = Math.floor((ms % 1000) / 10);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const base = `${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
  return h > 0 ? `${h}:${base}` : base;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export { DAY_LETTERS, DAY_SHORT, DAY_MS };

export function describeRepeat(days: Weekday[]): string {
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  const sorted = [...days].sort();
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '0,6') return 'Weekends';
  return sorted.map((d) => DAY_SHORT[d]).join(' ');
}
