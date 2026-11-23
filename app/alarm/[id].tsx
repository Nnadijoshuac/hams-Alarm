import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { BellRing, FlaskConical, LogIn, LogOut, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { DayPicker } from '../../components/DayPicker';
import { MapPicker } from '../../components/MapPicker';
import { ModePicker } from '../../components/ModePicker';
import { RadiusRuler } from '../../components/RadiusRuler';
import { TimeField } from '../../components/TimeField';
import { Toggle } from '../../components/Toggle';
import { Button, IconButton, SectionLabel } from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import { handleTransition, ringNow } from '../../lib/engine';
import { readHealth } from '../../lib/health';
import { space, useTheme, type Colors, type TypeSet, type Numerals } from '../../lib/theme';
import { formatClock, formatDuration, nextOccurrence, windowMinutes } from '../../lib/time';
import { type Alarm, type ClockTime } from '../../lib/types';
import { newAlarmId, useAlarms } from '../../store/alarms';
import { Screen } from '../../components/Screen';
import { Digits } from '../../components/Digits';

function blankAlarm(): Alarm {
  const now = Date.now();
  return {
    id: newAlarmId(),
    name: '',
    enabled: true,
    mode: 'time',
    time: { hour: 7, minute: 0 },
    repeatDays: [],
    destination: null,
    radius: 300,
    windowEnd: null,
    armedAt: now,
    createdAt: now,
  };
}


function EditAlarmScreenContent() {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useAlarms((s) => s.alarms.find((a) => a.id === id));
  const upsert = useAlarms((s) => s.upsert);
  const remove = useAlarms((s) => s.remove);
  const isNew = !existing;

  // Until the user changes something, show the saved alarm straight from the
  // store. That way a screen opened before the store finished loading (cold
  // start / deep link) picks the alarm up as soon as it arrives, and Save can
  // never overwrite it with a blank draft.
  const [blank] = useState(blankAlarm);
  const [edited, setEdited] = useState<Alarm | null>(null);
  const draft = edited ?? existing ?? blank;
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Alarm>) => setEdited((d) => ({ ...(d ?? existing ?? blank), ...patch }));

  const needsTime = draft.mode !== 'location';
  const needsPlace = draft.mode !== 'time';
  const valid = !needsPlace || !!draft.destination;

  const now = useNow(30_000);
  const preview = useMemo(() => {
    if (!needsTime) return null;
    const next = nextOccurrence({ ...draft, armedAt: now }, now);
    return next ? `Rings in ${formatDuration(next - now)}${draft.mode === 'both' ? ' if you are there' : ''}` : null;
  }, [draft, needsTime, now]);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    await upsert({ ...draft, enabled: true, armedAt: Date.now() });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const health = await readHealth();
    router.back();
    const missing =
      !health.notifications ||
      (needsTime && !health.exactAlarms) ||
      (needsPlace && (!health.locationForeground || !health.locationBackground));
    if (missing) router.push('/permissions');
  };

  const del = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    router.back();
    await remove(draft.id);
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <IconButton icon={X} label="Close" onPress={() => router.back()} />
        <Text style={type.heading}>{isNew ? 'New alarm' : 'Edit alarm'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={draft.name}
            onChangeText={(name) => set({ name })}
            placeholder="Name this alarm"
            placeholderTextColor={colors.textFaint}
            style={[type.title, styles.name]}
            maxLength={40}
          />

          <ModePicker value={draft.mode} onChange={(mode) => set({ mode })} />
          <Text style={[type.caption, styles.modeHint]}>
            {draft.mode === 'time' && 'Rings at the set time.'}
            {draft.mode === 'location' && 'Rings when you enter the area. Turns itself off afterwards.'}
            {draft.mode === 'both' &&
              'Rings only when it’s time and you’re in the area. Arrive early and it waits for the time; reach the time first and it waits for you.'}
          </Text>

          {needsTime && (
            <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition.springify()} style={{ gap: space.lg }}>
              <View style={styles.timeBlock}>
                <TimeField label="Alarm time" value={draft.time} onChange={(time) => set({ time })} />
                {preview && <Text style={[type.label, { color: colors.accent }]}>{preview}</Text>}
              </View>
              <View>
                <SectionLabel>Repeat</SectionLabel>
                <DayPicker value={draft.repeatDays} onChange={(repeatDays) => set({ repeatDays })} />
              </View>
            </Animated.View>
          )}

          {draft.mode === 'both' && (
            <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition.springify()}>
              <View style={[styles.section, { gap: space.md }]}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.body}>Time window</Text>
                    <Text style={type.caption}>Skip the alarm if you haven’t arrived by the end.</Text>
                  </View>
                  <Toggle
                    value={!!draft.windowEnd}
                    onChange={(on) =>
                      set({ windowEnd: on ? { hour: (draft.time.hour + 2) % 24, minute: draft.time.minute } : null })
                    }
                    accessibilityLabel="Time window"
                  />
                </View>
                {draft.windowEnd && (
                  <View style={styles.windowRow}>
                    <Digits value={formatClock(draft.time)} size={34} color={colors.textDim} />
                    <Text style={[type.label]}>to</Text>
                    <TimeField
                      label="Window end"
                      value={draft.windowEnd}
                      onChange={(windowEnd: ClockTime) => set({ windowEnd })}
                      size={34}
                    />
                    <Text style={[type.caption, { marginLeft: 'auto' }]}>
                      {formatDuration(windowMinutes(draft.time, draft.windowEnd) * 60_000)}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {needsPlace && (
            <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition.springify()} style={{ gap: space.lg }}>
              <View>
                <SectionLabel>Destination</SectionLabel>
                <MapPicker value={draft.destination} radius={draft.radius} onChange={(destination) => set({ destination })} />
              </View>
              <View style={styles.section}>
                <RadiusRuler value={draft.radius} onChange={(radius) => set({ radius })} />
              </View>
            </Animated.View>
          )}

          {__DEV__ && !isNew && <DevTools alarm={existing!} />}

          {!isNew && <Button label="Delete alarm" variant="danger" icon={Trash2} onPress={del} />}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button
          label={valid ? (isNew ? 'Save alarm' : 'Save changes') : 'Choose a destination'}
          size="lg"
          onPress={save}
          disabled={!valid}
          loading={saving}
        />
      </View>
    </View>
  );
}

