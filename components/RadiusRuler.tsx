import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { digits, font, space, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';
import { RADIUS_MAX, RADIUS_MIN } from '../lib/types';

const STEP = 50; // metres per tick
const TICK_GAP = 14; // px between ticks
const TICKS = (RADIUS_MAX - RADIUS_MIN) / STEP;

function readout(m: number): { value: string; unit: string } {
  return m < 1000 ? { value: String(m), unit: 'm' } : { value: (m / 1000).toFixed(m % 1000 === 0 ? 0 : 2).replace(/0$/, ''), unit: 'km' };
}

/**
 * A tape measure instead of a slider: drag the ruler under a fixed amber
 * needle. Snaps every 50 m with a haptic tick; the giant readout updates live.
 */
export function RadiusRuler({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const [width, setWidth] = useState(0);
  const [live, setLive] = useState(value);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const lastTick = useRef(value);
  const pad = width / 2;

  // Put the needle on the current value once we know our width.
  useEffect(() => {
    if (width > 0) scroll.current?.scrollTo({ x: ((value - RADIUS_MIN) / STEP) * TICK_GAP, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const valueAt = (x: number) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, RADIUS_MIN + Math.round(x / TICK_GAP) * STEP));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const v = valueAt(e.nativeEvent.contentOffset.x);
    if (v !== lastTick.current) {
      lastTick.current = v;
      setLive(v);
      void Haptics.selectionAsync();
    }
  };
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const v = valueAt(e.nativeEvent.contentOffset.x);
    setLive(v);
    onChange(v);
  };

  const { value: num, unit } = readout(live);

  return (
    <View>
      <View style={styles.readoutRow}>
        <Text style={styles.readout}>{num}</Text>
        <Text style={styles.unit}>{unit}</Text>
        <Text style={[type.eyebrow, styles.caption]}>radius</Text>
      </View>

      <View style={styles.rulerWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <ScrollView
            ref={scroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK_GAP}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={onScroll}
            onMomentumScrollEnd={settle}
            onScrollEndDrag={settle}
            contentContainerStyle={{ paddingHorizontal: pad }}
          >
            <View style={styles.ticks}>
              {Array.from({ length: TICKS + 1 }, (_, i) => {
                const m = RADIUS_MIN + i * STEP;
                const major = m % 500 === 0;
                const mid = !major && m % 100 === 0;
                const active = m <= live;
                return (
                  <View key={m} style={styles.tickSlot}>
                    <View
                      style={[
                        styles.tick,
                        { height: major ? 34 : mid ? 22 : 12, backgroundColor: active ? colors.accentSoft : colors.border },
                        major && { width: 3, backgroundColor: active ? colors.accent : colors.textFaint },
                      ]}
                    />
                    {major && <Text style={styles.tickLabel}>{m < 1000 ? m : `${m / 1000}k`}</Text>}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
        {/* Fixed needle in the centre. */}
        <View pointerEvents="none" style={[styles.needle, { left: pad - 2 }]} />
        <View pointerEvents="none" style={[styles.needleCap, { left: pad - 7 }]} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  readoutRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  readout: { ...numerals(88, digits.black), color: colors.accent, letterSpacing: -2 },
  unit: { ...numerals(34, digits.extraBold), color: colors.text, marginBottom: 10 },
  caption: { marginLeft: 'auto', marginBottom: 16, letterSpacing: 3 },
  rulerWrap: { height: 74, marginTop: space.sm, marginHorizontal: -space.lg },
  ticks: { flexDirection: 'row', alignItems: 'flex-start', height: 74 },
  tickSlot: { width: TICK_GAP, alignItems: 'center' },
  tick: { width: 2, borderRadius: 1 },
  tickLabel: { fontFamily: font.bold, fontSize: 10, color: colors.textFaint, marginTop: 6, width: 40, textAlign: 'center' },
  needle: { position: 'absolute', top: 0, width: 4, height: 46, borderRadius: 2, backgroundColor: colors.accent },
  needleCap: { position: 'absolute', top: 46, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent },
});
