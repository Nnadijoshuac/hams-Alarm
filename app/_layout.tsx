import * as Notifications from 'expo-notifications';
import {
  LeagueSpartan_400Regular,
  LeagueSpartan_500Medium,
  LeagueSpartan_600SemiBold,
  LeagueSpartan_700Bold,
  LeagueSpartan_800ExtraBold,
  LeagueSpartan_900Black,
  useFonts,
} from '@expo-google-fonts/league-spartan';
import { DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { onRing, syncAll } from '../lib/engine';
import { isRingData, presentedRings } from '../lib/notifications';
import { KEYS, loadJson } from '../lib/storage';
import { handleNotificationResponse } from '../lib/tasks';
import { colors } from '../lib/theme';
import { useAlarms } from '../store/alarms';
import { useCities } from '../store/cities';
import { useStopwatch } from '../store/stopwatch';
import { useTimer } from '../store/timer';
import { ringScreen } from '../lib/ringState';
import { CRASH_EVENT, CrashScreen, describe, lastCrash } from '../lib/crash';

void SystemUI.setBackgroundColorAsync(colors.bg);
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// While the app is open the ring screen plays the sound itself, so the
// notification is shown silently and we jump straight to the ring screen.
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const ring = isRingData(n.request.content.data);
    return {
      shouldShowBanner: !ring,
      shouldShowList: true,
      shouldPlaySound: !ring,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
    };
  },
});

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.text, border: colors.border },
};

/** `woke`: opened because the phone/app was woken by the alarm (launch or return to foreground). */
function openRing(key: string, woke = false) {
  if (ringScreen.openKey === key) return;
  router.push({ pathname: '/ring', params: { key, woke: woke ? '1' : '0' } });
}

async function reloadAll() {
  await Promise.all([
    useAlarms.getState().reload(),
    useTimer.getState().reload(),
    useStopwatch.getState().reload(),
    useCities.getState().reload(),
  ]);
}

/** Anything ringing (notification on screen, or the app was opened from one)? */
async function checkRinging() {
  const last = await Notifications.getLastNotificationResponseAsync().catch(() => null);
  if (last) {
    await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    // Stop / Snooze were already handled by the listener or background task
    // (and are de-duplicated anyway); a plain tap means "show me the alarm".
    const data = last.notification.request.content.data;
    if (last.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && isRingData(data)) {
      const rings = await presentedRings().catch(() => []);
      if (rings.some((r) => r.key === data.key)) return openRing(data.key, true);
    } else {
      await handleNotificationResponse(last);
    }
  }
  const rings = await presentedRings().catch(() => []);
  if (rings.length > 0) openRing(rings[0].key, true);
}

/** Any render error in a screen shows the crash report instead of closing the app. */
export function ErrorBoundary({ error }: { error: Error }) {
  return <CrashScreen error={describe(error)} />;
}

export default function RootLayout() {
  const [crash, setCrash] = useState<string | null>(lastCrash);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(CRASH_EVENT, (e: string) => setCrash(e));
    return () => sub.remove();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    LeagueSpartan_400Regular,
    LeagueSpartan_500Medium,
    LeagueSpartan_600SemiBold,
    LeagueSpartan_700Bold,
    LeagueSpartan_800ExtraBold,
    LeagueSpartan_900Black,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let mounted = true;
    (async () => {
      await reloadAll();
      // Re-registers geofences & schedules: covers reboots, app updates, and
      // anything that happened while the app was killed.
      // Never let a failing native feature (e.g. background location in Expo Go) block startup.
      await syncAll('launch').catch((e) => console.warn('[arrive] launch sync failed', e));
      await reloadAll();
      if (!mounted) return;
      const onboarded = await loadJson<boolean>(KEYS.onboarded, false);
      if (!onboarded) router.push({ pathname: '/permissions', params: { onboarding: '1' } });
      await checkRinging();
    })();

    const appState = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      await syncAll('foreground').catch((e) => console.warn('[arrive] sync failed', e));
      await reloadAll();
      await checkRinging();
    });

    const received = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data;
      if (isRingData(data)) openRing(data.key);
    });

    const responses = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const result = await handleNotificationResponse(response);
      const data = response.notification.request.content.data;
      if (result === 'open' && isRingData(data)) openRing(data.key);
      await reloadAll();
    });

    const offRing = onRing((key) => {
      if (AppState.currentState === 'active') openRing(key);
    });

    return () => {
      mounted = false;
      appState.remove();
      received.remove();
      responses.remove();
      offRing();
    };
  }, [ready]);

  if (crash) return <CrashScreen error={crash} />;
  if (!ready) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alarm/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="cities" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="permissions" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="ring" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </ThemeProvider>
  );
}
