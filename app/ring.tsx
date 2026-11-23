import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, Text, useWindowDimensions, Vibration, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Digits } from '../components/Digits';
import { RoundButton } from '../components/RoundButton';
import { useNow } from '../hooks/useNow';
import { ringInfo, snoozeRing, stopRing, takeOverRing } from '../lib/engine';
import { ringScreen } from '../lib/ringState';
import { palette, space, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';
import { formatClock } from '../lib/time';
import { SNOOZE_MINUTES, TIMER_KEY } from '../lib/types';
import { useAlarms } from '../store/alarms';
import { useTimer } from '../store/timer';
import { Screen } from '../components/Screen';
import { Illustration } from '../components/Illustration';
import { presentedRings } from '../lib/notifications';

const SOUND = require('../assets/sounds/alarm.wav');
const VIBRATION = [0, 800, 500, 800, 500];

/** The ringing-clock illustration on a cream disc, wiggling like it's really going off. */
function RingingArt({ size }: { size: number }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.set(
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 70 }),
          withTiming(6, { duration: 70 }),
          withTiming(-4, { duration: 70 }),
          withTiming(4, { duration: 70 }),
          withTiming(0, { duration: 70 }),
          withDelay(650, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
      ),
    );
  }, [r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.cream, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={style}>
        <Illustration name="ring" width={size * 0.72} />
      </Animated.View>
    </View>
  );
}

function RingScreenContent() {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const { key, woke } = useLocalSearchParams<{ key: string; woke?: string }>();
  const alarms = useAlarms((s) => s.alarms);
  const info = ringInfo(alarms, key);
  const player = useRef<AudioPlayer | null>(null);
  const now = useNow(1000);
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ringScreen.open(key);
    // The screen owns the sound now: silence the notification chain.
    void takeOverRing(key).catch((e) => console.warn('[arrive] takeover failed', e));
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(
      () => undefined,
    );
    const sound = createAudioPlayer(SOUND);
    sound.loop = true;
    sound.volume = 1;
    sound.play();
    player.current = sound;
    Vibration.vibrate(VIBRATION, true);

    const back = BackHandler.addEventListener('hardwareBackPress', () => true); // must choose Stop or Snooze
    return () => {
      back.remove();
      Vibration.cancel();
      sound.remove();
      player.current = null;
      ringScreen.close(key);
    };
  }, [key]);

  const leave = () => {
    Vibration.cancel();
    player.current?.pause();
    // Always leave the ring screen first, so reopening the app never lands back on a
    // finished ring screen.
    if (router.canGoBack()) router.back();
    else router.replace('/');
    // Woken by the alarm (often over the lock screen): then also close the app so the
    // lock screen comes back instead of the app sitting on top of it.
    if (woke === '1') setTimeout(() => BackHandler.exitApp(), 60);
  };

  const stop = async () => {
    setBusy(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await stopRing(key);
      if (key === TIMER_KEY) await useTimer.getState().reload();
      await useAlarms.getState().reload();
    } catch (e) {
      console.warn('[ring] stop failed', e);
    } finally {
      setBusy(false);
      leave();
    }
  };

  const snooze = async () => {
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await snoozeRing(key);
    } catch (e) {
      console.warn('[ring] snooze failed', e);
    } finally {
      setBusy(false);
      leave();
    }
  };

  // Safety net: if the app comes back to the foreground on this screen but the
  // ring was already stopped (e.g. from the notification), close the screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const rings = await presentedRings().catch(() => null);
      if (rings && !rings.some((r) => r.key === key)) leave();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const date = new Date(now);
  const art = Math.min(width * 0.72, 340);

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.stage}>
        <Text style={[type.eyebrow, { letterSpacing: 3, color: colors.textDim }]}>{key === TIMER_KEY ? 'Timer' : 'Alarm'}</Text>
        <Digits value={formatClock({ hour: date.getHours(), minute: date.getMinutes() })} size={Math.min(124, width * 0.3)} />
        <RingingArt size={art} />
      </Animated.View>

      <View style={styles.info}>
        <Text style={[type.title, { textAlign: 'center' }]} numberOfLines={2}>
          {info.title}
        </Text>
        {!!info.body && (
          <Text style={[type.body, { color: colors.textDim, textAlign: 'center' }]} numberOfLines={2}>
            {info.body}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <RoundButton label="Snooze" hint={`${SNOOZE_MINUTES} min`} onPress={snooze} disabled={busy} />
        <RoundButton label="Stop" primary strong onPress={stop} disabled={busy} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stage: { alignItems: 'center', paddingTop: space.xl, gap: space.md },
  info: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.xs },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: space.xxl, paddingBottom: space.xxl, paddingTop: space.md },
});
export default function RingScreen() {
  return (
    <Screen theme="gold" edges={['top', 'bottom']}>
      <RingScreenContent />
    </Screen>
  );
}
