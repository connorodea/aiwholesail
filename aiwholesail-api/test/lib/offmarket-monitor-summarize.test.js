/**
 * Tests for summarizeRecentAlerts — the exec-dashboard panel helper
 * referenced by migrations/021_monitor_alerts.sql ("last 24h alerts"
 * at-a-glance health signal).
 *
 * Test-first per the TDD skill: this file existed and ran red before
 * the helper was implemented.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeRecentAlerts } = require('../../lib/offmarket-monitor-thresholds');

test('summarizeRecentAlerts', async (t) => {
  await t.test('empty input → empty summary, last_fired_at null', () => {
    const out = summarizeRecentAlerts([]);
    assert.deepEqual(out, {
      total: 0,
      red: 0,
      yellow: 0,
      green: 0,
      last_fired_at: null,
      most_recent_sli: null,
    });
  });

  await t.test('single red alert is counted and surfaced as most-recent', () => {
    const rows = [
      { sli: 'offmarket-feed-ratio', severity: 'red', fired_at: '2026-05-13T14:00:00.000Z' },
    ];
    const out = summarizeRecentAlerts(rows);
    assert.equal(out.total, 1);
    assert.equal(out.red, 1);
    assert.equal(out.yellow, 0);
    assert.equal(out.last_fired_at, '2026-05-13T14:00:00.000Z');
    assert.equal(out.most_recent_sli, 'offmarket-feed-ratio');
  });

  await t.test('multiple alerts: counts by severity, most-recent is by fired_at', () => {
    const rows = [
      { sli: 'offmarket-429-burst', severity: 'yellow', fired_at: '2026-05-13T10:00:00.000Z' },
      { sli: 'offmarket-feed-ratio', severity: 'red',    fired_at: '2026-05-13T15:00:00.000Z' },
      { sli: 'offmarket-empty-rate', severity: 'yellow', fired_at: '2026-05-13T12:00:00.000Z' },
    ];
    const out = summarizeRecentAlerts(rows);
    assert.equal(out.total, 3);
    assert.equal(out.red, 1);
    assert.equal(out.yellow, 2);
    assert.equal(out.green, 0);
    assert.equal(out.last_fired_at, '2026-05-13T15:00:00.000Z');
    assert.equal(out.most_recent_sli, 'offmarket-feed-ratio');
  });

  await t.test('ignores rows missing required fields', () => {
    const rows = [
      { sli: 'offmarket-feed-ratio', severity: 'red', fired_at: '2026-05-13T14:00:00.000Z' },
      { /* no sli */ severity: 'red', fired_at: '2026-05-13T15:00:00.000Z' },
      { sli: 'offmarket-empty-rate', /* no severity */ fired_at: '2026-05-13T16:00:00.000Z' },
      { sli: 'offmarket-429-burst', severity: 'yellow' /* no fired_at */ },
    ];
    const out = summarizeRecentAlerts(rows);
    assert.equal(out.total, 1, 'only the fully-formed row counts');
    assert.equal(out.red, 1);
    assert.equal(out.most_recent_sli, 'offmarket-feed-ratio');
  });

  await t.test('tolerates Date object fired_at (not just ISO string)', () => {
    const rows = [
      { sli: 'a', severity: 'red', fired_at: new Date('2026-05-13T10:00:00.000Z') },
      { sli: 'b', severity: 'red', fired_at: new Date('2026-05-13T15:00:00.000Z') },
    ];
    const out = summarizeRecentAlerts(rows);
    assert.equal(out.total, 2);
    assert.equal(out.most_recent_sli, 'b');
    // last_fired_at normalizes to ISO string for stable JSON serialization
    assert.equal(out.last_fired_at, '2026-05-13T15:00:00.000Z');
  });

  await t.test('non-array input returns the empty summary (defensive)', () => {
    const empty = summarizeRecentAlerts(null);
    assert.equal(empty.total, 0);
    assert.equal(empty.last_fired_at, null);
    assert.deepEqual(summarizeRecentAlerts(undefined), empty);
    assert.deepEqual(summarizeRecentAlerts('not an array'), empty);
  });
});
