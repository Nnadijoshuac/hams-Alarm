// Order matters, so these are require() calls rather than hoisted imports:
// 1. the crash reporter, so even a startup error shows on screen;
// 2. background tasks, which must be defined at module scope before the app
//    renders (Android may boot the JS runtime headless just to run one);
// 3. the router entry.
import { createElement } from 'react';
import { AppRegistry } from 'react-native';
import { CrashScreen, describe, installCrashHandler } from './lib/crash';

installCrashHandler();

try {
  require('./lib/tasks');
  require('expo-router/entry');
} catch (e) {
  const error = describe(e);
  AppRegistry.registerComponent('main', () => () => createElement(CrashScreen, { error }));
}
