import { CHAIN_FOLLOW_UPS, CHAIN_STEP_MS, parseId, planNotifications } from '../lib/ringPlan';
import { DEFAULT_RUNTIME, TIMER_KEY, type Alarm } from '../lib/types';

const at = (d: number, h: number, mi = 0, s = 0) => new Date(2026, 10, d, h, mi, s).getTime(); // Nov 2026
const MON_0600 = at(16, 6);

const alarm = (over: Partial<Alarm> = {}): Alarm => ({
  id: 'a1',
  name: 'Wake',
  enabled: true,
  mode: 'time',
  time: { hour: 7, minute: 0 },
  repeatDays: [],
  destination: null,
  radius: 300,
  windowEnd: null,
  armedAt: MON_0600,
  createdAt: MON_0600,
  ...over,
});

describe('planNotifications', () => {
  test('one-shot time alarm: first ring at 07:00 plus follow-ups', () => {
    const plan = planNotifications([alarm()], {}, MON_0600);
    expect(plan).toHaveLength(CHAIN_FOLLOW_UPS + 1);
    const dates = plan.map((p) => (p.kind === 'date' ? p.at : 0));
    expect(dates[0]).toBe(at(16, 7));
    expect(dates[1]).toBe(at(16, 7) + CHAIN_STEP_MS);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });

  test('repeating alarm: weekly triggers + follow-ups for the next occurrence', () => {
    const plan = planNotifications([alarm({ repeatDays: [1, 3] })], {}, MON_0600);
    const weekly = plan.filter((p) => p.kind === 'weekly');
    expect(weekly.map((w) => (w.kind === 'weekly' ? w.weekday : 0)).sort()).toEqual([2, 4]); // Mon, Wed
    expect(plan.filter((p) => p.kind === 'date')).toHaveLength(CHAIN_FOLLOW_UPS); // k = 1..10
  });

  test('while ringing, remaining follow-ups stay scheduled', () => {
    const now = at(16, 7, 1, 10); // 70 s into the ring
    const plan = planNotifications([alarm({ repeatDays: [1] })], {}, now);
    const current = plan.filter((p) => p.kind === 'date' && p.anchor === at(16, 7));
    expect(current).toHaveLength(CHAIN_FOLLOW_UPS - 2); // k = 3..10 still ahead
  });

  test('stop acknowledges the current ring', () => {
    const now = at(16, 7, 1);
    const plan = planNotifications([alarm({ repeatDays: [1] })], { a1: { ...DEFAULT_RUNTIME, ackUntil: now } }, now);
    expect(plan.some((p) => p.kind === 'date' && p.anchor === at(16, 7))).toBe(false);
    // …but next week's follow-ups are still planned
    expect(plan.some((p) => p.kind === 'date' && p.anchor === at(23, 7))).toBe(true);
  });

  test('snooze / arrival session rings even if the alarm was switched off', () => {
    const now = at(16, 12);
    const rt = { ...DEFAULT_RUNTIME, pendingRingAt: now + 120_000, ackUntil: now };
    const plan = planNotifications([alarm({ enabled: false, mode: 'location' })], { a1: rt }, now);
    expect(plan).toHaveLength(CHAIN_FOLLOW_UPS + 1);
    expect(plan[0].kind === 'date' && plan[0].at).toBe(now + 120_000);
  });

  test('disabled alarm with no session plans nothing', () => {
    expect(planNotifications([alarm({ enabled: false })], {}, MON_0600)).toEqual([]);
  });

  test('timer session', () => {
    const now = at(16, 12);
    const plan = planNotifications([], { [TIMER_KEY]: { ...DEFAULT_RUNTIME, pendingRingAt: now + 60_000 } }, now);
    expect(plan[0].key).toBe(TIMER_KEY);
    expect(plan).toHaveLength(CHAIN_FOLLOW_UPS + 1);
  });

  test('ids round-trip through parseId', () => {
    const [first] = planNotifications([alarm()], {}, MON_0600);
    expect(parseId(first.id)).toEqual({ type: 'ring', key: 'a1', anchor: at(16, 7) });
  });
});
