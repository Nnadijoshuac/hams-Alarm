import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { LatLng } from '../lib/geo';

/**
 * Foreground-only position for live distances, active while the screen is
 * focused. Never prompts: if permission isn't granted it just returns null.
 */
export function useLivePosition(enabled: boolean): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let sub: Location.LocationSubscription | null = null;
      let cancelled = false;
      (async () => {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted || cancelled) return;
        const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
        if (last && !cancelled) setPos(last.coords);
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 5000 },
          (l) => setPos({ latitude: l.coords.latitude, longitude: l.coords.longitude }),
        ).catch(() => null);
        if (cancelled) sub?.remove();
      })();
      return () => {
        cancelled = true;
        sub?.remove();
      };
    }, [enabled]),
  );

  return pos;
}
