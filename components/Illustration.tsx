import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ILLUSTRATIONS, type IllustrationName } from '../lib/illustrations';

interface Props {
  name: IllustrationName;
  /** Height in dp; width follows the artwork's aspect ratio (or pass width instead). */
  size?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A flat vector illustration with a transparent background, so it can sit on
 * any of the app's coloured papers, on a disc, or overlap other elements.
 */
export const Illustration = memo(function Illustration({ name, size, width, style }: Props) {
  const art = ILLUSTRATIONS[name];
  const h = size ?? (width ? width / art.ratio : 120);
  const w = width ?? h * art.ratio;
  return (
    <View style={[{ width: w, height: h }, style]} pointerEvents="none">
      <SvgXml xml={art.xml} width={w} height={h} />
    </View>
  );
});

/**
 * An illustration seated on a soft coloured disc: a decorative component for
 * empty states, onboarding and mode tiles.
 */
export function IllustrationDisc({
  name,
  diameter,
  color,
  scale = 0.72,
  style,
}: {
  name: IllustrationName;
  diameter: number;
  color: string;
  scale?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const art = ILLUSTRATIONS[name];
  const box = diameter * scale;
  const h = art.ratio >= 1 ? box / art.ratio : box;
  return (
    <View
      style={[
        { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Illustration name={name} size={h} />
    </View>
  );
}
