import { Navigation } from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { distanceMeters, formatDistance, formatRadius, type LatLng } from '../lib/geo';
import { digits, font, space, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';
import { describeRepeat, formatClock } from '../lib/time';
import type { Alarm } from '../lib/types';
import { ModeTile } from './ModeTile';
import { PressableScale } from './PressableScale';
import { Toggle } from './Toggle';

interface Props {
  alarm: Alarm;
  position: LatLng | null;
  onPress: () => void;
  onToggle: (enabled: boolean) => void;
}


export const AlarmCard = memo(function AlarmCard({ alarm, position, onPress, onToggle }: Props) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const dim = !alarm.enabled;
  const distance = position && alarm.destination ? distanceMeters(position, alarm.destination) : null;
  const inside = distance !== null && distance <= alarm.radius;

  const primary =
    alarm.mode === 'location'
      ? distance !== null
        ? inside
          ? 'Here'
          : formatDistance(distance)
        : formatRadius(alarm.radius)
      : formatClock(alarm.time);

  // "1.2 km" → big "1.2" + small "km": the number carries the weight.
  const [value, unit] = primary.includes(' ') ? [primary.split(' ')[0], primary.split(' ')[1]] : [primary, ''];
  const showsDistance = alarm.mode === 'location' && distance !== null;

  const meta: string[] = [];
  if (alarm.mode !== 'time' && alarm.destination) meta.push(alarm.destination.label);
  if (alarm.mode !== 'location') meta.push(describeRepeat(alarm.repeatDays));
  if (alarm.mode === 'both' && alarm.windowEnd) meta.push(`until ${formatClock(alarm.windowEnd)}`);
  if (alarm.mode === 'both' || showsDistance) meta.push(`${formatRadius(alarm.radius)} radius`);

  const name = alarm.name.trim() || (alarm.mode === 'time' ? 'Alarm' : alarm.destination?.label ?? 'Destination');
  const caption = alarm.mode === 'location' && !showsDistance ? 'Radius' : null;

  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={styles.row} accessibilityLabel={`${name}, ${primary}`}>
      <ModeTile mode={alarm.mode} size={56} dim={dim} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, dim && styles.dimText]} numberOfLines={1}>
          {name}
          {caption ? <Text style={styles.dimText}>{`  ·  ${caption.toLowerCase()}`}</Text> : null}
        </Text>
        <View style={styles.primaryRow}>
          <Text style={[styles.primary, dim && styles.dimText]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          {!!unit && <Text style={[styles.unit, dim && styles.dimText]}>{unit}</Text>}
          {alarm.mode === 'both' && distance !== null && (
            <View style={styles.distance}>
              <Navigation size={11} color={inside ? colors.accent : colors.textDim} />
              <Text style={[type.caption, { fontFamily: font.semibold, color: inside ? colors.accent : colors.textDim }]}>
                {inside ? 'here' : formatDistance(distance)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          <Text style={[type.caption, styles.meta, dim && styles.dimText]} numberOfLines={1}>
            {meta.join('  ·  ')}
          </Text>
        </View>
      </View>
      <Toggle value={alarm.enabled} onChange={onToggle} accessibilityLabel={`Enable ${name}`} />
    </PressableScale>
  );
});

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { fontFamily: font.semibold, fontSize: 14, color: colors.textDim },
  primaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  primary: { ...numerals(50, digits.black), letterSpacing: -1, flexShrink: 1, marginTop: 4 },
  unit: { ...numerals(24, digits.bold), color: colors.textDim },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flexShrink: 1, color: colors.textFaint },
  dimText: { color: colors.textFaint },
});
