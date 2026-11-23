import { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BatteryCharging, Bell, Check, LocateFixed, MapPinned, Timer, type LucideIcon } from 'lucide-react-native';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '../components/ui';
import { useHealth } from '../hooks/useHealth';
import { syncAll } from '../lib/engine';
import {
  openBatterySettings,
  requestBackgroundLocation,
  requestExactAlarms,
  requestForegroundLocation,
  requestNotifications,
} from '../lib/permissions';
import { KEYS, saveJson } from '../lib/storage';
import { palette, space, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';
import { Screen } from '../components/Screen';
import { IllustrationDisc } from '../components/Illustration';

interface Step {
  key: string;
  icon: LucideIcon;
  title: string;
  why: string;
  done: boolean | null; // null = can't be checked (optional step)
  locked?: string;
  action: string;
  onPress: () => void;
}

function PermissionsScreenContent() {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const [health, refresh] = useHealth();

  const steps: Step[] = [
    {
      key: 'notifications',
      icon: Bell,
      title: 'Notifications',
      why: 'Alarms ring through notifications, with Stop and Snooze buttons right on the lock screen.',
      done: health?.notifications ?? false,
      action: 'Allow',
      onPress: () => void requestNotifications().then(refresh),
    },
    ...(Platform.OS === 'android'
      ? [
          {
            key: 'exact',
            icon: Timer,
            title: 'Alarms & reminders',
            why: 'Lets time alarms ring exactly on the minute, even when the phone is idle.',
            done: health?.exactAlarms ?? false,
            action: 'Open',
            onPress: requestExactAlarms,
          },
        ]
      : []),
    {
      key: 'location',
      icon: LocateFixed,
      title: 'Location while using the app',
      why: 'To find destinations, drop pins near you and show how far away each one is.',
      done: health?.locationForeground ?? false,
      action: 'Allow',
      onPress: () => void requestForegroundLocation().then(refresh),
    },
    {
      key: 'background',
      icon: MapPinned,
      title: 'Location all the time',
      why: 'So Hams_Alarm notices you reaching a destination while it’s closed or the screen is off. On the next screen, choose “Allow all the time”. Only used while a location alarm is on.',
      done: health?.locationBackground ?? false,
      locked: health && !health.locationForeground ? 'Allow location while using the app first.' : undefined,
      action: 'Allow',
      onPress: () => void requestBackgroundLocation().then(refresh),
    },
    ...(Platform.OS === 'android'
      ? [
          {
            key: 'battery',
            icon: BatteryCharging,
            title: 'Battery optimisation (optional)',
            why: 'Some phones pause background apps aggressively. Setting Hams_Alarm to “Unrestricted” makes arrival alarms more reliable.',
            done: null,
            action: 'Open',
            onPress: () => void openBatterySettings(),
          },
        ]
      : []),
  ];

  const finish = async () => {
    await saveJson(KEYS.onboarded, true);
    void syncAll('foreground');
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {onboarding ? <IllustrationDisc name="hero" diameter={220} color={palette.teal} scale={0.82} style={styles.hero} /> : null}
        <Text style={type.title}>{onboarding ? 'Welcome to Hams_Alarm' : 'Permissions'}</Text>
        <Text style={[type.body, { color: colors.textDim, marginBottom: space.md }]}>
          Hams_Alarm rings at a time, when you reach a place, or both. To do that reliably it needs a few permissions. Nothing
          leaves your phone.
        </Text>

        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <Animated.View key={s.key} entering={FadeInDown.delay(i * 60).springify()} style={[styles.step, s.done && styles.stepDone]}>
              <View style={styles.icon}>
                {s.done ? <Check size={22} color={colors.accent} strokeWidth={2.6} /> : <Icon size={22} color={colors.text} />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={type.heading}>{s.title}</Text>
                <Text style={[type.body, { fontSize: 13, lineHeight: 19, color: colors.textDim }]}>{s.locked ?? s.why}</Text>
              </View>
              {!s.done && (
                <Button label={s.action} variant="secondary" onPress={s.onPress} disabled={!!s.locked} style={styles.stepButton} />
              )}
            </Animated.View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={onboarding ? 'Continue' : 'Done'} size="lg" onPress={finish} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingBottom: space.xxl },
  hero: { alignSelf: 'center', marginBottom: space.lg },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stepDone: { opacity: 0.6 },
  icon: { width: 28, alignItems: 'center' },
  stepButton: { paddingHorizontal: space.lg, minHeight: 40, paddingVertical: 8 },
  footer: { padding: space.lg },
});

export default function PermissionsScreen() {
  return (
    <Screen theme="cream" edges={['top', 'bottom']}>
      <PermissionsScreenContent />
    </Screen>
  );
}
