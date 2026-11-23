import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Crosshair, LocateFixed, MapPin, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { LatLng } from '../lib/geo';
import { requestForegroundLocation } from '../lib/permissions';
import { radius as r, space, useTheme, type Colors, type TypeSet } from '../lib/theme';
import type { Destination } from '../lib/types';
import { FreeMap } from './FreeMap';
import { IconButton } from './ui';

function formatAddress(a: Location.LocationGeocodedAddress | undefined, fallback: LatLng): string {
  if (!a) return `${fallback.latitude.toFixed(4)}, ${fallback.longitude.toFixed(4)}`;
  const street = [a.streetNumber, a.street].filter(Boolean).join(' ');
  const first = a.name && a.name !== a.streetNumber ? a.name : street;
  const place = a.city || a.district || a.subregion || a.region;
  return [first, place].filter((x, i, arr) => x && arr.indexOf(x) === i).join(', ') || a.formattedAddress || 'Dropped pin';
}

async function labelFor(point: LatLng): Promise<string> {
  const [address] = await Location.reverseGeocodeAsync(point).catch(() => []);
  return formatAddress(address, point);
}

interface Result extends Destination {
  key: string;
}

interface Props {
  value: Destination | null;
  radius: number;
  onChange: (d: Destination) => void;
}

export function MapPicker({ value, radius, onChange }: Props) {
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [start, setStart] = useState<LatLng | null>(value);

  // Start the map near the user if there's no destination yet.
  useEffect(() => {
    if (value) return;
    void Location.getLastKnownPositionAsync().then((p) => p && setStart(p.coords)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (d: Destination) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(d);
    setResults(null);
    Keyboard.dismiss();
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const found = (await Location.geocodeAsync(q)).slice(0, 5);
      const labelled = await Promise.all(
        found.map(async (f, i) => ({ key: `${i}`, latitude: f.latitude, longitude: f.longitude, label: await labelFor(f) })),
      );
      setResults(labelled);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const useCurrent = async () => {
    if (!(await requestForegroundLocation())) return;
    setLocating(true);
    try {
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      choose({ latitude: p.coords.latitude, longitude: p.coords.longitude, label: await labelFor(p.coords) });
    } catch {
      // services off or timeout: leave things as they are
    } finally {
      setLocating(false);
    }
  };

  const onLongPress = async (point: LatLng) => {
    choose({ ...point, label: 'Dropped pin' });
    onChange({ ...point, label: await labelFor(point) });
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.searchRow}>
        <Search size={18} color={colors.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder="Search a place or address"
          placeholderTextColor={colors.textFaint}
          returnKeyType="search"
          style={[type.body, styles.input]}
        />
        {searching ? (
          <ActivityIndicator color={colors.accent} />
        ) : query ? (
          <Pressable hitSlop={10} onPress={() => (setQuery(''), setResults(null))} accessibilityLabel="Clear search">
            <X size={18} color={colors.textDim} />
          </Pressable>
        ) : null}
        <IconButton icon={locating ? LocateFixed : Crosshair} label="Use current location" onPress={useCurrent} size={40} />
      </View>

      {results && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          {results.length === 0 ? (
            <Text style={[type.label, { paddingVertical: space.sm }]}>No places found. Try a fuller address.</Text>
          ) : (
            results.map((res) => (
              <Pressable key={res.key} onPress={() => choose(res)} style={styles.result} android_ripple={{ color: colors.accentDim }}>
                <MapPin size={16} color={colors.accent} />
                <Text style={[type.body, { flex: 1 }]} numberOfLines={2}>
                  {res.label}
                </Text>
              </Pressable>
            ))
          )}
        </Animated.View>
      )}

      <FreeMap
        style={styles.map}
        pin={value}
        radius={radius}
        center={start}
        accent={colors.accent}
        paper={colors.bg}
        onLongPress={onLongPress}
      />

      <View style={styles.place}>
        <MapPin size={16} color={value ? colors.accent : colors.textFaint} />
        <Text style={[type.body, { flex: 1, color: value ? colors.text : colors.textDim }]} numberOfLines={2}>
          {value ? value.label : 'Search, use your location, or tap the map'}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors, type: TypeSet) =>
  StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      borderBottomWidth: 1.5,
      borderBottomColor: colors.text,
      paddingBottom: space.xs,
    },
    input: { flex: 1, paddingVertical: space.sm },
    result: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    map: { height: 300, borderRadius: r.lg },
    place: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  });
