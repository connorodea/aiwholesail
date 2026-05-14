/**
 * Unit tests for lib/campaign-scheduling.js — specifically
 * nextAllowedSendTime(date, sendWindow).
 *
 * Pure logic, no DB / network. All times evaluated in UTC.
 *
 * Calendar anchors used below:
 *   2026-05-13 = Wednesday (DOW 3)
 *   2026-05-16 = Saturday  (DOW 6)
 *   2026-05-17 = Sunday    (DOW 0)
 *   2026-05-18 = Monday    (DOW 1)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { nextAllowedSendTime } = require('../../lib/campaign-scheduling');

test('nextAllowedSendTime', async (t) => {
  const weekdays9to6 = { startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] };

  await t.test('date inside the window is returned as-is', () => {
    // Wed 15:30 UTC — squarely inside Mon-Fri 09:00-18:00.
    const d = new Date('2026-05-13T15:30:00Z');
    const out = nextAllowedSendTime(d, weekdays9to6);
    assert.equal(out.toISOString(), '2026-05-13T15:30:00.000Z');
    // Returns a NEW Date instance, not the same object — guards against
    // accidental mutation by callers.
    assert.notEqual(out, d);
  });

  await t.test('date before window start hour snaps forward to start hour, same day', () => {
    // Wed 05:30 UTC → Wed 09:00 UTC.
    const d = new Date('2026-05-13T05:30:00Z');
    const out = nextAllowedSendTime(d, weekdays9to6);
    assert.equal(out.toISOString(), '2026-05-13T09:00:00.000Z');
  });

  await t.test('date after window end hour snaps to start hour next allowed day', () => {
    // Wed 23:30 UTC → Thu 09:00 UTC (Thu is still an allowed weekday).
    const d = new Date('2026-05-13T23:30:00Z');
    const out = nextAllowedSendTime(d, weekdays9to6);
    assert.equal(out.toISOString(), '2026-05-14T09:00:00.000Z');
  });

  await t.test('date on a disallowed day-of-week snaps to start hour next allowed day', () => {
    // Sat 15:30 UTC → Mon 09:00 UTC (skips Sun + Sat both disallowed).
    const d = new Date('2026-05-16T15:30:00Z');
    const out = nextAllowedSendTime(d, weekdays9to6);
    assert.equal(out.toISOString(), '2026-05-18T09:00:00.000Z');
  });

  await t.test('sendWindow with empty days array passes through (no DOW filter)', () => {
    // Sat in-hour with empty days[] → unchanged (empty array == "no filter").
    const d = new Date('2026-05-16T15:30:00Z'); // Sat
    const out = nextAllowedSendTime(d, { startHour: 9, endHour: 18, days: [] });
    assert.equal(out.toISOString(), '2026-05-16T15:30:00.000Z');
  });

  await t.test('null days passes through (no DOW filter)', () => {
    const d = new Date('2026-05-16T15:30:00Z'); // Sat
    const out = nextAllowedSendTime(d, { startHour: 9, endHour: 18, days: null });
    assert.equal(out.toISOString(), '2026-05-16T15:30:00.000Z');
  });

  await t.test('24h-window edge case (start_hour=0, end_hour=23) → mid-day in-window', () => {
    // 12:00 sits within 0..23 — returned unchanged.
    const d = new Date('2026-05-13T12:00:00Z');
    const out = nextAllowedSendTime(d, { startHour: 0, endHour: 23, days: null });
    assert.equal(out.toISOString(), '2026-05-13T12:00:00.000Z');
  });

  await t.test('24h-window — endHour=23 is exclusive (documented contract)', () => {
    // 23:30 is OUTSIDE [0, 23) → rolls to next day 00:00.
    const d = new Date('2026-05-13T23:30:00Z');
    const out = nextAllowedSendTime(d, { startHour: 0, endHour: 23, days: null });
    assert.equal(out.toISOString(), '2026-05-14T00:00:00.000Z');
  });

  await t.test('fully-unconstrained window returns date unchanged', () => {
    const d = new Date('2026-05-13T23:30:00Z');
    const out = nextAllowedSendTime(d, { startHour: null, endHour: null, days: null });
    assert.equal(out.toISOString(), '2026-05-13T23:30:00.000Z');
  });

  await t.test('null sendWindow returns date unchanged (defensive default)', () => {
    const d = new Date('2026-05-13T05:30:00Z');
    const out = nextAllowedSendTime(d, null);
    assert.equal(out.toISOString(), '2026-05-13T05:30:00.000Z');
  });

  await t.test('undefined sendWindow returns date unchanged (defensive default)', () => {
    const d = new Date('2026-05-13T05:30:00Z');
    const out = nextAllowedSendTime(d, undefined);
    assert.equal(out.toISOString(), '2026-05-13T05:30:00.000Z');
  });

  await t.test('out-of-range startHour is ignored (treated as unconstrained)', () => {
    const d = new Date('2026-05-13T05:30:00Z');
    // startHour=99 fails the Number.isInteger range check → treated as null.
    const out = nextAllowedSendTime(d, { startHour: 99, endHour: 18, days: null });
    // With startHour null and endHour=18, 05:30 is in window → unchanged.
    assert.equal(out.toISOString(), '2026-05-13T05:30:00.000Z');
  });

  // Negative-path: document actual behavior with bad inputs.
  await t.test('null date throws (no defensive guard on date)', () => {
    assert.throws(() => nextAllowedSendTime(null, weekdays9to6), /getTime/);
  });

  await t.test('invalid Date returns Invalid Date (does not throw, but propagates NaN)', () => {
    // Documenting actual behavior: the impl reads .getTime() (which returns
    // NaN for an invalid Date) and constructs a new Date from NaN — also
    // invalid. It does not throw. Callers must validate before calling.
    const out = nextAllowedSendTime(new Date('invalid'), weekdays9to6);
    assert.ok(out instanceof Date);
    assert.ok(Number.isNaN(out.getTime()));
  });
});
