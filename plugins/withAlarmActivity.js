/**
 * Lets the ring screen behave like a real alarm clock on Android:
 * - USE_FULL_SCREEN_INTENT: ringing notifications may launch the app full screen
 *   (see patches/expo-notifications+*.patch, which attaches the full-screen intent);
 * - showWhenLocked / turnScreenOn on MainActivity: that launch appears over the
 *   lock screen and wakes the display.
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withAlarmActivity(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    AndroidConfig.Permissions.ensurePermissions(manifest, ['android.permission.USE_FULL_SCREEN_INTENT']);
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    activity.$['android:showWhenLocked'] = 'true';
    activity.$['android:turnScreenOn'] = 'true';
    return cfg;
  });
};
