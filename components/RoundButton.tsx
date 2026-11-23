import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text } from 'react-native';
import { useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';
import { PressableScale } from './PressableScale';

/** Minimal round control: hairline ghost, or solid amber for the primary action. */
export function RoundButton({
  label,
  hint,
  onPress,
  primary,
  disabled,
  strong,
}: {
  label: string;
  /** Small second line, e.g. "2 min". */
  hint?: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  /** Heavier haptic (start / stop). */
  strong?: boolean;
}) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label} ${hint}` : label}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.round, primary ? styles.primary : styles.ghost, disabled && { opacity: 0.3 }]}
    >
      <Text style={[type.eyebrow, { color: primary ? colors.onAccent : colors.text, letterSpacing: 2 }]}>{label}</Text>
      {hint ? <Text style={[type.caption, { color: primary ? colors.onAccent : colors.textDim, marginTop: 2 }]}>{hint}</Text> : null}
    </PressableScale>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  round: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderWidth: 1, borderColor: colors.border },
  primary: { backgroundColor: colors.accent },
});
