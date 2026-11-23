import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Hams_Alarm',
  slug: 'hams-alarm',
  scheme: 'hamsalarm',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#F3EADB',
  android: {
    package: 'com.hamsalarm.app',
    adaptiveIcon: {
      backgroundColor: '#1D585A',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
      // Exact alarms: SCHEDULE_EXACT_ALARM (user-grantable, Android 12+) and
      // USE_EXACT_ALARM (auto-granted on Android 13+ for alarm-clock apps; Play policy allows this category).
      'SCHEDULE_EXACT_ALARM',
      'USE_EXACT_ALARM',
      'USE_FULL_SCREEN_INTENT',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'WAKE_LOCK',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.hamsalarm.app',
  },
  plugins: [
    'expo-router',
    './plugins/withAlarmActivity',
    ['expo-splash-screen', { backgroundColor: '#1D585A', image: './assets/splash-icon.png', imageWidth: 220 }],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Hams_Alarm checks your location in the background so your alarm can ring when you reach your destination.',
        locationWhenInUsePermission: 'Hams_Alarm uses your location to show how far you are from each destination.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#0F5E5B',
        sounds: ['./assets/sounds/alarm.wav'],
      },
    ],
    ['expo-audio', { enableBackgroundPlayback: true, microphonePermission: false, recordAudioAndroid: false }],
    'expo-background-task',
    [
      '@react-native-community/datetimepicker',
      {
        // Time picker in the app's colours instead of Android's stock grey/teal.
        android: {
          timePicker: {
            background: { light: '#F3EADB' },
            headerBackground: { light: '#3E2A6B' },
            numbersBackgroundColor: { light: '#EADFCC' },
            numbersTextColor: { light: '#1B1A17' },
            numbersInnerTextColor: { light: '#6B6457' },
            numbersSelectorColor: { light: '#B4232F' },
          },
          datePicker: { colorAccent: { light: '#B4232F' } },
        },
      },
    ],
    'expo-font',
    [
      'expo-build-properties',
      {
        android: {
          // R8 stripped WorkManager's reflectively-created WorkDatabase_Impl constructor
          // (pulled in by expo-background-task) and the app crashed on launch. Keep the
          // shrinker off; the keep rules below are a second safety net if it is re-enabled.
          enableMinifyInReleaseBuilds: false,
          enableShrinkResourcesInReleaseBuilds: false,
          extraProguardRules: [
            '-keep class androidx.work.impl.WorkDatabase_Impl { <init>(); }',
            '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
          ].join(String.fromCharCode(10)),
        },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  owner: 'serenityeye',
  extra: {
    eas: { projectId: 'a262b5f9-acfd-404d-b8b3-258487c0c547' },
  },
};

export default config;
