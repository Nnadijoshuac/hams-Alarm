import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { IconButton } from '../components/ui';
import { useNow } from '../hooks/useNow';
import { space, useTheme, type Colors, type TypeSet, type Numerals } from '../lib/theme';
import { pad2 } from '../lib/time';
import { CITIES, cityKey, describeOffset, zonedParts } from '../lib/zones';
import { useCities } from '../store/cities';
import { Screen } from '../components/Screen';

function CitiesScreenContent() {
  const { colors, type, numerals } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type, numerals), [colors, type, numerals]);
  const [q, setQ] = useState('');
  const zones = useCities((s) => s.zones);
  const add = useCities((s) => s.add);
  const now = useNow(30_000);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CITIES.filter((c) => !needle || `${c.name} ${c.country}`.toLowerCase().includes(needle));
  }, [q]);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={styles.search}>
          <Search size={18} color={colors.textDim} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Search cities"
            placeholderTextColor={colors.textFaint}
            style={[type.body, { flex: 1, paddingVertical: 0 }]}
          />
        </View>
        <IconButton icon={X} label="Close" onPress={() => router.back()} />
      </View>
      <FlatList
        data={list}
        keyExtractor={cityKey}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const key = cityKey(item);
          const saved = zones.includes(key);
          let time = '';
          let diff = '';
          try {
            const p = zonedParts(item.zone, now);
            time = `${pad2(p.hour)}:${pad2(p.minute)}`;
            diff = describeOffset(item.zone, now).diff;
          } catch {
            // zone missing from device ICU data
          }
          return (
            <Pressable
              style={styles.row}
              android_ripple={{ color: colors.accentDim }}
              onPress={() => {
                if (!saved) {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  add(key);
                }
                router.back();
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{item.name}</Text>
                <Text style={type.caption}>
                  {item.country} · {diff}
                </Text>
              </View>
              {saved ? <Check size={18} color={colors.accent} /> : <Text style={[type.display, { fontSize: 22, lineHeight: 28, letterSpacing: -0.5 }]}>{time}</Text>}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet, numerals: Numerals) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.text,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.md },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});

export default function CitiesScreen() {
  return (
    <Screen theme="cream" edges={['top', 'bottom']}>
      <CitiesScreenContent />
    </Screen>
  );
}