/** Dev builds only: drive the real geofence / ring code paths without walking anywhere. */
function DevTools({ alarm }: { alarm: Alarm }) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const [msg, setMsg] = useState<string | null>(null);
  const run = (label: string, fn: () => Promise<void>) => async () => {
    setMsg(`${label}…`);
    try {
      await fn();
      setMsg(`${label}: done`);
    } catch (e) {
      setMsg(`${label} failed: ${String(e)}`);
    }
  };
  return (
    <View style={styles.dev}>
      <View style={[styles.row, { justifyContent: 'flex-start', gap: space.sm }]}>
        <FlaskConical size={16} color={colors.accent} />
        <Text style={[type.label, { color: colors.accent }]}>DEV · Test trigger</Text>
      </View>
      {!alarm.enabled && <Text style={type.caption}>Switch the alarm on first — disabled alarms ignore arrivals.</Text>}
      {alarm.mode !== 'time' && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            label="Simulate arrival"
            icon={LogIn}
            variant="secondary"
            style={{ flex: 1, paddingHorizontal: space.md }}
            onPress={run('Arrival', () => handleTransition(alarm.id, true, 'dev'))}
          />
          <Button
            label="Leave"
            icon={LogOut}
            variant="secondary"
            style={{ paddingHorizontal: space.md }}
            onPress={run('Leave', () => handleTransition(alarm.id, false, 'dev'))}
          />
        </View>
      )}
      <Button label="Ring now" icon={BellRing} variant="secondary" onPress={run('Ring', () => ringNow(alarm.id))} />
      {msg && <Text style={type.caption}>{msg}</Text>}
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  name: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modeHint: { marginTop: -space.md, lineHeight: 18 },
  timeBlock: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  windowRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  dev: { gap: space.md, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  section: { paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});

export default function EditAlarmScreen() {
  return (
    <Screen theme="cream" edges={['top', 'bottom']}>
      <EditAlarmScreenContent />
    </Screen>
  );
}
