import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { font, space, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';
import { describeRepeat, formatClock, formatDuration } from '../lib/time';
import type { Alarm } from '../lib/types';
import { PressableScale } from './PressableScale';
import { Digits } from './Digits';

/** The next alarm as pure typography: lots of space, one heavy time, one amber line. */
export function NextAlarmHero({ alarm, at, now, onPress }: { alarm: Alarm; at: number; now: number; onPress: () => void }) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const name = alarm.name.trim() || 'Alarm';
  return (
    <Animated.View entering={FadeIn.duration(500)}>
      <PressableScale onPress={onPress} scaleTo={0.98} style={styles.wrap} accessibilityLabel={`Next alarm ${name} at ${formatClock(alarm.time)}`}>
        <Text style={[type.eyebrow, styles.kicker]}>Next · in {formatDuration(at - now)}</Text>
        <Digits value={formatClock(alarm.time)} size={124} sepColor={colors.accent} style={styles.time} />
        <Text style={styles.name} numberOfLines={1}>
          {name}
          <Text style={{ color: colors.textFaint, fontFamily: font.medium }}>{`  ·  ${describeRepeat(alarm.repeatDays)}`}</Text>
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: space.lg, paddingBottom: space.xxl },
  kicker: { color: colors.accent, letterSpacing: 2.4 },
  time: { marginTop: space.sm },
  name: { fontFamily: font.semibold, fontSize: 15, color: colors.textDim, marginTop: space.xs },
});
