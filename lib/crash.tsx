import { DeviceEventEmitter, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Release builds close silently on a JavaScript error ("app has a bug").
 * Instead, show the error on screen so it can be screenshotted and fixed.
 */

export const CRASH_EVENT = 'hams:crash';

export function describe(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}\n\n${e.stack ?? ''}`;
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

let installed = false;
/** Turn fatal JS errors into an on-screen report instead of a crash. */
export function installCrashHandler() {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
  };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    if (fatal) {
      lastCrash = describe(e);
      DeviceEventEmitter.emit(CRASH_EVENT, lastCrash);
      return; // don't let React Native kill the app
    }
    previous(e, fatal);
  });
}

export let lastCrash: string | null = null;

export function CrashScreen({ error }: { error: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Hams_Alarm hit an error</Text>
      <Text style={styles.sub}>Please screenshot this screen (or tap Share) and send it to the developer.</Text>
      <ScrollView style={styles.box} contentContainerStyle={{ padding: 14 }}>
        <Text selectable style={styles.mono}>
          {error}
        </Text>
      </ScrollView>
      <TouchableOpacity style={styles.button} onPress={() => void Share.share({ message: error })}>
        <Text style={styles.buttonText}>Share error</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3EADB', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 28 },
  title: { fontSize: 24, fontWeight: '700', color: '#1B1A17' },
  sub: { fontSize: 14, color: '#1B1A17', marginTop: 6, marginBottom: 14 },
  box: { flex: 1, backgroundColor: '#1B1A17', borderRadius: 14 },
  mono: { fontFamily: 'monospace', fontSize: 12, color: '#F3EADB' },
  button: { marginTop: 16, backgroundColor: '#B4232F', borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#F3EADB', fontSize: 16, fontWeight: '700' },
});
