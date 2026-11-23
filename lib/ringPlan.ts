import { describeRepeat, formatClock, latestOccurrence, nextOccurrence } from './time';
import { getRuntime, type RuntimeMap } from './storage';
import { TIMER_KEY, type Alarm } from './types';

/**
 * expo-notifications can't loop a sound, so a "ring" is a chain of
 * notifications: the first at the anchor time, then a follow-up every
 * CHAIN_STEP_MS. Each plays the ~28 s alarm sound, giving ~5 minutes of
 * near-continuous ringing even if the app process is dead. Stop / Snooze /
 * opening the ring screen acknowledges the session and the rest is cancelled.
 */
export const CHAIN_STEP_MS = 30_000;
export const CHAIN_FOLLOW_UPS = 10;
export const CHAIN_SPAN_MS = CHAIN_STEP_MS * CHAIN_FOLLOW_UPS;

export interface PlannedDate {
  kind: 'date';
  id: string;
  at: number;
  key: string;
  anchor: number;
  title: string;
  body: string;
}

export interface PlannedWeekly {
  kind: 'weekly';
  id: string;
  /** expo-notifications weekday: 1 = Sunday … 7 = Saturday */
  weekday: number;
  hour: number;
  minute: number;
  key: string;
  title: string;
  body: string;
}

export type Planned = PlannedDate | PlannedWeekly;

/** Tiny stable hash so content changes produce new identifiers. */
export function sig(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const ringId = (key: string, anchor: number, k: number, signature: string) =>
  `ring:${key}:${anchor}:${k}:${signature}`;

/** Parse `ring:<key>:<anchor>:<k>:<sig>` / `alarm:<key>:…` identifiers. */
export function parseId(id: string): { type: 'ring' | 'alarm'; key: string; anchor: number | null } | null {
  const parts = id.split(':');
  if (parts[0] === 'ring' && parts.length >= 4) return { type: 'ring', key: parts[1], anchor: Number(parts[2]) };
  if (parts[0] === 'alarm' && parts.length >= 3) return { type: 'alarm', key: parts[1], anchor: null };
  return null;
}

export function alarmTitle(alarm: Alarm): string {
  if (alarm.name.trim()) return alarm.name.trim();
  if (alarm.mode === 'time') return 'Alarm';
  return alarm.destination?.label ? `Arriving · ${alarm.destination.label}` : 'You have arrived';
}

export function alarmBody(alarm: Alarm): string {
  const place = alarm.destination?.label ?? 'your destination';
  switch (alarm.mode) {
    case 'time':
      return `${formatClock(alarm.time)} · ${describeRepeat(alarm.repeatDays)}`;
    case 'location':
      return `You're near ${place}`;
    case 'both':
      return `${formatClock(alarm.time)} · you're at ${place}`;
  }
}

function chain(
  out: Planned[],
  key: string,
  anchor: number,
  fromK: number,
  title: string,
  body: string,
  now: number,
) {
  const s = sig(title + body);
  for (let k = fromK; k <= CHAIN_FOLLOW_UPS; k++) {
    const at = anchor + k * CHAIN_STEP_MS;
    if (at <= now + 1000) continue; // past (or presented immediately by ringNow)
    out.push({ kind: 'date', id: ringId(key, anchor, k, s), at, key, anchor, title, body });
  }
}

export interface TimerSession {
  /** When the running timer ends. */
  endAt: number;
}

/** Every notification that should currently be scheduled. Pure. */
export function planNotifications(alarms: Alarm[], runtime: RuntimeMap, now: number): Planned[] {
  const out: Planned[] = [];

  for (const alarm of alarms) {
    const rt = getRuntime(runtime, alarm.id);
    const title = alarmTitle(alarm);
    const body = alarmBody(alarm);

    // Implicit sessions: plain time alarms ring straight from the OS scheduler.
    if (alarm.enabled && alarm.mode === 'time') {
      if (alarm.repeatDays.length > 0) {
        const s = sig(`${title}${body}${alarm.time.hour}:${alarm.time.minute}`);
        for (const d of alarm.repeatDays) {
          out.push({
            kind: 'weekly',
            id: `alarm:${alarm.id}:w${d}:${s}`,
            weekday: d + 1,
            hour: alarm.time.hour,
            minute: alarm.time.minute,
            key: alarm.id,
            title,
            body,
          });
        }
      }
      const latest = latestOccurrence(alarm, now);
      if (latest !== null && latest > rt.ackUntil && latest + CHAIN_SPAN_MS > now) {
        chain(out, alarm.id, latest, 1, title, body, now);
      }
      const next = nextOccurrence(alarm, now);
      if (next !== null) {
        // Repeating alarms get their first ring from the weekly trigger (survives
        // even if we never run again); one-shots need k = 0 too.
        chain(out, alarm.id, next, alarm.repeatDays.length > 0 ? 1 : 0, title, body, now);
      }
    }

    // Explicit sessions: arrival, snooze, early-arrival for Time + Location.
    // Kept even if the alarm was just switched off (location alarms are one-shot).
    const anchor = rt.pendingRingAt;
    if (anchor !== null && anchor > rt.ackUntil && anchor + CHAIN_SPAN_MS > now) {
      chain(out, alarm.id, anchor, 0, title, body, now);
    }
  }

  const timerRt = getRuntime(runtime, TIMER_KEY);
  if (timerRt.pendingRingAt !== null && timerRt.pendingRingAt > timerRt.ackUntil && timerRt.pendingRingAt + CHAIN_SPAN_MS > now) {
    chain(out, TIMER_KEY, timerRt.pendingRingAt, 0, "Time's up", 'Timer finished', now);
  }

  return out;
}
