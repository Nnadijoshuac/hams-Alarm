import { createContext, useContext } from 'react';
import { Platform, type TextStyle } from 'react-native';

/**
 * Hams_Alarm design system — "coloured paper".
 *
 * Flat, rich colour per screen (never all-black) with a light film grain,
 * League Spartan in heavy weights, text centred or left-aligned. Each screen
 * picks a theme with <Screen theme="teal">; components read it via useTheme().
 */

export const palette = {
  teal: '#0F5E5B',
  ruby: '#A3202C',
  gold: '#F2A93B',
  cream: '#F3EADB',
  plum: '#3E2A6B',
  ink: '#1B1A17',
  amber: '#FFC15E',
  crimson: '#B4232F',
} as const;

export interface Colors {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentDim: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  dangerDim: string;
  track: string;
}

/** Cream text on a deep colour. */
function onDeep(bg: string): Colors {
  return {
    bg,
    surface: 'rgba(243, 234, 219, 0.07)',
    surfaceRaised: 'rgba(243, 234, 219, 0.12)',
    border: 'rgba(243, 234, 219, 0.22)',
    text: palette.cream,
    textDim: 'rgba(243, 234, 219, 0.76)',
    textFaint: 'rgba(243, 234, 219, 0.5)',
    accent: palette.amber,
    accentDim: 'rgba(255, 193, 94, 0.16)',
    accentSoft: 'rgba(255, 193, 94, 0.42)',
    onAccent: palette.ink,
    danger: palette.amber,
    dangerDim: 'rgba(255, 193, 94, 0.16)',
    track: 'rgba(243, 234, 219, 0.18)',
  };
}

export const themes = {
  cream: {
    bg: palette.cream,
    surface: '#FBF7F0',
    surfaceRaised: '#EADFCC',
    border: 'rgba(27, 26, 23, 0.12)',
    text: palette.ink,
    textDim: 'rgba(27, 26, 23, 0.68)',
    textFaint: 'rgba(27, 26, 23, 0.42)',
    accent: palette.crimson,
    accentDim: 'rgba(180, 35, 47, 0.10)',
    accentSoft: 'rgba(180, 35, 47, 0.28)',
    onAccent: palette.cream,
    danger: palette.crimson,
    dangerDim: 'rgba(180, 35, 47, 0.10)',
    track: 'rgba(27, 26, 23, 0.14)',
  },
  teal: onDeep(palette.teal),
  ruby: onDeep(palette.ruby),
  plum: onDeep(palette.plum),
  gold: {
    bg: palette.gold,
    surface: 'rgba(27, 26, 23, 0.06)',
    surfaceRaised: 'rgba(27, 26, 23, 0.1)',
    border: 'rgba(27, 26, 23, 0.18)',
    text: palette.ink,
    textDim: 'rgba(27, 26, 23, 0.72)',
    textFaint: 'rgba(27, 26, 23, 0.48)',
    accent: palette.ink,
    accentDim: 'rgba(27, 26, 23, 0.1)',
    accentSoft: 'rgba(27, 26, 23, 0.3)',
    onAccent: palette.gold,
    danger: palette.crimson,
    dangerDim: 'rgba(180, 35, 47, 0.1)',
    track: 'rgba(27, 26, 23, 0.16)',
  },
} satisfies Record<string, Colors>;

export type ThemeName = keyof typeof themes;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * League Spartan only (loaded in app/_layout.tsx). On Android each weight is
 * its own family — pick weights with `font.*`, never with `fontWeight`.
 */
export const font = {
  regular: 'LeagueSpartan_400Regular',
  medium: 'LeagueSpartan_500Medium',
  semibold: 'LeagueSpartan_600SemiBold',
  bold: 'LeagueSpartan_700Bold',
  extraBold: 'LeagueSpartan_800ExtraBold',
  black: 'LeagueSpartan_900Black',
} as const;

/** Numerals use the same family; components/Digits.tsx gives them fixed-width cells. */
export const digits = {
  semibold: font.semibold,
  bold: font.bold,
  extraBold: font.extraBold,
  black: font.black,
} as const;

/** League Spartan metrics (per em): widest digit 0.60, colon 0.30, cap height 0.66. */
export const DIGIT_EM = 0.6;
export const COLON_EM = 0.3;

function makeNumerals(c: Colors) {
  return (size: number, family: string = digits.extraBold): TextStyle => ({
    fontFamily: family,
    fontSize: size,
    lineHeight: Math.round(size * 1.0),
    letterSpacing: -size * 0.02,
    color: c.text,
    includeFontPadding: false,
  });
}

function makeType(c: Colors) {
  const numerals = makeNumerals(c);
  return {
    hero: numerals(132, digits.black),
    display: numerals(64),
    title: { fontFamily: font.extraBold, fontSize: 34, lineHeight: 38, letterSpacing: -1, color: c.text },
    heading: { fontFamily: font.bold, fontSize: 18, lineHeight: 22, letterSpacing: -0.2, color: c.text },
    body: { fontFamily: font.medium, fontSize: 16, lineHeight: 21, color: c.text },
    label: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18, color: c.textDim },
    eyebrow: { fontFamily: font.bold, fontSize: 12, lineHeight: 14, letterSpacing: 2, textTransform: 'uppercase', color: c.textFaint },
    caption: { fontFamily: font.medium, fontSize: 13, lineHeight: 16, color: c.textFaint },
  } satisfies Record<string, TextStyle>;
}

export type TypeSet = ReturnType<typeof makeType>;
export type Numerals = ReturnType<typeof makeNumerals>;

export interface Theme {
  name: ThemeName;
  colors: Colors;
  type: TypeSet;
  numerals: Numerals;
  /** Status bar content colour for this background. */
  statusBar: 'light' | 'dark';
}

const cache = new Map<ThemeName, Theme>();
export function getTheme(name: ThemeName): Theme {
  let t = cache.get(name);
  if (!t) {
    const c = themes[name];
    t = { name, colors: c, type: makeType(c), numerals: makeNumerals(c), statusBar: name === 'cream' || name === 'gold' ? 'dark' : 'light' };
    cache.set(name, t);
  }
  return t;
}

export const ThemeContext = createContext<Theme>(getTheme('cream'));
export const useTheme = () => useContext(ThemeContext);

/** Defaults (cream) for code outside a <Screen> — e.g. notification colours. */
export const colors = themes.cream;
export const type = getTheme('cream').type;
export const numerals = getTheme('cream').numerals;

export const shadow = {
  card: Platform.select({
    android: { elevation: 3, shadowColor: '#1B1A17' },
    default: { shadowColor: '#1B1A17', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  }),
};

export const spring = { damping: 18, stiffness: 220, mass: 0.9 } as const;
