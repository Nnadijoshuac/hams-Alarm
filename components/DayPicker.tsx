import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, View } from 'react-native';
import { font, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';
import { DAY_LETTERS, DAY_SHORT } from '../lib/time';
import type { Weekday } from '../lib/types';
import { PressableScale } from './PressableScale';

// Week starts on Monday in the picker.
const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function DayPicker({ value, onChange }: { value: Weekday[]; onChange: (days: Weekday[]) => void }) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  return (
    <View style={styles.row}>
      {ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <PressableScale
            key={d}
            scaleTo={0.9}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={DAY_SHORT[d]}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(on ? value.filter((x) => x !== d) : [...value, d].sort());
            }}
            style={[styles.day, on && styles.dayOn]}
          >
            <Text style={[type.label, { color: on ? colors.onAccent : colors.text, fontFamily: font.bold }]}>{DAY_LETTERS[d]}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.text,
  },
  dayOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
