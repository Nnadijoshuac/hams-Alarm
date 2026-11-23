import { router } from 'expo-router';
import { BellOff, LocateOff, MapPinOff, Plus, TimerOff } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { AlarmCard } from '../../components/AlarmCard';
import { NextAlarmHero } from '../../components/NextAlarmHero';
import { Banner, Button, IconButton } from '../../components/ui';
import { useHealth } from '../../hooks/useHealth';
import { useLivePosition } from '../../hooks/useLivePosition';
import { useNow } from '../../hooks/useNow';
import { enableLocationServices, requestExactAlarms, requestNotifications } from '../../lib/permissions';
import { palette, space, useTheme, type Colors, type TypeSet, type Numerals } from '../../lib/theme';
import { nextOccurrence } from '../../lib/time';
import { useAlarms } from '../../store/alarms';
import { Screen } from '../../components/Screen';
import { IllustrationDisc } from '../../components/Illustration';

function AlarmsScreenContent() {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const alarms = useAlarms((s) => s.alarms);
  const hydrated = useAlarms((s) => s.hydrated);
  const setEnabled = useAlarms((s) => s.setEnabled);
  const [health, refreshHealth] = useHealth();
  const now = useNow(30_000);

  const hasLocationAlarms = alarms.some((a) => a.mode !== 'time');
  const position = useLivePosition(hasLocationAlarms && !!health?.locationForeground);

  const enabledLocation = alarms.some((a) => a.enabled && a.mode !== 'time');
  const enabledTime = alarms.some((a) => a.enabled && a.mode !== 'location');

  const next = useMemo(() => {
    let best: { alarm: (typeof alarms)[number]; at: number } | null = null;
    for (const a of alarms) {
      if (!a.enabled || a.mode !== 'time') continue;
      const at = nextOccurrence(a, now);
      if (at !== null && (!best || at < best.at)) best = { alarm: a, at };
    }
    return best;
  }, [alarms, now]);

  const subtitle = next
    ? undefined
    : enabledLocation
      ? 'Watching for your arrival'
      : alarms.length
        ? 'No alarms on'
        : undefined;

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View>
          <Text style={type.eyebrow}>Alarms</Text>
          {subtitle ? <Text style={[type.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
        </View>
        <IconButton icon={Plus} label="New alarm" tone="accent" onPress={() => router.push('/alarm/new')} size={40} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {health && !health.notifications && (enabledTime || enabledLocation) && (
          <Banner
            icon={BellOff}
            title="Notifications are off"
            body="Alarms can't ring without them."
            action="Allow"
            onAction={() => requestNotifications().then(refreshHealth)}
          />
        )}
        {health && !health.exactAlarms && enabledTime && (
          <Banner
            icon={TimerOff}
            title="Exact alarms are off"
            body="Time alarms may ring a few minutes late."
            action="Fix"
            onAction={requestExactAlarms}
          />
        )}
        {health && enabledLocation && !health.locationServices && (
          <Banner
            icon={LocateOff}
            title="Location is turned off"
            body="Location alarms can't detect your arrival."
            action="Turn on"
            onAction={() => enableLocationServices().then(refreshHealth)}
          />
        )}
        {health && enabledLocation && health.locationServices && !health.locationBackground && (
          <Banner
            icon={MapPinOff}
            title="Allow location all the time"
            body="Needed to ring while Hams_Alarm is closed."
            action="Allow"
            onAction={() => router.push('/permissions')}
          />
        )}

        {hydrated && alarms.length === 0 && (
          <Animated.View entering={FadeInDown.springify()} style={styles.empty}>
            <IllustrationDisc name="hero" diameter={240} color={palette.teal} scale={0.82} />
            <Text style={[type.title, { textAlign: 'center', marginTop: space.lg }]}>No alarms yet</Text>
            <Text style={[type.body, { color: colors.textDim, textAlign: 'center' }]}>
              Ring at a time, when you reach a place, or only when both are true.
            </Text>
            <Button label="New alarm" icon={Plus} onPress={() => router.push('/alarm/new')} style={{ marginTop: space.md }} />
          </Animated.View>
        )}

        {next && (
          <NextAlarmHero
            alarm={next.alarm}
            at={next.at}
            now={now}
            onPress={() => router.push({ pathname: '/alarm/[id]', params: { id: next.alarm.id } })}
          />
        )}

        {alarms.length > 0 && (
          <View style={styles.listHeader}>
            <Text style={type.eyebrow}>{`All · ${alarms.length}`}</Text>
          </View>
        )}

        {alarms.map((alarm, i) => (
          <Animated.View
            key={alarm.id}
            entering={FadeInDown.delay(i * 40).springify()}
            exiting={FadeOut.duration(180)}
            layout={LinearTransition.springify().damping(18)}
          >
            <AlarmCard
              alarm={alarm}
              position={position}
              onPress={() => router.push({ pathname: '/alarm/[id]', params: { id: alarm.id } })}
              onToggle={(on) => void setEnabled(alarm.id, on)}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, minHeight: 56 },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl * 2 },
  listHeader: { paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  empty: { alignItems: 'center', gap: space.sm, paddingTop: space.lg, paddingHorizontal: space.md },
});

export default function AlarmsScreen() {
  return (
    <Screen theme="cream" edges={['top']}>
      <AlarmsScreenContent />
    </Screen>
  );
}
