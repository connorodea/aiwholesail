/**
 * Regression guard for the Stripe Checkout configuration.
 *
 * Why this exists: in May 2026 we discovered that two of three Stripe
 * Checkout paths used `payment_method_collection: 'if_required'` (or
 * defaulted) AND/OR set `trial_period_days: 7` on top of the in-app
 * trial. Net effect: card-less subscriptions auto-cancelled silently
 * and ZERO dollars were collected through those flows for 6+ months.
 *
 * These tests asserts the literal config values that prevent that
 * failure mode. If anyone reverts `'always'` → `'if_required'`, or
 * adds `trial_period_days: 7` back, these tests fail loudly.
 *
 * Source bug context:
 *   - PR #266 (fix card requirement at Checkout)
 *   - PR #269 (paid-user gate + day_zero query tightening)
 *   - docs/tech-debt-trial-funnel-2026-05-12.md (TD-002)
 *
 * Approach: file-source introspection rather than mock-and-execute,
 * because the route handlers reach for global `stripe`, `query`, `jwt`
 * etc. and aren't trivially mockable without a larger refactor.
 * Source-level assertion is fragile but cheap and catches the exact
 * regression we care about. Upgrade to handler-level mocks when the
 * route handlers are extracted into testable units (TD-002 followup).
 *
 * Runs under built-in node:test. Zero external dependencies.
 *   $ npm test    (from aiwholesail-api/)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

const SOURCES = {
  stripe_checkout: path.join(REPO_ROOT, 'aiwholesail-api', 'routes', 'stripe.js'),
  trial_upgrade:   path.join(REPO_ROOT, 'aiwholesail-api', 'routes', 'auth.js'),
  supabase_legacy: path.join(REPO_ROOT, 'supabase', 'functions', 'create-checkout', 'index.ts'),
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

// Helpers: scan for a config block following a stripe.checkout.sessions.create
// invocation. We look at the next ~2KB of source after the create() call.
function scanCheckoutBlock(source) {
  const blocks = [];
  const createRegex = /stripe\.checkout\.sessions\.create\s*\(\s*\{/g;
  let m;
  while ((m = createRegex.exec(source)) !== null) {
    const start = m.index;
    // Find the matching closing brace by counting nesting depth.
    let depth = 0;
    let i = source.indexOf('{', start);
    const blockStart = i;
    while (i < source.length) {
      const c = source[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { blocks.push(source.slice(blockStart, i + 1)); break; }
      }
      i++;
    }
  }
  return blocks;
}

test('Stripe checkout config — regression guard', async (t) => {

  // ─── POST /api/stripe/checkout ───────────────────────────────────────
  await t.test('routes/stripe.js: every Checkout session requires a card', () => {
    const source = read(SOURCES.stripe_checkout);
    const blocks = scanCheckoutBlock(source);
    assert.ok(blocks.length >= 1, 'expected at least one stripe.checkout.sessions.create call in routes/stripe.js');
    for (const block of blocks) {
      assert.match(block, /payment_method_collection\s*:\s*['"]always['"]/,
        `Checkout session in routes/stripe.js must use payment_method_collection: 'always'.\n` +
        `Got config block:\n${block.slice(0, 400)}...`);
    }
  });

  await t.test('routes/stripe.js: no Checkout session grants a second Stripe trial', () => {
    const source = read(SOURCES.stripe_checkout);
    const blocks = scanCheckoutBlock(source);
    for (const block of blocks) {
      // Allow trial_period_days: 0 but reject any positive value.
      const m = block.match(/trial_period_days\s*:\s*(\d+)/);
      if (m) {
        assert.equal(m[1], '0',
          `Checkout in routes/stripe.js must NOT grant a Stripe trial (in-app trial is the lead magnet).\n` +
          `Got trial_period_days: ${m[1]}. Stacking on top of the 7-day in-app trial was the original bug.`);
      }
    }
  });

  // ─── GET /api/auth/trial-upgrade ─────────────────────────────────────
  await t.test('routes/auth.js: trial-upgrade Checkout requires a card', () => {
    const source = read(SOURCES.trial_upgrade);
    const blocks = scanCheckoutBlock(source);
    assert.ok(blocks.length >= 1, 'expected at least one stripe.checkout.sessions.create call in routes/auth.js');
    for (const block of blocks) {
      assert.match(block, /payment_method_collection\s*:\s*['"]always['"]/,
        `trial-upgrade Checkout in routes/auth.js must use 'always'.\n` +
        `Was 'if_required' before PR #266 — caused 11 silent auto-cancels.`);
    }
  });

  await t.test('routes/auth.js: trial-upgrade explicitly sets trial_period_days: 0', () => {
    const source = read(SOURCES.trial_upgrade);
    const blocks = scanCheckoutBlock(source);
    for (const block of blocks) {
      const m = block.match(/trial_period_days\s*:\s*(\d+)/);
      assert.ok(m, 'trial-upgrade Checkout must explicitly set trial_period_days: 0 (no double trial)');
      assert.equal(m[1], '0', `trial-upgrade must use trial_period_days: 0, got ${m[1]}`);
    }
  });

  await t.test('routes/auth.js: trial-upgrade gates already-paid users before creating a Checkout session', () => {
    const source = read(SOURCES.trial_upgrade);
    // Must check subscribers table and redirect paid users away from creating a duplicate sub.
    assert.match(source, /SELECT\s+subscribed,\s+is_trial,\s+subscription_end[\s\S]*?FROM\s+subscribers\s+WHERE\s+user_id\s*=\s*\$1/i,
      'trial-upgrade must query subscribers to detect paid users before creating a new Checkout');
    assert.match(source, /\/app\/account\?notice=already-subscribed/,
      'paid users must be redirected to /app/account?notice=already-subscribed, not into a new Checkout');
  });

  // ─── supabase/functions/create-checkout (legacy edge function) ───────
  await t.test('supabase create-checkout: requires a card', () => {
    const source = read(SOURCES.supabase_legacy);
    assert.match(source, /payment_method_collection\s*:\s*['"]always['"]/,
      `Supabase create-checkout function must use 'always'.\n` +
      `Was missing entirely before PR #266 — defaulted to 'if_required'.`);
  });

  await t.test('supabase create-checkout: no Stripe-side trial', () => {
    const source = read(SOURCES.supabase_legacy);
    const m = source.match(/trial_period_days\s*:\s*(\d+)/);
    if (m) {
      assert.equal(m[1], '0',
        `Supabase create-checkout must NOT grant a Stripe trial. ` +
        `Was trial_period_days: 7 before PR #266 (double-trial bug).`);
    }
  });

  // ─── Lifecycle worker day_zero query (PR #269 second half) ──────────
  await t.test('trial-lifecycle-worker: day_zero query does not look into the future', () => {
    const workerPath = path.join(REPO_ROOT, 'aiwholesail-api', 'scripts', 'trial-lifecycle-worker.js');
    const source = fs.readFileSync(workerPath, 'utf8');
    // Find the day_zero milestone block specifically
    const dayZeroMatch = source.match(/type:\s*['"]day_zero['"][\s\S]*?render:/);
    assert.ok(dayZeroMatch, 'expected to find day_zero milestone definition');
    const block = dayZeroMatch[0];
    // Must NOT have "NOW() + INTERVAL '5 minutes'" or similar future window
    assert.doesNotMatch(block, /NOW\(\)\s*\+\s*INTERVAL\s*['"]\d+\s*minute/i,
      'day_zero query must not look into the future — users got "trial ended" emails before their trial actually ended');
  });

  await t.test('trial-lifecycle-worker: day_zero query excludes paid users', () => {
    // Invariant: paid users (subscribed=true AND is_trial=false) must never
    // receive the "your trial just ended" email — that path was the source of
    // pre-PR-#269 complaints.
    //
    // Before the trial-expiry-sweep worker existed, the filter was
    // `s.is_trial = true` (which incidentally excluded paid users, since
    // paid users have is_trial=false). After the sweep was added, the filter
    // became `NOT (subscribed AND NOT is_trial)`, which preserves the
    // paid-user exclusion AND lets the lifecycle worker still find users
    // whose trial-end the sweep just downgraded.
    //
    // This test pins the *invariant* (paid users excluded), not the SQL
    // wording, so future predicate changes that maintain the invariant pass.
    const workerPath = path.join(REPO_ROOT, 'aiwholesail-api', 'scripts', 'trial-lifecycle-worker.js');
    const source = fs.readFileSync(workerPath, 'utf8');
    const dayZeroMatch = source.match(/type:\s*['"]day_zero['"][\s\S]*?render:/);
    assert.ok(dayZeroMatch);
    const block = dayZeroMatch[0];
    const hasOldFilter = /s\.is_trial\s*=\s*true/i.test(block);
    const hasNewFilter = /NOT\s*\(\s*s\.subscribed\s*=\s*true\s+AND\s+s\.is_trial\s*=\s*false\s*\)/i.test(block);
    assert.ok(hasOldFilter || hasNewFilter,
      'day_zero query must exclude paid users via either `s.is_trial = true` (old) or ' +
      '`NOT (s.subscribed = true AND s.is_trial = false)` (post-sweep). Neither found.');
  });
});
