import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLON_EM, DIGIT_EM, digits, useTheme } from '../lib/theme';

interface Props {
  /** e.g. "06:45", "01:23.45", "400" */
  value: string;
  size: number;
  color?: string;
  /** Colour for ":" and "." separators. */
  sepColor?: string;
  family?: string;
  style?: StyleProp<ViewStyle>;
  /** Squeeze cells together (fraction of the size). */
  tighten?: number;
}

/**
 * League Spartan has proportional digits ("1" is half the width of "0"), so a
 * ticking stopwatch would jitter. Each character gets a fixed-width cell
 * instead: the look of League Spartan, the steadiness of tabular figures.
 */
export function Digits({ value, size, color, sepColor, family = digits.black, style, tighten = 0.03 }: Props) {
  const { colors } = useTheme();
  const fg = color ?? colors.text;
  const cell = size * (DIGIT_EM - tighten);
  const sepCell = size * (COLON_EM - tighten * 0.5);
  const lineHeight = Math.round(size * 0.98);
  return (
    <View style={[styles.row, style]} accessible accessibilityLabel={value}>
      {value.split('').map((ch, i) => {
        const isDigit = ch >= '0' && ch <= '9';
        const isSep = ch === ':' || ch === '.';
        return (
          <View key={i} style={{ width: isDigit ? cell : isSep ? sepCell : undefined, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: family,
                fontSize: size,
                lineHeight,
                color: isSep && sepColor ? sepColor : fg,
                includeFontPadding: false,
                // League Spartan sits high in its box; nudge so caps centre in the line.
                marginTop: size * 0.08,
              }}
              allowFontScaling={false}
            >
              {ch}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
