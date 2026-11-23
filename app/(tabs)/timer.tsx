import * as Haptics from 'expo-haptics';
import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { RoundButton } from '../../components/RoundButton';
import { useNow } from '../../hooks/useNow';
import { digits, space, useTheme, type Colors, type TypeSet, type Numerals } from '../../lib/theme';
import { formatCountdown, pad2 } from '../../lib/time';
import { useTimer } from '../../store/timer';
import { Screen } from '../../components/Screen';
import { Digits } from '../../components/Digits';
import { Illustration } from '../../components/Illustration';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PRESETS = [1, 5, 10, 25];

function TimerScreenContent() {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const { status, durationMs, endAt, remainingMs, setDuration, start, pause, reset, reload } = useTimer();
  const { width } = useWindowDimensions();
  const running = status === 'running';
  const idle = status === 'idle';
  const now = useNow(250, running);

  const size = Math.min(width - space.xl * 2, 310);
  const r = size / 2;
  const arcR = r - 3;
  const circ = 2 * Math.PI * arcR;

  const left = running && endAt ? Math.max(0, endAt - now) : status === 'paused' ? remainingMs : durationMs;
  const progress = durationMs > 0 ? left / durationMs : 0;

  // Finished while open: fall back to idle (the ring screen handles the alarm itself).
  useEffect(() => {
    if (running && endAt && now >= endAt) void reload();
  }, [running, endAt, now, reload]);

  const p = useSharedValue(progress);
  useEffect(() => {
    p.set(withTiming(progress, { duration: running ? 260 : 500, easing: running ? Easing.linear : Easing.out(Easing.cubic) }));
  }, [progress, running, p]);
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));
  const tip = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 360}deg` }] }));

  const adjust = (deltaMin: number) => {
    void Haptics.selectionAsync();
    setDuration(Math.min(99 * 60_000, Math.max(60_000, durationMs + deltaMin * 60_000)));
  };
  const endsAt = running && endAt ? new Date(endAt) : null;
  const caption = endsAt ? `Ends ${pad2(endsAt.getHours())}:${pad2(endsAt.getMinutes())}` : status === 'paused' ? 'Paused' : 'Ready';

  // 60 fine ticks just inside the arc; the ones still "remaining" glow amber.
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const rad = ((i * 6 - 90) * Math.PI) / 180;
    const major = i % 5 === 0;
    const lit = !idle && i / 60 < progress;
    const outer = r - 16;
    const len = major ? 9 : 4;
    return (
      <Line
        key={i}
        x1={r + Math.cos(rad) * outer}
        y1={r + Math.sin(rad) * outer}
        x2={r + Math.cos(rad) * (outer - len)}
        y2={r + Math.sin(rad) * (outer - len)}
        stroke={lit ? colors.accent : major ? colors.textDim : colors.textFaint}
        strokeOpacity={lit ? 0.9 : 1}
        strokeWidth={major ? 1.6 : 1}
        strokeLinecap="round"
      />
    );
  });

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text style={type.eyebrow}>Timer</Text>
        <Illustration name="hourglass" size={40} />
      </View>

      <View style={styles.body}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle cx={r} cy={r} r={arcR} stroke={colors.border} strokeWidth={1} fill="none" />
            {ticks}
            {!idle && (
              <AnimatedCircle
                cx={r}
                cy={r}
                r={arcR}
                stroke={colors.accent}
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circ} ${circ}`}
                animatedProps={arcProps}
                transform={`rotate(-90 ${r} ${r})`}
              />
            )}
          </Svg>
          {/* Glowing tip at the end of the arc. */}
          {!idle && (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, tip]}>
              <View style={[styles.tip, { left: r - 7, top: 3 - 7 }]} />
            </Animated.View>
          )}

          <Digits value={formatCountdown(left)} size={left >= 3_600_000 ? 64 : 92} color={running ? colors.accent : colors.text} />
          <View style={styles.adjustRow}>
            {idle && (
              <Pressable onPress={() => adjust(-1)} hitSlop={12} style={styles.adjust} accessibilityLabel="One minute less">
                <Minus size={16} color={colors.textDim} />
              </Pressable>
            )}
            <Text style={[type.eyebrow, { letterSpacing: 2.4, color: running ? colors.accent : colors.textFaint }]}>{caption}</Text>
            {idle && (
              <Pressable onPress={() => adjust(1)} hitSlop={12} style={styles.adjust} accessibilityLabel="One minute more">
                <Plus size={16} color={colors.textDim} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.presets, !idle && { opacity: 0 }]} pointerEvents={idle ? 'auto' : 'none'}>
          {PRESETS.map((m) => {
            const active = durationMs === m * 60_000;
            return (
              <Pressable
                key={m}
                hitSlop={10}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setDuration(m * 60_000);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${m} minutes`}
                style={styles.preset}
              >
                <Text style={[numerals(30, digits.bold), { color: active ? colors.accent : colors.textDim }]}>{m}</Text>
                <View style={[styles.presetDot, active && { backgroundColor: colors.accent }]} />
              </Pressable>
            );
          })}
          <Text style={[type.eyebrow, { marginBottom: 14 }]}>min</Text>
        </View>

        <View style={styles.controls}>
          <RoundButton label="Reset" onPress={() => void reset()} disabled={idle} />
          <RoundButton
            label={running ? 'Pause' : status === 'paused' ? 'Resume' : 'Start'}
            primary
            strong
            onPress={() => void (running ? pause() : start())}
          />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl },
  body: { flex: 1, alignItems: 'center', paddingTop: space.lg },
  tip: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.bg,
  },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.xs },
  adjust: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presets: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xl, marginTop: space.xxl },
  preset: { alignItems: 'center', gap: 6 },
  presetDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  controls: { flexDirection: 'row', gap: space.xl, marginTop: 'auto', marginBottom: space.xxl },
});

export default function TimerScreen() {
  return (
    <Screen theme="ruby" edges={['top']}>
      <TimerScreenContent />
    </Screen>
  );
}
