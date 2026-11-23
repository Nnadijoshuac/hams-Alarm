import { cityFromKey, describeOffset, zoneOffsetMinutes, zonedParts } from '../lib/zones';

// 2026-11-20 12:00 UTC
const NOON_UTC = Date.UTC(2026, 10, 20, 12, 0);

test('offsets', () => {
  expect(zoneOffsetMinutes('Asia/Kolkata', NOON_UTC)).toBe(330);
  expect(zoneOffsetMinutes('America/New_York', NOON_UTC)).toBe(-300); // EST in November
  expect(zoneOffsetMinutes('Europe/London', NOON_UTC)).toBe(0);
});

test('zoned wall clock', () => {
  expect(zonedParts('Asia/Tokyo', NOON_UTC)).toMatchObject({ hour: 21, minute: 0, day: 20 });
  expect(zonedParts('Pacific/Auckland', NOON_UTC)).toMatchObject({ hour: 1, day: 21 });
});

test('describeOffset is relative to the device zone', () => {
  // Make the expectation independent of the machine running the tests.
  const local = -new Date(NOON_UTC).getTimezoneOffset();
  const fmt = (min: number) => {
    if (min === 0) return 'Same time';
    const a = Math.abs(min);
    return `${min > 0 ? '+' : '−'}${Math.floor(a / 60)}h${a % 60 ? ` ${a % 60}m` : ''}`;
  };
  expect(describeOffset('Asia/Kolkata', NOON_UTC).diff).toBe(fmt(330 - local));
  expect(describeOffset('America/New_York', NOON_UTC).diff).toBe(fmt(-300 - local));
  expect(describeOffset(Intl.DateTimeFormat().resolvedOptions().timeZone, NOON_UTC).diff).toBe('Same time');
});

test('city keys', () => {
  expect(cityFromKey('Asia/Kolkata|Delhi')).toMatchObject({ name: 'Delhi', country: 'India' });
  expect(cityFromKey('America/Argentina/Cordoba|').name).toBe('Cordoba');
});
