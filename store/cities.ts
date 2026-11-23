import { create } from 'zustand';
import { KEYS, loadJson, saveJson } from '../lib/storage';

interface CitiesState {
  /** IANA zone ids, e.g. "Europe/Lisbon" (see lib/cities.ts). */
  zones: string[];
  reload: () => Promise<void>;
  add: (zone: string) => void;
  remove: (zone: string) => void;
}

export const useCities = create<CitiesState>((set, get) => ({
  zones: [],
  reload: async () => set({ zones: await loadJson<string[]>(KEYS.cities, []) }),
  add: (zone) => {
    if (get().zones.includes(zone)) return;
    const zones = [...get().zones, zone];
    set({ zones });
    void saveJson(KEYS.cities, zones);
  },
  remove: (zone) => {
    const zones = get().zones.filter((z) => z !== zone);
    set({ zones });
    void saveJson(KEYS.cities, zones);
  },
}));
