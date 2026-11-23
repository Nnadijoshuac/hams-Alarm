import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ImageBackground, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { getTheme, ThemeContext, type ThemeName } from '../lib/theme';

const GRAIN = require('../assets/art/grain.png');

/**
 * Every screen sits on flat coloured paper: the theme's colour, a light film
 * grain on top, the matching status-bar style, and the theme provided to all
 * children (useTheme()).
 */
export function Screen({
  theme,
  children,
  edges = ['top'],
  style,
}: {
  theme: ThemeName;
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const t = getTheme(theme);
  const focused = useIsFocused();
  return (
    <ThemeContext.Provider value={t}>
      {focused && <StatusBar style={t.statusBar} />}
      <View style={[styles.root, { backgroundColor: t.colors.bg }]}>
        <ImageBackground source={GRAIN} resizeMode="repeat" style={StyleSheet.absoluteFill} imageStyle={styles.grain} pointerEvents="none" />
        <SafeAreaView style={[styles.root, style]} edges={edges}>
          {children}
        </SafeAreaView>
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grain: { opacity: 0.55 },
});
