import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';

const W = 54;
const H = 32;
const THUMB = 24;
const PAD = (H - THUMB) / 2;

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/** Amber pill switch with a springy thumb and haptic tick. */
export function Toggle({ value, onChange, accessibilityLabel, disabled }: Props) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const p = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    p.set(withSpring(value ? 1 : 0, spring));
  }, [value, p]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.textFaint, colors.accent]),
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * (W - THUMB - PAD * 2) }, { scale: 1 + Math.sin(p.value * Math.PI) * 0.12 }],
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.bg, colors.onAccent]),
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(value ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
        onChange(!value);
      }}
    >
      <Animated.View style={[styles.track, track, disabled && { opacity: 0.4 }]}>
        <Animated.View style={[styles.thumb, thumb]} />
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  track: { width: W, height: H, borderRadius: H / 2, padding: PAD, justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2 },
});
