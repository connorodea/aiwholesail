/**
 * Unit tests for the off-market routing-monitor SLI evaluators. Tests
 * the pure threshold logic in isolation — no journalctl, no Pool, no
 * Resend. The cron script (scripts/offmarket-routing-monitor.js) wires
 * these evaluators to real infra.
 *
 * Anchor scenario: PR #311 fixed a dual-feed routing collapse where
 * 100% of off-market searches hit /api/propdata/preforeclosure. Each
 * SLI defined here should fire on the exact log shape that incident
 * produced.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePropDataLog,
  evaluateFeedRatio,
  evaluateUser429Burst,
  evaluateEmptyResultRate,
  evaluateEndpointDiversity,
} = require('../../lib/offmarket-monitor-thresholds');

// ─── parsePropDataLog ────────────────────────────────────────────────────

test('parsePropDataLog', async (t) => {
  await t.test('parses a clean propdata JSON line', () => {
    const line = '{"component":"propdata","endpoint":"/v1/property","status":200,"user_id":"u1"}';
    assert.deepEqual(parsePropDataLog(line), {
      component: 'propdata',
      endpoint: '/v1/property',
      status: 200,
      user_id: 'u1',
    });
  });

  await t.test('tolerates a syslog prefix before the JSON', () => {
    const line = 'May 13 13:31:38 vps-odea aiwholesail-api[2715987]: {"component":"propdata","endpoint":"/v1/preforeclosure/delta","status":404}';
    const parsed = parsePropDataLog(line);
    assert.equal(parsed.endpoint, '/v1/preforeclosure/delta');
    assert.equal(parsed.status, 404);
  });

  await t.test('returns null for non-propdata lines', () => {
    assert.equal(parsePropDataLog('{"component":"morgan","msg":"GET /"}'), null);
  });

  await t.test('returns null for malformed JSON without throwing', () => {
    assert.equal(parsePropDataLog('not json at all'), null);
    assert.equal(parsePropDataLog('{"broken":'), null);
    assert.equal(parsePropDataLog(''), null);
    assert.equal(parsePropDataLog(null), null);
  });
});

// ─── SLI-2: Feed ratio ───────────────────────────────────────────────────

test('evaluateFeedRatio', async (t) => {
  await t.test('null when below min sample (low traffic)', () => {
    const logs = Array(5).fill({ endpoint: '/v1/preforeclosure/delta' });
    assert.equal(evaluateFeedRatio(logs), null);
  });

  await t.test('null when ratio is healthy', () => {
    const logs = [
      ...Array(2).fill({ endpoint: '/v1/preforeclosure/delta' }),
      ...Array(20).fill({ endpoint: '/v1/property' }),
    ];
    assert.equal(evaluateFeedRatio(logs), null);
  });

  await t.test('FIRES on the exact 2026-05-13 incident shape — 25 preforeclosure / 0 property', () => {
    // Mirror of prod log: all 25 fan-out calls hit /v1/preforeclosure/delta.
    const logs = Array(25).fill({ endpoint: '/v1/preforeclosure/delta' });
    const alert = evaluateFeedRatio(logs);
    assert.ok(alert, 'should fire on the incident shape');
    assert.equal(alert.sli, 'offmarket-feed-ratio');
    assert.equal(alert.severity, 'red');
    assert.equal(alert.details.preforeclosure_calls, 25);
    assert.equal(alert.details.property_calls, 0);
    assert.equal(alert.value, 999); // sentinel for zero-denominator
  });

  await t.test('fires at 60% preforeclosure (above 50% threshold)', () => {
    const logs = [
      ...Array(12).fill({ endpoint: '/v1/preforeclosure/delta' }),
      ...Array(8).fill({ endpoint: '/v1/property' }),
    ];
    const alert = evaluateFeedRatio(logs);
    assert.ok(alert);
    assert.equal(alert.value, 1.5);
  });

  await t.test('does NOT fire at exactly 0.5 ratio (boundary)', () => {
    const logs = [
      ...Array(5).fill({ endpoint: '/v1/preforeclosure/delta' }),
      ...Array(10).fill({ endpoint: '/v1/property' }),
    ];
    assert.equal(evaluateFeedRatio(logs), null);
  });

  await t.test('custom thresholds override defaults', () => {
    const logs = [
      ...Array(5).fill({ endpoint: '/v1/preforeclosure/delta' }),
      ...Array(10).fill({ endpoint: '/v1/property' }),
    ];
    // Tighten threshold: 0.5 NOW fires.
    const alert = evaluateFeedRatio(logs, { ratioThreshold: 0.4 });
    assert.ok(alert);
  });
});

// ─── SLI-4: Per-user 429 burst ───────────────────────────────────────────

test('evaluateUser429Burst', async (t) => {
  await t.test('null when no 429s', () => {
    const logs = Array(20).fill({ status: 200, user_id: 'u1' });
    assert.equal(evaluateUser429Burst(logs), null);
  });

  await t.test('null when 429s spread across many users (≤5 each)', () => {
    const logs = [
      { status: 429, user_id: 'u1' },
      { status: 429, user_id: 'u2' },
      { status: 429, user_id: 'u3' },
    ];
    assert.equal(evaluateUser429Burst(logs), null);
  });

  await t.test('FIRES when single user racks up >5 throttles (incident pattern)', () => {
    // The 2026-05-13 incident had ~12 429s in 5 min for one user_id
    // (the user who ran the FL all-12-types search).
    const logs = Array(12).fill({ status: 429, user_id: 'jabenetti' });
    const alert = evaluateUser429Burst(logs);
    assert.ok(alert);
    assert.equal(alert.sli, 'offmarket-429-burst');
    assert.equal(alert.severity, 'yellow');
    assert.equal(alert.details.user_id, 'jabenetti');
    assert.equal(alert.value, 12);
  });

  await t.test('boundary at exactly the threshold (5 → no fire, 6 → fire)', () => {
    const five = Array(5).fill({ status: 429, user_id: 'u1' });
    assert.equal(evaluateUser429Burst(five), null);
    const six = Array(6).fill({ status: 429, user_id: 'u1' });
    assert.ok(evaluateUser429Burst(six));
  });
});

// ─── SLI-3: Empty-result rate ────────────────────────────────────────────

test('evaluateEmptyResultRate', async (t) => {
  function search(user_id, result_count) {
    return { component: 'offmarket-search', user_id, result_count };
  }

  await t.test('null below min sample', () => {
    const events = Array(4).fill(search('u1', 0));
    assert.equal(evaluateEmptyResultRate(events), null);
  });

  await t.test('null when empties cluster on one user (legit zero, not regression)', () => {
    const events = [
      ...Array(5).fill(search('u1', 0)), // one chronic empty user
      ...Array(5).fill(search('u2', 10)),
    ];
    assert.equal(evaluateEmptyResultRate(events), null);
  });

  await t.test('FIRES on the incident shape — many users hit empty', () => {
    const events = [
      search('jabenetti', 0),
      search('cpodea5', 0),
      search('u3', 0),
      search('u4', 0),
      search('u5', 5),
      search('u6', 10),
      search('u7', 0),
      search('u8', 12),
    ];
    const alert = evaluateEmptyResultRate(events);
    assert.ok(alert);
    assert.equal(alert.sli, 'offmarket-empty-rate');
    assert.equal(alert.details.distinct_empty_users, 5);
    assert.equal(alert.details.empty, 5);
    assert.equal(alert.details.total, 8);
  });
});

// ─── SLI-1: Endpoint diversity ───────────────────────────────────────────

test('evaluateEndpointDiversity', async (t) => {
  function search(user_id, leadTypes, endpoints) {
    return {
      component: 'offmarket-search',
      user_id,
      lead_types_selected: leadTypes,
      endpoints_dispatched: endpoints,
    };
  }

  await t.test('null below min sample', () => {
    const events = Array(3).fill(search('u1', ['absentee', 'high-equity', 'tax-delinquent'], ['/v1/property']));
    assert.equal(evaluateEndpointDiversity(events), null);
  });

  await t.test('null on healthy traffic — multi-type searches dispatch to multiple endpoints', () => {
    const events = Array(10).fill(
      search('u1', ['absentee', 'pre-foreclosure', 'tax-delinquent'], ['/v1/property', '/v1/preforeclosure/delta']),
    );
    assert.equal(evaluateEndpointDiversity(events), null);
  });

  await t.test('FIRES on the incident shape — 100% of multi-type searches hit only 1 endpoint', () => {
    // PR #311 pre-fix: all 12 selected → routes to preforeclosure ONLY.
    const events = Array(10).fill(
      search('jabenetti',
        ['absentee', 'pre-foreclosure', 'tax-delinquent', 'high-equity', 'free-and-clear'],
        ['/v1/preforeclosure/delta'], // ← single endpoint, the bug
      ),
    );
    const alert = evaluateEndpointDiversity(events);
    assert.ok(alert);
    assert.equal(alert.sli, 'offmarket-endpoint-diversity');
    assert.equal(alert.severity, 'red');
    assert.equal(alert.value, 1.0); // 100% single-endpoint
    assert.equal(alert.details.single_endpoint_searches, 10);
  });

  await t.test('ignores single-type searches (they legitimately hit one endpoint)', () => {
    // 5 searches that only selected 1-2 lead types — these shouldn't be
    // counted as suspicious even if they dispatch to a single endpoint.
    const events = [
      ...Array(5).fill(search('u1', ['absentee'], ['/v1/property'])),
    ];
    assert.equal(evaluateEndpointDiversity(events), null);
  });
});
