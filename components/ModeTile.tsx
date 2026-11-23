import { View } from 'react-native';
import type { IllustrationName } from '../lib/illustrations';
import { palette } from '../lib/theme';
import type { TriggerMode } from '../lib/types';
import { Illustration } from './Illustration';

/** Each mode: its illustration and the paper colour it sits on. */
export const MODE_STYLE: Record<TriggerMode, { art: IllustrationName; bg: string }> = {
  time: { art: 'clock', bg: palette.plum },
  location: { art: 'pin', bg: palette.gold },
  both: { art: 'both', bg: palette.teal },
};

/** A flat illustration on a coloured tile: the alarm's mode at a glance. */
export function ModeTile({ mode, size = 52, dim, radius }: { mode: TriggerMode; size?: number; dim?: boolean; radius?: number }) {
  const { art, bg } = MODE_STYLE[mode];
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: radius ?? size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        dim && { opacity: 0.4 },
      ]}
    >
      <Illustration name={art} size={size * 0.7} />
    </View>
  );
}
