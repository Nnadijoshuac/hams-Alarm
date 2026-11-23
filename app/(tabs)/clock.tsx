import { router } from 'expo-router';
import { Pencil, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { AnalogDial } from '../../components/AnalogDial';
import { IconButton } from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import { palette, font, space, useTheme, type Colors, type TypeSet, type Numerals } from '../../lib/theme';
import { pad2 } from '../../lib/time';
import { cityFromKey, describeOffset, zonedParts } from '../../lib/zones';
import { useCities } from '../../store/cities';
import { Screen } from '../../components/Screen';
import { Digits } from '../../components/Digits';
import { IllustrationDisc } from '../../components/Illustration';

function ClockScreenContent() {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const now = useNow(1000);
  const { width } = useWindowDimensions();
  const zones = useCities((s) => s.zones);
  const remove = useCities((s) => s.remove);
  const [editing, setEditing] = useState(false);

  const d = new Date(now);
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  const dial = Math.min(width - space.xl * 2, 330);
  const dateLine = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Text style={type.eyebrow}>Clock</Text>
          {zones.length > 0 && (
            <Pressable hitSlop={12} onPress={() => setEditing((e) => !e)} accessibilityLabel={editing ? 'Done' : 'Edit cities'}>
              {editing ? <X size={18} color={colors.textDim} /> : <Pencil size={16} color={colors.textDim} />}
            </Pressable>
          )}
        </View>

        <View style={styles.hero} accessible accessibilityLabel={`${h}:${pad2(m)}, ${dateLine}`}>
          <AnalogDial
            size={dial}
            hourAngle={((h % 12) + m / 60) * 30}
            minuteAngle={(m + s / 60) * 6}
            // Aim at the next second; the hand glides there over the coming second.
            secondAngle={(s + 1) * 6}
            sweep
          />
          <Digits value={`${pad2(h)}:${pad2(m)}`} size={96} sepColor={colors.accent} style={styles.time} />
          <Text style={[type.eyebrow, styles.date]}>{dateLine}</Text>
          <Text style={[type.caption, { marginTop: 4 }]}>{zone}</Text>
        </View>

        <View style={styles.worldHeader}>
          <Text style={type.eyebrow}>World</Text>
          <Pressable onPress={() => router.push('/cities')} hitSlop={12} style={styles.add} accessibilityLabel="Add city">
            <Plus size={14} color={colors.accent} strokeWidth={2} />
            <Text style={[type.label, { color: colors.accent }]}>Add city</Text>
          </Pressable>
        </View>

        {zones.length === 0 && (
          <Pressable onPress={() => router.push('/cities')} style={styles.emptyWorld}>
            <IllustrationDisc name="globe" diameter={84} color={palette.cream} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={type.heading}>Around the world</Text>
              <Text style={[type.caption, { color: colors.textDim }]}>Add a city to compare time zones.</Text>
            </View>
          </Pressable>
        )}

        {zones.map((key) => {
          const city = cityFromKey(key);
          let time = '--:--';
          let rel = { diff: '', day: 'Today' as string };
          try {
            const p = zonedParts(city.zone, now);
            time = `${pad2(p.hour)}:${pad2(p.minute)}`;
            rel = describeOffset(city.zone, now);
          } catch {
            // Unknown zone on this device's ICU data: show placeholders.
          }
          return (
            <Animated.View key={key} entering={FadeIn} exiting={FadeOut} layout={LinearTransition.springify()} style={styles.row}>
              {editing && (
                <Animated.View entering={ZoomIn} exiting={ZoomOut} style={{ marginRight: space.md }}>
                  <IconButton icon={X} label={`Remove ${city.name}`} onPress={() => remove(key)} size={32} />
                </Animated.View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[type.heading, { fontFamily: font.semibold }]}>{city.name}</Text>
                <Text style={type.caption}>
                  {rel.day} · {rel.diff}
                </Text>
              </View>
              <Digits value={time} size={44} />
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl * 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
  hero: { alignItems: 'center', paddingTop: space.lg, paddingBottom: space.xxl * 1.5 },
  time: { marginTop: space.xl },
  date: { marginTop: space.xs, letterSpacing: 2.4, color: colors.textDim },
  worldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emptyWorld: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});

export default function ClockScreen() {
  return (
    <Screen theme="teal" edges={['top']}>
      <ClockScreenContent />
    </Screen>
  );
}
