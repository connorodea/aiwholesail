/**
 * Tests for the smoke-test fixture helper used by
 * scripts/smoke-test-zillow-actions.js.
 *
 * Why this exists (task #49, May 2026):
 *
 *   The smoke-test script pins every action to a single DEFAULT_ZPID
 *   (an Austin TX listing). Three of the 27 actions — walkScore,
 *   climateRisk, rentalComps — require properties that have those
 *   specific Zillow widgets. Without a fixture override, the smoke
 *   test produces predictable "no_data_in_payload" failures against
 *   DEFAULT_ZPID, which is noise: the failures aren't bugs in the
 *   scraper, they're a fixture mismatch.
 *
 *   This helper provides per-action ZPID resolution from env vars,
 *   falling back to DEFAULT_ZPID when not set. Operators can swap in
 *   real ZPIDs (an urban-with-transit property for walkScore, a coastal
 *   property for climateRisk, a rentable property for rentalComps) by
 *   setting the env vars before running the smoke test, without
 *   editing the script.
 *
 *   Surfaced as PR #358's code review: "smoke-test should have action-
 *   specific fixtures." Filed as #49 in the task tracker.
 *
 * Test pattern: pure function with env-var injection.
 *
 *   $ node --test test/lib/smoke-test-fixtures.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { zpidFor, ACTION_ZPID_ENV, DEFAULT_ZPID } = require('../../lib/smoke-test-fixtures');

test('smoke-test fixture helper — per-action ZPID resolution', async (t) => {

  await t.test('exports DEFAULT_ZPID constant (Austin TX baseline)', () => {
    assert.equal(typeof DEFAULT_ZPID, 'string', 'DEFAULT_ZPID must be a string');
    assert.match(DEFAULT_ZPID, /^\d+$/, 'DEFAULT_ZPID must be all digits (a real ZPID)');
  });

  await t.test('exports ACTION_ZPID_ENV map naming the override env-var per action', () => {
    // The map is the documented contract for operators: "to override
    // ZPID for action X, set the env var named ACTION_ZPID_ENV[X]".
    // The 3 problematic actions MUST appear; other actions are
    // optional (most don't need a per-action ZPID).
    assert.equal(typeof ACTION_ZPID_ENV, 'object');
    assert.ok(ACTION_ZPID_ENV.walkScore, 'walkScore must have an env-var convention');
    assert.ok(ACTION_ZPID_ENV.climateRisk, 'climateRisk must have an env-var convention');
    assert.ok(ACTION_ZPID_ENV.rentalComps, 'rentalComps must have an env-var convention');
  });

  await t.test('env-var names follow AIW_SMOKE_ZPID_<ACTION> convention', () => {
    // The naming convention prevents env-var collisions with other
    // smoke-test or production environment vars. AIW_SMOKE_ prefix
    // scopes it to "AIWholesail smoke test."
    for (const [action, envName] of Object.entries(ACTION_ZPID_ENV)) {
      assert.match(
        envName,
        /^AIW_SMOKE_ZPID_[A-Z_]+$/,
        `env name for ${action} must follow AIW_SMOKE_ZPID_<ACTION> convention (got: ${envName})`
      );
    }
  });

  await t.test('zpidFor(action) returns env-var value when set', () => {
    process.env.AIW_SMOKE_ZPID_WALKSCORE = '99999999';
    try {
      assert.equal(zpidFor('walkScore'), '99999999');
    } finally {
      delete process.env.AIW_SMOKE_ZPID_WALKSCORE;
    }
  });

  await t.test('zpidFor(action) returns DEFAULT_ZPID when env-var not set', () => {
    delete process.env.AIW_SMOKE_ZPID_WALKSCORE;
    assert.equal(zpidFor('walkScore'), DEFAULT_ZPID);
  });

  await t.test('zpidFor(action) returns DEFAULT_ZPID for unknown action', () => {
    // search/propertyDetails/etc. have no per-action override convention.
    // The helper must still return SOMETHING usable — DEFAULT_ZPID is fine
    // for those because they accept any valid ZPID.
    assert.equal(zpidFor('search'), DEFAULT_ZPID);
    assert.equal(zpidFor('propertyDetails'), DEFAULT_ZPID);
    assert.equal(zpidFor(undefined), DEFAULT_ZPID);
    assert.equal(zpidFor(null), DEFAULT_ZPID);
    assert.equal(zpidFor(''), DEFAULT_ZPID);
  });

  await t.test('zpidFor(action) trims whitespace from env-var value', () => {
    // Operator-set env vars sometimes carry trailing whitespace from
    // shell quoting. A ZPID with whitespace would fail Zillow URL
    // construction silently.
    process.env.AIW_SMOKE_ZPID_CLIMATERISK = '  12345  ';
    try {
      assert.equal(zpidFor('climateRisk'), '12345');
    } finally {
      delete process.env.AIW_SMOKE_ZPID_CLIMATERISK;
    }
  });

  await t.test('zpidFor(action) falls back to DEFAULT_ZPID for empty env-var', () => {
    // Operator sets AIW_SMOKE_ZPID_WALKSCORE="" — should NOT use the
    // empty string as the ZPID (would yield a broken Zillow URL).
    // Fall back to DEFAULT_ZPID instead.
    process.env.AIW_SMOKE_ZPID_WALKSCORE = '';
    try {
      assert.equal(zpidFor('walkScore'), DEFAULT_ZPID);
    } finally {
      delete process.env.AIW_SMOKE_ZPID_WALKSCORE;
    }
  });
});

test('smoke-test fixture helper — operator README assertions', async (t) => {

  await t.test('script header documents the AIW_SMOKE_ZPID_<ACTION> env-var convention', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const script = path.join(__dirname, '..', '..', 'scripts', 'smoke-test-zillow-actions.js');
    const source = fs.readFileSync(script, 'utf8');

    // The script's usage doc-comment must mention the env-var override
    // mechanism so operators don't need to read this test to discover it.
    assert.match(
      source,
      /AIW_SMOKE_ZPID_/,
      'scripts/smoke-test-zillow-actions.js header must document the ' +
      'AIW_SMOKE_ZPID_<ACTION> env-var override convention. Without it, ' +
      'operators won\'t discover that walkScore/climateRisk/rentalComps ' +
      'failures are fixture mismatches (not scraper bugs) and won\'t ' +
      'know how to set real fixtures.'
    );
  });

  await t.test('script uses zpidFor() for the 3 problematic actions, not DEFAULT_ZPID inline', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const script = path.join(__dirname, '..', '..', 'scripts', 'smoke-test-zillow-actions.js');
    const source = fs.readFileSync(script, 'utf8');

    // Each of the three actions must read its ZPID via zpidFor() (or
    // an equivalently env-aware path). If the script still hardcodes
    // DEFAULT_ZPID for these, the per-action override mechanism is
    // wired up but unused — false sense of security.
    for (const action of ['walkScore', 'climateRisk', 'rentalComps']) {
      const inputPattern = new RegExp(`${action}\\s*:\\s*\\{\\s*zpid\\s*:\\s*zpidFor\\(`);
      assert.match(
        source,
        inputPattern,
        `${action} in ACTION_INPUTS must use zpidFor('${action}') so the ` +
        `operator's env-var override takes effect. Hardcoded DEFAULT_ZPID ` +
        `bypasses the per-action fixture mechanism.`
      );
    }
  });
});
