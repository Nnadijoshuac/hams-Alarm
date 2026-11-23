import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useWindowDimensions } from 'react-native';
import { COLON_EM, DIGIT_EM } from '../lib/theme';
import { formatClock } from '../lib/time';
import type { ClockTime } from '../lib/types';
import { Digits } from './Digits';
import { PressableScale } from './PressableScale';

/**
 * Big tappable time that opens the time picker. Sized to always fit on one
 * line: "07:00" is four digit cells and a colon, so the width decides the size.
 */
export function TimeField({
  value,
  onChange,
  size,
  color,
  label,
}: {
  value: ClockTime;
  onChange: (t: ClockTime) => void;
  /** Font size; defaults to the largest that fits the screen width. */
  size?: number;
  color?: string;
  label: string;
}) {
  const { width } = useWindowDimensions();
  const fit = (width - 48) / (4 * (DIGIT_EM - 0.03) + COLON_EM);
  const fontSize = Math.min(size ?? 150, fit);
  const open = () => {
    void Haptics.selectionAsync();
    const d = new Date();
    d.setHours(value.hour, value.minute, 0, 0);
    DateTimePickerAndroid.open({
      value: d,
      mode: 'time',
      is24Hour: true,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange({ hour: date.getHours(), minute: date.getMinutes() });
      },
    });
  };
  return (
    <PressableScale onPress={open} accessibilityRole="button" accessibilityLabel={`${label}: ${formatClock(value)}`} scaleTo={0.96}>
      <Digits value={formatClock(value)} size={fontSize} color={color} />
    </PressableScale>
  );
}
