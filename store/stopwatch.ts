import { create } from 'zustand';
import { KEYS, loadJson, saveJson } from '../lib/storage';

interface StopwatchData {
  running: boolean;
  /** When the current run segment started (ms). */
  startedAt: number | null;
  /** Time accumulated by previous segments. */
  accumulatedMs: number;
  /** Lap split totals (elapsed at the moment Lap was pressed), newest first. */
  laps: number[];
}

interface StopwatchState extends StopwatchData {
  reload: () => Promise<void>;
  elapsed: (now?: number) => number;
  start: () => void;
  stop: () => void;
  lap: () => void;
  reset: () => void;
}

const DEFAULT: StopwatchData = { running: false, startedAt: null, accumulatedMs: 0, laps: [] };

/** Timestamp-based, so it keeps counting while the app is closed. */
export const useStopwatch = create<StopwatchState>((set, get) => {
  const persist = (patch: Partial<StopwatchData>) => {
    set(patch);
    const { running, startedAt, accumulatedMs, laps } = { ...get(), ...patch };
    void saveJson(KEYS.stopwatch, { running, startedAt, accumulatedMs, laps });
  };

  return {
    ...DEFAULT,
    reload: async () => set(await loadJson(KEYS.stopwatch, DEFAULT)),
    elapsed: (now = Date.now()) => {
      const { running, startedAt, accumulatedMs } = get();
      return accumulatedMs + (running && startedAt !== null ? now - startedAt : 0);
    },
    start: () => persist({ running: true, startedAt: Date.now() }),
    stop: () => persist({ running: false, startedAt: null, accumulatedMs: get().elapsed() }),
    lap: () => persist({ laps: [get().elapsed(), ...get().laps] }),
    reset: () => persist(DEFAULT),
  };
});
