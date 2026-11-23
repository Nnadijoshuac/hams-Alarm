import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { readHealth, type Health } from '../lib/health';

export type { Health };

/** Permission / service state, refreshed on focus and when returning from Settings. */
export function useHealth(): [Health | null, () => void] {
  const [health, setHealth] = useState<Health | null>(null);
  const refresh = useCallback(() => {
    void readHealth().then(setHealth);
  }, []);

  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  return [health, refresh];
}
