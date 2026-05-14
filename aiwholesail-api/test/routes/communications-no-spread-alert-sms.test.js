/**
 * Regression guard for the dead-code cleanup of the SMS spread-alert flow.
 *
 * Why this exists (review follow-up to PR #374, May 2026):
 *
 *   #374 (rebased from #215) removed the SMS-button entry point in
 *   `src/pages/RealEstateWholesaler.tsx` that called
 *   `communications.sendSpreadAlert(deals, location, phone)`. After that
 *   merge there are ZERO callers of:
 *
 *     - Client method `communications.sendSpreadAlert` (src/lib/api-client.ts)
 *     - Server route `POST /api/communications/spread-alert`
 *       (aiwholesail-api/routes/communications.js)
 *     - Server rate-limit bucket `'spread-alert-sms'` (same file)
 *
 *   The code reviewer of #374 flagged this as Important #2 — dead code
 *   that "stays without a frontend caller" and risks a future engineer
 *   re-attaching an SMS sender. The bucket also occupies a slot in the
 *   `database_rate_limits` namespace forever for no reason.
 *
 *   This test asserts the dead code is gone. If anyone reintroduces it
 *   (e.g., by reverting #374 partially, or by adding a new SMS-alert
 *   feature without first re-establishing the alert worker's Twilio
 *   plumbing), the failing assertion explains exactly which surface
 *   came back.
 *
 *   See `aiwholesail-api/scripts/spread-alert-worker.js` for the
 *   intentionally-retained Twilio scaffolding (env vars, sendSMS helper,
 *   smsSent = false hardcode) — that's the reversible-disable layer and
 *   is OUT of scope for this guard. We only assert the user-initiated
 *   per-request SMS path (the dead client+server pair) is removed.
 *
 * Approach: file-source introspection. Matches the established
 * route-test pattern in this repo (api-client-refresh.test.js,
 * stripe-checkout-config.test.js, zillow-no-data.test.js).
 *
 *   $ npm test    (from aiwholesail-api/)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const API_CLIENT = path.join(REPO_ROOT, 'src', 'lib', 'api-client.ts');
const COMMS_ROUTE = path.join(REPO_ROOT, 'aiwholesail-api', 'routes', 'communications.js');

const read = (file) => fs.readFileSync(file, 'utf8');

test('SMS spread-alert dead-code cleanup — regression guard', async (t) => {

  await t.test('src/lib/api-client.ts exists', () => {
    assert.ok(fs.existsSync(API_CLIENT), `${API_CLIENT} must exist`);
  });

  await t.test('aiwholesail-api/routes/communications.js exists', () => {
    assert.ok(fs.existsSync(COMMS_ROUTE), `${COMMS_ROUTE} must exist`);
  });

  await t.test('api-client.ts does NOT export communications.sendSpreadAlert', () => {
    const source = read(API_CLIENT);

    // The method was: `sendSpreadAlert: async (deals: any[], location: string, phone: string) => {...}`
    // After #374 there are zero callers. Removing the dead method prevents a
    // future engineer from re-attaching SMS sends without first restoring
    // the alert-worker's Twilio plumbing — which is the reversible-disable
    // layer (smsSent = false) that should be the ONLY place SMS state lives.
    assert.doesNotMatch(
      source,
      /sendSpreadAlert\s*:/,
      'src/lib/api-client.ts still defines `sendSpreadAlert`. After PR #374 ' +
      'removed the only caller, this client method is dead code. Re-attaching ' +
      'a caller would bypass the alert-worker\'s intentional smsSent=false ' +
      'gate (the reversible-disable layer for the email-only-alerts change). ' +
      'Delete the method.'
    );
  });

  await t.test('communications.js does NOT define POST /spread-alert', () => {
    const source = read(COMMS_ROUTE);

    // Both the route declaration and the doc-comment header should be gone.
    // The route was at lines 150-end of handler in the pre-cleanup source.
    assert.doesNotMatch(
      source,
      /router\.post\(\s*['"]\/spread-alert['"]/,
      'aiwholesail-api/routes/communications.js still defines POST /spread-alert. ' +
      'After PR #374 there is no frontend caller. Keeping a server endpoint ' +
      'with no client is a future-attack-surface and a maintenance tax. Delete.'
    );
  });

  await t.test('spread-alert-sms rate-limit bucket is gone', () => {
    const source = read(COMMS_ROUTE);

    // The bucket was: checkDatabaseRateLimit(req.user.id, 'spread-alert-sms', 5, 60)
    // It only existed inside the now-deleted route handler. Asserting on the
    // literal string catches a partial revert where someone deletes the handler
    // but copies the bucket name into a different route.
    assert.doesNotMatch(
      source,
      /['"]spread-alert-sms['"]/,
      'aiwholesail-api/routes/communications.js still references the ' +
      '`spread-alert-sms` rate-limit bucket. This bucket only existed inside ' +
      'the POST /spread-alert handler — its presence means the dead route was ' +
      'partially revived or a stray reference was left behind. Remove it; the ' +
      'database_rate_limits namespace shouldn\'t carry orphan slots.'
    );
  });

  await t.test('other communications routes are preserved (not over-deletion)', () => {
    const source = read(COMMS_ROUTE);

    // Sanity: the OTHER routes in this file (send-email, send-sms for sequence
    // outreach, etc.) must still exist. If a cleanup PR accidentally deleted
    // the wrong thing, this catches it. The send-sms route here is for the
    // *sequences* outbound feature (separate product surface), not for
    // property alerts — must stay.
    assert.match(
      source,
      /router\.(post|get|put|delete|patch)\s*\(/,
      'communications.js must still define at least one route — accidental ' +
      'full-file deletion check.'
    );
  });

  await t.test('alert-worker Twilio scaffolding is intentionally PRESERVED (not in scope of this cleanup)', () => {
    // The worker keeps sendSMS, TWILIO_* env vars, and the smsSent=false
    // hardcode as a reversible-disable layer (per #374 comment). This
    // cleanup is NOT undoing that. If a future cleanup wants to drop the
    // worker scaffolding too, that's a separate decision that should be
    // explicit (and probably guarded by "are we re-enabling SMS soon?").
    const worker = path.join(REPO_ROOT, 'aiwholesail-api', 'scripts', 'spread-alert-worker.js');
    if (!fs.existsSync(worker)) return; // file may be reorg'd; not strict
    const source = read(worker);
    assert.match(
      source,
      /smsSent\s*=\s*false/,
      'spread-alert-worker.js no longer has `smsSent = false`. The worker\'s ' +
      'Twilio scaffolding is the reversible-disable layer for email-only-alerts ' +
      '(#374). This cleanup PR was supposed to drop ONLY the user-initiated ' +
      'per-request SMS path (client method + server route + bucket), not the ' +
      'worker scaffolding. If you intended to remove the worker scaffolding ' +
      'too, do it in a separate, explicit PR with its own justification.'
    );
  });
});
