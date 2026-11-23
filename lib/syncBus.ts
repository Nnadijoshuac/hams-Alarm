/**
 * Stores call requestSync() after changing data; lib/engine registers the real
 * handler. Keeps stores free of native imports (testable) and avoids cycles.
 */
export type SyncReason = 'launch' | 'foreground' | 'upsert' | 'remove' | 'enable' | 'disable' | 'timer' | 'background' | 'geofence' | 'ring';

type Handler = (reason: SyncReason, alarmId?: string) => Promise<void>;
let handler: Handler = async () => {};

export function setSyncHandler(fn: Handler) {
  handler = fn;
}

export function requestSync(reason: SyncReason, alarmId?: string): Promise<void> {
  return handler(reason, alarmId).catch((e) => console.warn('[arrive] sync failed', e));
}
