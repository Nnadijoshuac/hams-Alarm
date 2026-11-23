export type TriggerMode = 'time' | 'location' | 'both';

/** 0 = Sunday … 6 = Saturday (matches Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Destination {
  latitude: number;
  longitude: number;
  /** Human readable label (search result or reverse-geocoded address). */
  label: string;
}

export interface ClockTime {
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface Alarm {
  id: string;
  name: string;
  enabled: boolean;
  mode: TriggerMode;

  /** Used by 'time' and 'both'. */
  time: ClockTime;
  /** Empty = one-shot. Used by 'time' and 'both'. */
  repeatDays: Weekday[];

  /** Used by 'location' and 'both'. */
  destination: Destination | null;
  /** Metres, 100 – 2000. */
  radius: number;

  /**
   * 'both' only: optional end of the window that starts at `time`.
   * If the alarm hasn't rung by then, that occurrence expires.
   * An end earlier than the start means "the next day".
   */
  windowEnd: ClockTime | null;

  /** When the alarm was last switched on (or created enabled). One-shots count from here. */
  armedAt: number;
  createdAt: number;
}

/**
 * State written by background tasks, kept apart from the user-edited alarm so a
 * geofence event can't clobber an edit made in the UI (and vice versa).
 */
export interface AlarmRuntime {
  /** Last known geofence state. */
  inside: boolean;
  /** Set when an alarm was enabled while already inside: ignore until the user leaves. */
  ignoreUntilExit: boolean;
  /** Start of the occurrence that last rang (ms). Prevents double rings. */
  lastFiredOccurrence: number | null;
  /** Last time the alarm rang (ms). */
  lastFiredAt: number | null;
  /**
   * Start of an explicit ring session (geofence arrival, snooze, timer end,
   * early arrival for Time + Location). May be in the future.
   */
  pendingRingAt: number | null;
  /** Ring sessions that started at or before this moment have been stopped / taken over by the UI. */
  ackUntil: number;
}

export const DEFAULT_RUNTIME: AlarmRuntime = {
  inside: false,
  ignoreUntilExit: false,
  lastFiredOccurrence: null,
  lastFiredAt: null,
  pendingRingAt: null,
  ackUntil: 0,
};

/** Runtime key used for the countdown timer's ring session. */
export const TIMER_KEY = 'timer';

export const RADIUS_MIN = 100;
export const RADIUS_MAX = 2000;
export const SNOOZE_MINUTES = 2;
