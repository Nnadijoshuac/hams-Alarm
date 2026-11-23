import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AnalogDial } from '../../components/AnalogDial';
import { RoundButton } from '../../components/RoundButton';
import { digits, font, space, useTheme, type Colors, type TypeSet, type Numerals } from '../../lib/theme';
import { formatStopwatch } from '../../lib/time';
import { useStopwatch } from '../../store/stopwatch';
import { Screen } from '../../components/Screen';
import { Digits } from '../../components/Digits';
import { Illustration } from '../../components/Illustration';

/** Re-render at display rate while running and focused. */
function useTicker(active: boolean) {
  const [, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      let raf = 0;
      const loop = () => {
        setTick((t) => t + 1);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, [active]),
  );
}

function StopwatchScreenContent() {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const { running, laps, elapsed, start, stop, lap, reset } = useStopwatch();
  const { width } = useWindowDimensions();
  useTicker(running);
  const total = elapsed();
  const dial = Math.min(width - space.xl * 2, 300);

  // Lap durations from cumulative splits (laps are newest first).
  const splits = laps.map((t, i) => t - (laps[i + 1] ?? 0));
  const best = splits.length > 1 ? Math.min(...splits) : null;
  const worst = splits.length > 1 ? Math.max(...splits) : null;

  const text = formatStopwatch(total);

  const header = (
    <View>
      <View style={styles.top}>
        <Text style={type.eyebrow}>Stopwatch</Text>
        <Illustration name="stopwatch" size={40} />
      </View>

      <View style={styles.hero}>
        <AnalogDial
          size={dial}
          secondAngle={((total / 1000) % 60) * 6}
          labels={['60', '15', '30', '45']}
          subdial={(total / 60_000 / 30) % 1}
        />
        <View style={styles.readout}>
          <Digits value={text.slice(0, -3)} size={total >= 3_600_000 ? 60 : 80} />
          <Digits value={text.slice(-3)} size={38} color={colors.accent} family={digits.bold} style={styles.hundredths} />
        </View>
        <View style={styles.controls}>
          <RoundButton label={running ? 'Lap' : 'Reset'} onPress={running ? lap : reset} disabled={!running && total === 0} />
          <RoundButton label={running ? 'Stop' : total > 0 ? 'Resume' : 'Start'} primary strong onPress={running ? stop : start} />
        </View>
      </View>

      {laps.length > 0 && (
        <View style={styles.lapHeader}>
          <Text style={type.eyebrow}>Laps</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={splits}
        ListHeaderComponent={header}
        keyExtractor={(_, i) => String(laps.length - i)}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const n = laps.length - index;
          const tone = item === best ? colors.accent : item === worst ? colors.textDim : colors.text;
          return (
            <Animated.View entering={index === 0 ? FadeInUp.springify() : undefined} style={styles.lap}>
              <Text style={[type.caption, { width: 56, fontFamily: font.semibold }]}>Lap {n}</Text>
              <View style={{ flex: 1 }}>
                <Digits value={formatStopwatch(item)} size={26} color={tone} family={digits.bold} />
              </View>
              <Digits value={formatStopwatch(laps[index])} size={16} color={colors.textFaint} family={digits.semibold} />
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { alignItems: 'center', paddingBottom: space.xl },
  readout: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.xl },
  hundredths: { marginBottom: 6, marginLeft: 2 },
  controls: { flexDirection: 'row', gap: space.xl, marginTop: space.xl },
  lapHeader: { paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});

export default function StopwatchScreen() {
  return (
    <Screen theme="plum" edges={['top']}>
      <StopwatchScreenContent />
    </Screen>
  );
}
