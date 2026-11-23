import { create } from 'zustand';
import { KEYS, loadJson, saveJson, updateRuntime } from '../lib/storage';
import { requestSync } from '../lib/syncBus';
import { TIMER_KEY } from '../lib/types';

export type TimerStatus = 'idle' | 'running' | 'paused';

interface TimerData {
  status: TimerStatus;
  /** Length the timer was set to. */
  durationMs: number;
  /** Absolute end time while running. */
  endAt: number | null;
  /** Time left while paused. */
  remainingMs: number;
}

interface TimerState extends TimerData {
  hydrated: boolean;
  reload: () => Promise<void>;
  setDuration: (ms: number) => void;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  reset: () => Promise<void>;
}

const DEFAULT: TimerData = { status: 'idle', durationMs: 5 * 60_000, endAt: null, remainingMs: 5 * 60_000 };

/**
 * The countdown is stored as an absolute end time, so it survives the app being
 * backgrounded or killed. Ringing is handled by the notification engine via
 * the timer's runtime session (pendingRingAt = endAt).
 */
export const useTimer = create<TimerState>((set, get) => {
  const persist = async (data: TimerData) => {
    set(data);
    await saveJson(KEYS.timer, data);
  };

  return {
    ...DEFAULT,
    hydrated: false,

    reload: async () => {
      const data = await loadJson<TimerData>(KEYS.timer, DEFAULT);
      // A finished timer returns to idle with its last duration.
      if (data.status === 'running' && data.endAt !== null && data.endAt <= Date.now()) {
        const done = { ...data, status: 'idle' as const, endAt: null, remainingMs: data.durationMs };
        await saveJson(KEYS.timer, done);
        set({ ...done, hydrated: true });
        return;
      }
      set({ ...data, hydrated: true });
    },

    setDuration: (ms) => {
      if (get().status !== 'idle') return;
      void persist({ status: 'idle', durationMs: ms, endAt: null, remainingMs: ms });
    },

    start: async () => {
      const { status, remainingMs, durationMs } = get();
      const left = status === 'paused' ? remainingMs : durationMs;
      if (left <= 0) return;
      const endAt = Date.now() + left;
      await persist({ status: 'running', durationMs, endAt, remainingMs: left });
      await updateRuntime(TIMER_KEY, (rt) => ({ ...rt, pendingRingAt: endAt, ackUntil: Date.now() }));
      await requestSync('timer');
    },

    pause: async () => {
      const { endAt, durationMs } = get();
      if (endAt === null) return;
      await persist({ status: 'paused', durationMs, endAt: null, remainingMs: Math.max(0, endAt - Date.now()) });
      await updateRuntime(TIMER_KEY, (rt) => ({ ...rt, pendingRingAt: null, ackUntil: Date.now() }));
      await requestSync('timer');
    },

    reset: async () => {
      const { durationMs } = get();
      await persist({ status: 'idle', durationMs, endAt: null, remainingMs: durationMs });
      await updateRuntime(TIMER_KEY, (rt) => ({ ...rt, pendingRingAt: null, ackUntil: Date.now() }));
      await requestSync('timer');
    },
  };
});
