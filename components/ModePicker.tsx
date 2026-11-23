import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { font, radius, space, spring, useTheme, type Colors } from '../lib/theme';
import type { TriggerMode } from '../lib/types';
import { ModeTile } from './ModeTile';

const OPTIONS: { value: TriggerMode; label: string; hint: string }[] = [
  { value: 'time', label: 'Time', hint: 'At a set time' },
  { value: 'location', label: 'Place', hint: 'When you arrive' },
  { value: 'both', label: 'Both', hint: 'Time + place' },
];

function Tile({ option, active, onPress }: { option: (typeof OPTIONS)[number]; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.set(withSpring(active ? 1 : 0, spring));
  }, [active, p]);
  const { width } = useWindowDimensions();
  const tileSize = (Math.min(width, 520) - space.lg * 2 - space.md * 2) / 3 - 6;
  const card = useAnimatedStyle(() => ({ transform: [{ scale: 0.96 + p.value * 0.04 }], opacity: 0.85 + p.value * 0.15 }));

  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={option.label} style={{ flex: 1 }}>
      <Animated.View style={[styles.tile, active && styles.tileActive, card]}>
        <ModeTile mode={option.value} size={tileSize} radius={radius.lg - 3} />
        {active && (
          <View style={styles.badge}>
            <Check size={12} color={colors.onAccent} strokeWidth={3} />
          </View>
        )}
      </Animated.View>
      <Text style={[styles.label, active && { color: colors.text }]}>{option.label}</Text>
      <Text style={styles.hint}>{option.hint}</Text>
    </Pressable>
  );
}

/** Mode selector as three photographed objects you pick like cards. */
export function ModePicker({ value, onChange }: { value: TriggerMode; onChange: (m: TriggerMode) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md }} accessibilityRole="tablist">
      {OPTIONS.map((o) => (
        <Tile
          key={o.value}
          option={o}
          active={o.value === value}
          onPress={() => {
            if (o.value === value) return;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onChange(o.value);
          }}
        />
      ))}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    tile: { aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    tileActive: { borderColor: colors.text },
    badge: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { fontFamily: font.extraBold, fontSize: 18, color: colors.textDim, marginTop: space.sm, textAlign: 'center' },
    hint: { fontFamily: font.medium, fontSize: 12, color: colors.textFaint, textAlign: 'center' },
  });
