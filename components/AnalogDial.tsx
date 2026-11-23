import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { font, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';

/**
 * Minimal analog face: hairline ring, 60 ticks, four quiet numerals, slim hands
 * and a sweeping amber second hand. Hands are plain Views rotated about the
 * centre, so the second hand can glide smoothly with Reanimated.
 */

interface HandProps {
  size: number;
  angle: number; // degrees, 0 = 12 o'clock
  length: number; // fraction of radius
  width: number;
  color: string;
  tail?: number; // fraction of radius behind the centre
  smooth?: boolean;
}

function Hand({ size, angle, length, width, color, tail = 0, smooth }: HandProps) {
  const r = size / 2;
  const a = useSharedValue(angle);
  useEffect(() => {
    if (!smooth) {
      a.set(angle);
      return;
    }
    // Glide over the next second. On wrap (59 → 0) restart one step back so it
    // still glides forward instead of spinning backwards.
    if (angle < a.value) a.set(angle - 6);
    a.set(withTiming(angle, { duration: 1000, easing: Easing.linear }));
  }, [angle, smooth, a]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${a.value}deg` }] }));
  const len = r * length;
  const back = r * tail;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <View
        style={{
          position: 'absolute',
          left: r - width / 2,
          top: r - len,
          width,
          height: len + back,
          borderRadius: width / 2,
          backgroundColor: color,
        }}
      />
    </Animated.View>
  );
}

interface DialProps {
  size: number;
  /** Angles in degrees (0 = 12 o'clock). */
  hourAngle?: number;
  minuteAngle?: number;
  secondAngle: number;
  /** Smoothly sweep the second hand between updates (clock). */
  sweep?: boolean;
  /** Numerals at 12 / 3 / 6 / 9. */
  labels?: [string, string, string, string];
  /** Stopwatch-style sub-dial (0..1 progress), drawn at 6 o'clock. */
  subdial?: number;
  children?: React.ReactNode;
}

export function AnalogDial({ size, hourAngle, minuteAngle, secondAngle, sweep, labels = ['12', '3', '6', '9'], subdial, children }: DialProps) {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const r = size / 2;
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const major = i % 5 === 0;
    const quarter = i % 15 === 0;
    const len = quarter ? 14 : major ? 9 : 4;
    const rad = ((i * 6 - 90) * Math.PI) / 180;
    const outer = r - 10;
    return (
      <Line
        key={i}
        x1={r + Math.cos(rad) * outer}
        y1={r + Math.sin(rad) * outer}
        x2={r + Math.cos(rad) * (outer - len)}
        y2={r + Math.sin(rad) * (outer - len)}
        stroke={quarter ? colors.text : major ? colors.textDim : colors.textFaint}
        strokeWidth={quarter ? 2.2 : major ? 1.4 : 1}
        strokeLinecap="round"
      />
    );
  });

  const numR = r - 44;
  const numPos = [
    { x: r, y: r - numR },
    { x: r + numR, y: r },
    { x: r, y: r + numR },
    { x: r - numR, y: r },
  ];

  // Sub-dial at 6 o'clock (stopwatch minutes).
  const subR = r * 0.2;
  const subCy = r + r * 0.42;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={r} cy={r} r={r - 1} stroke={colors.border} strokeWidth={1} fill="none" />
        {ticks}
        {labels.map((n, i) =>
          subdial !== undefined && i === 2 ? null : (
            <SvgText
              key={i}
              x={numPos[i].x}
              y={numPos[i].y + 6}
              fill={colors.textDim}
              fontSize={15}
              fontFamily={font.semibold}
              textAnchor="middle"
              letterSpacing={0.5}
            >
              {n}
            </SvgText>
          ),
        )}
        {subdial !== undefined && (
          <>
            <Circle cx={r} cy={subCy} r={subR} stroke={colors.border} strokeWidth={1} fill="none" />
            {Array.from({ length: 30 }, (_, i) => {
              const rad = ((i * 12 - 90) * Math.PI) / 180;
              const major = i % 5 === 0;
              return (
                <Line
                  key={`s${i}`}
                  x1={r + Math.cos(rad) * (subR - 3)}
                  y1={subCy + Math.sin(rad) * (subR - 3)}
                  x2={r + Math.cos(rad) * (subR - (major ? 8 : 5))}
                  y2={subCy + Math.sin(rad) * (subR - (major ? 8 : 5))}
                  stroke={major ? colors.textDim : colors.textFaint}
                  strokeWidth={1}
                />
              );
            })}
            {(() => {
              const rad = ((subdial * 360 - 90) * Math.PI) / 180;
              return (
                <>
                  <Line
                    x1={r}
                    y1={subCy}
                    x2={r + Math.cos(rad) * (subR - 6)}
                    y2={subCy + Math.sin(rad) * (subR - 6)}
                    stroke={colors.text}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <Circle cx={r} cy={subCy} r={3} fill={colors.text} />
                </>
              );
            })()}
          </>
        )}
      </Svg>

      {children}

      {hourAngle !== undefined && <Hand size={size} angle={hourAngle} length={0.48} width={7} color={colors.text} tail={0.08} />}
      {minuteAngle !== undefined && <Hand size={size} angle={minuteAngle} length={0.72} width={4} color={colors.text} tail={0.08} />}
      <Hand size={size} angle={secondAngle} length={0.86} width={minuteAngle === undefined ? 2.2 : 1.6} color={colors.accent} tail={0.18} smooth={sweep} />

      {/* Centre cap */}
      <View pointerEvents="none" style={[styles.cap, { left: r - 7, top: r - 7 }]} />
      <View pointerEvents="none" style={[styles.capDot, { left: r - 2.5, top: r - 2.5 }]} />
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  cap: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent },
  capDot: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.bg },
});
