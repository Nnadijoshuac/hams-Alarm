import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { radius, shadow, space, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';
import { PressableScale } from './PressableScale';

// ---------- Button ----------

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
}

export function Button({ label, onPress, variant = 'primary', icon: Icon, disabled, loading, style, size = 'md' }: ButtonProps) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const variants = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    // Solid, high-contrast: ink with cream text (cream with ink text on deep colours).
    secondary: { bg: colors.text, fg: colors.bg, border: colors.text },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
    danger: { bg: 'transparent', fg: colors.danger, border: 'transparent' },
  }[variant];
  // Disabled: an outline with faint text — never a greyed-out filled pill with dark text.
  const palette = disabled ? { bg: 'transparent', fg: colors.textFaint, border: colors.border } : variants;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.button,
        size === 'lg' && styles.buttonLg,
        { backgroundColor: palette.bg, borderColor: palette.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {Icon && <Icon size={size === 'lg' ? 22 : 18} color={palette.fg} strokeWidth={2} />}
          <Text style={[type.heading, { color: palette.fg, fontSize: size === 'lg' ? 17 : 15, letterSpacing: -0.2 }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

// ---------- IconButton ----------

export function IconButton({
  icon: Icon,
  onPress,
  label,
  tone = 'default',
  size = 44,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  tone?: 'default' | 'accent';
  size?: number;
}) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        tone === 'accent' && { backgroundColor: colors.accent, borderColor: colors.accent },
      ]}
    >
      <Icon size={size * 0.45} color={tone === 'accent' ? colors.onAccent : colors.bg} strokeWidth={2.2} />
    </PressableScale>
  );
}

// ---------- Card ----------

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  return <View style={[styles.card, shadow.card, style]}>{children}</View>;
}

// ---------- Chip ----------

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[type.label, { color: active ? colors.bg : colors.text }]}>{label}</Text>
    </PressableScale>
  );
}

// ---------- Banner ----------

export function Banner({
  icon: Icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  return (
    <Animated.View entering={FadeInDown.springify()} exiting={FadeOutUp} style={styles.banner}>
      <Icon size={15} color={colors.accent} strokeWidth={2} />
      <View style={{ flex: 1 }}>
        <Text style={[type.label, { color: colors.text }]}>{title}</Text>
        <Text style={type.caption}>{body}</Text>
      </View>
      {action && onAction && (
        <Text onPress={onAction} suppressHighlighting style={[type.eyebrow, { color: colors.accent, letterSpacing: 1.8 }]}>
          {action}
        </Text>
      )}
    </Animated.View>
  );
}

// ---------- Section label ----------

export function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  return (
    <View style={styles.sectionRow}>
      <Text style={type.eyebrow}>{children}</Text>
      {right}
    </View>
  );
}

// ---------- Screen header ----------

export function ScreenHeader({ title, right, subtitle }: { title: string; right?: React.ReactNode; subtitle?: string }) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={type.title}>{title}</Text>
        {subtitle ? <Text style={[type.label, { marginTop: 4, color: colors.accent }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 48,
  },
  buttonLg: { paddingVertical: 18, minHeight: 60 },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.text,
  },
  chipActive: { backgroundColor: colors.text },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.md,
  },
});
