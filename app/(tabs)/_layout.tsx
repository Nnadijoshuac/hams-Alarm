import { Tabs } from 'expo-router';
import { AlarmClock, Clock, Hourglass, Timer } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, getTheme, type ThemeName } from '../../lib/theme';

/** Each tab is its own sheet of coloured paper; the tab bar takes the same colour. */
const TAB_THEME: Record<string, ThemeName> = {
  clock: 'teal',
  index: 'cream',
  timer: 'ruby',
  stopwatch: 'plum',
};

export default function TabsLayout() {
  // Room for icon + label above the phone's gesture/navigation bar; labels were clipping.
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => {
        const t = getTheme(TAB_THEME[route.name] ?? 'cream').colors;
        return {
          headerShown: false,
          tabBarActiveTintColor: t.accent,
          tabBarInactiveTintColor: t.textFaint,
          tabBarStyle: {
            backgroundColor: t.bg,
            borderTopColor: t.border,
            borderTopWidth: 0.5,
            elevation: 0,
            height: 68 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom + 8,
          },
          tabBarItemStyle: { paddingVertical: 2 },
          tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.3, marginTop: 2 },
          sceneStyle: { backgroundColor: t.bg },
          animation: 'shift',
        };
      }}
    >
      <Tabs.Screen name="clock" options={{ title: 'Clock', tabBarIcon: ({ color, size }) => <Clock color={color} size={size - 2} /> }} />
      <Tabs.Screen name="index" options={{ title: 'Alarms', tabBarIcon: ({ color, size }) => <AlarmClock color={color} size={size - 2} /> }} />
      <Tabs.Screen name="timer" options={{ title: 'Timer', tabBarIcon: ({ color, size }) => <Hourglass color={color} size={size - 2} /> }} />
      <Tabs.Screen name="stopwatch" options={{ title: 'Stopwatch', tabBarIcon: ({ color, size }) => <Timer color={color} size={size - 2} /> }} />
    </Tabs>
  );
}
