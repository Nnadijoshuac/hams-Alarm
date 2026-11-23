# Arrive: build plan

Status key: ✅ done and checked (unit tests / typecheck / Android bundle / prebuild manifest) · 📱 needs on-device check

| # | Step | Status |
|---|------|--------|
| 1 | Scaffold (Expo SDK 58, expo-router, TS), dark + amber theme, 4-tab shell | ✅ |
| 2 | Alarm model + AsyncStorage persistence + Zustand stores | ✅ |
| 3 | Time maths and the Time + Location state machine (`lib/time.ts`), with unit tests | ✅ |
| 4 | Notification plan (`lib/ringPlan.ts`): ring chains, snooze, stop/ack, timer; unit tests | ✅ |
| 5 | Alarm list: cards, spring toggles, haptics, map thumbnails, live distance, health banners | ✅ 📱 |
| 6 | Create/edit: mode segmented control, time picker, repeat days, window, map search + long-press pin, radius slider + circle | ✅ 📱 |
| 7 | Permission explanation screen (notifications → exact alarms → location → background location → battery) | ✅ 📱 |
| 8 | Ringing: alarm-stream channel, DND bypass, `alarmClock` exact triggers, Stop / Snooze 2 min actions (also when killed), ring screen | ✅ 📱 |
| 9 | Geofencing for enabled alarms only, keep-alive foreground service, fallback detection, reboot / launch re-sync | ✅ 📱 |
| 10 | Timer (presets 1/5/10/25, background), Stopwatch (laps), Clock + world cities | ✅ 📱 |
| 11 | Dev-only "Test trigger" panel (simulate arrival / leave / ring now) | ✅ 📱 |
| 12 | Original icon + alarm sound, EAS profiles, README | ✅ |

## Decisions

- **expo-notifications, not Notifee.** Notifee hasn't been published since Dec 2024, which is risky on SDK 58's new-architecture-only runtime. expo-notifications has no looping sound or full-screen intent, so a ring is a chain of notifications (every 30 s for 5 min). Each plays a 28 s tone on the alarm audio stream. The in-app ring screen loops the sound itself.
- **Keep-alive foreground service while location alarms are on.** Android won't deliver geofence events to a killed app (per the Expo SDK 58 docs).
- **One idempotent `syncAll()`.** It runs everywhere, so reboots, kills and edits all converge to the same state.

## Next (post-MVP)

- A native module for a true full-screen lock-screen alarm (`setFullScreenIntent`, `USE_FULL_SCREEN_INTENT`) with a gapless looping alarm-stream MediaPlayer.
- A place autocomplete provider for search.
- iOS support (critical alerts entitlement, region monitoring limits).
