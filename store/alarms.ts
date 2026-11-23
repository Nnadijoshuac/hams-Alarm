import { create } from 'zustand';
import { loadAlarms, updateAlarms, updateRuntime } from '../lib/storage';
import type { Alarm } from '../lib/types';
import { requestSync } from '../lib/syncBus';

interface AlarmsState {
  alarms: Alarm[];
  hydrated: boolean;
  /** Re-read from storage (background tasks may have changed things). */
  reload: () => Promise<void>;
  upsert: (alarm: Alarm) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
}

export const useAlarms = create<AlarmsState>((set) => ({
  alarms: [],
  hydrated: false,

  reload: async () => {
    set({ alarms: await loadAlarms(), hydrated: true });
  },

  upsert: async (alarm) => {
    const alarms = await updateAlarms((list) => {
      const i = list.findIndex((a) => a.id === alarm.id);
      if (i === -1) return [...list, alarm];
      const copy = [...list];
      copy[i] = alarm;
      return copy;
    });
    // Editing an alarm starts its bookkeeping fresh.
    await updateRuntime(alarm.id, (rt) => ({ ...rt, lastFiredOccurrence: null, pendingRingAt: null, ackUntil: Date.now() }));
    set({ alarms });
    await requestSync('upsert', alarm.id);
  },

  remove: async (id) => {
    const alarms = await updateAlarms((list) => list.filter((a) => a.id !== id));
    await updateRuntime(id, () => null);
    set({ alarms });
    await requestSync('remove');
  },

  setEnabled: async (id, enabled) => {
    const alarms = await updateAlarms((list) =>
      list.map((a) => (a.id === id ? { ...a, enabled, armedAt: enabled ? Date.now() : a.armedAt } : a)),
    );
    await updateRuntime(id, (rt) => ({
      ...rt,
      // Switching off acknowledges anything pending; switching on starts clean.
      pendingRingAt: null,
      lastFiredOccurrence: enabled ? null : rt.lastFiredOccurrence,
      ackUntil: Date.now(),
    }));
    set({ alarms });
    await requestSync(enabled ? 'enable' : 'disable', id);
  },
}));

export function newAlarmId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
