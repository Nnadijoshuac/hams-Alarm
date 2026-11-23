import { decideBoth, latestOccurrence, nextOccurrence, timeAlarmIsSpent, windowMinutes } from '../lib/time';
import { distanceMeters, formatDistance, isInside } from '../lib/geo';
import type { Weekday } from '../lib/types';

// Fixed local dates. 2026-11-16 is a Monday.
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const MON_0600 = at(2026, 11, 16, 6);

const base = (over: Partial<{ hour: number; minute: number; repeatDays: Weekday[]; armedAt: number; windowEnd: { hour: number; minute: number } | null }> = {}) => ({
  time: { hour: over.hour ?? 7, minute: over.minute ?? 0 },
  repeatDays: over.repeatDays ?? [],
  armedAt: over.armedAt ?? MON_0600,
  windowEnd: over.windowEnd === undefined ? null : over.windowEnd,
});

describe('occurrences', () => {
  test('one-shot armed before the time rings the same day', () => {
    expect(nextOccurrence(base(), MON_0600)).toBe(at(2026, 11, 16, 7));
  });

  test('one-shot armed after the time rings tomorrow', () => {
    const a = base({ armedAt: at(2026, 11, 16, 8) });
    expect(nextOccurrence(a, at(2026, 11, 16, 8))).toBe(at(2026, 11, 17, 7));
  });

  test('one-shot is spent after it passes', () => {
    expect(timeAlarmIsSpent(base(), at(2026, 11, 16, 7, 1))).toBe(true);
    expect(timeAlarmIsSpent(base(), at(2026, 11, 16, 6, 59))).toBe(false);
  });

  test('weekday repeat skips the weekend', () => {
    const a = base({ repeatDays: [1, 2, 3, 4, 5] });
    // Friday 08:00 → next is Monday 07:00
    expect(nextOccurrence(a, at(2026, 11, 20, 8))).toBe(at(2026, 11, 23, 7));
  });

  test('repeating alarm ignores occurrences before it was armed', () => {
    const a = base({ repeatDays: [1], armedAt: at(2026, 11, 16, 8) });
    expect(latestOccurrence(a, at(2026, 11, 16, 9))).toBeNull();
  });

  test('window wraps past midnight', () => {
    expect(windowMinutes({ hour: 23, minute: 0 }, { hour: 1, minute: 0 })).toBe(120);
    expect(windowMinutes({ hour: 7, minute: 0 }, { hour: 9, minute: 30 })).toBe(150);
  });
});

describe('Time + Location', () => {
  const win = base({ windowEnd: { hour: 9, minute: 0 } }); // 07:00–09:00, one-shot

  test('arrive early → schedule exact ring at the set time', () => {
    expect(decideBoth(win, { inside: true, lastFiredOccurrence: null }, at(2026, 11, 16, 6, 30))).toEqual({
      type: 'scheduleAt',
      at: at(2026, 11, 16, 7),
    });
  });

  test('time hits first → wait for arrival', () => {
    expect(decideBoth(win, { inside: false, lastFiredOccurrence: null }, at(2026, 11, 16, 7, 10))).toEqual({
      type: 'waitForArrival',
      deadline: at(2026, 11, 16, 9),
    });
  });

  test('arrive inside the window → ring', () => {
    expect(decideBoth(win, { inside: true, lastFiredOccurrence: null }, at(2026, 11, 16, 8))).toEqual({
      type: 'ring',
      occurrence: at(2026, 11, 16, 7),
    });
  });

  test('arrive after the window → expired', () => {
    expect(decideBoth(win, { inside: true, lastFiredOccurrence: null }, at(2026, 11, 16, 9, 1))).toEqual({
      type: 'done',
      reason: 'expired',
    });
  });

  test('does not ring twice for the same occurrence', () => {
    const occ = at(2026, 11, 16, 7);
    expect(decideBoth(win, { inside: true, lastFiredOccurrence: occ }, at(2026, 11, 16, 8))).toEqual({
      type: 'done',
      reason: 'fired',
    });
  });

  test('no window → waits indefinitely for arrival', () => {
    const a = base();
    expect(decideBoth(a, { inside: false, lastFiredOccurrence: null }, at(2026, 11, 18, 12))).toEqual({
      type: 'waitForArrival',
      deadline: null,
    });
  });

  test('repeating: expired today rolls to tomorrow', () => {
    const a = base({ repeatDays: [0, 1, 2, 3, 4, 5, 6], windowEnd: { hour: 9, minute: 0 } });
    expect(decideBoth(a, { inside: true, lastFiredOccurrence: null }, at(2026, 11, 16, 10))).toEqual({
      type: 'scheduleAt',
      at: at(2026, 11, 17, 7),
    });
  });
});

describe('geo', () => {
  const london = { latitude: 51.5074, longitude: -0.1278 };
  const paris = { latitude: 48.8566, longitude: 2.3522 };

  test('haversine is roughly right', () => {
    const d = distanceMeters(london, paris);
    expect(d).toBeGreaterThan(340_000);
    expect(d).toBeLessThan(345_000);
  });

  test('isInside respects radius', () => {
    const near = { latitude: 51.5083, longitude: -0.1278 }; // ~100 m north
    expect(isInside(near, london, 150)).toBe(true);
    expect(isInside(near, london, 50)).toBe(false);
  });

  test('formatDistance', () => {
    expect(formatDistance(842)).toBe('840 m');
    expect(formatDistance(1234)).toBe('1.2 km');
    expect(formatDistance(23_400)).toBe('23 km');
  });
});
