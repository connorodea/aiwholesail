// Tests for the Resend rate-limit retry helper used by the spread-alert
// worker.
//
// 2026-05-15 incident: the 22:05 cron blasted ~22 alert emails in 2
// seconds, hit Resend's 5-RPS limit, and 12 of 22 dispatches failed
// with a 429. The worker had no retry, so those 12 users will not
// receive the deal — the worker had also already marked the deals as
// "sent" in alert_sent_deals (separate fix in the worker itself).
//
// This module exposes a pure-ish retry helper: takes any Resend SDK
// call (or any function returning {data, error}) and retries on
// 429 with exponential backoff. Non-429 errors throw immediately.
//
// Run:
//   node --test aiwholesail-api/test/lib/sendWithRetry.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { sendWithRetry } = require('../../lib/sendWithRetry');

function rateLimit(message = 'Too many requests') {
  return { error: { statusCode: 429, name: 'rate_limit_exceeded', message } };
}

function ok(id = 'msg_xyz') {
  return { data: { id }, error: null };
}

test('returns first-try success without retrying', async () => {
  let calls = 0;
  const result = await sendWithRetry(async () => {
    calls++;
    return ok();
  }, { maxRetries: 3, baseDelayMs: 10 });

  assert.equal(calls, 1);
  assert.equal(result.data.id, 'msg_xyz');
});

test('retries on 429 then returns success', async () => {
  let calls = 0;
  const result = await sendWithRetry(async () => {
    calls++;
    return calls < 3 ? rateLimit() : ok('msg_after_retry');
  }, { maxRetries: 5, baseDelayMs: 1 });

  assert.equal(calls, 3);
  assert.equal(result.data.id, 'msg_after_retry');
});

test('throws after exhausting retries on persistent 429', async () => {
  let calls = 0;
  await assert.rejects(
    () => sendWithRetry(async () => {
      calls++;
      return rateLimit();
    }, { maxRetries: 3, baseDelayMs: 1 }),
    /rate_limit_exceeded|429/i,
  );
  // maxRetries: 3 means 1 initial + 3 retries = 4 attempts total.
  assert.equal(calls, 4);
});

test('does NOT retry non-429 errors — bubbles them immediately', async () => {
  let calls = 0;
  await assert.rejects(
    () => sendWithRetry(async () => {
      calls++;
      return { error: { statusCode: 422, name: 'validation_error', message: 'bad recipient' } };
    }, { maxRetries: 5, baseDelayMs: 1 }),
    /validation_error|bad recipient/,
  );
  assert.equal(calls, 1);
});

test('throws immediately when sendFn throws synchronously (network error etc.)', async () => {
  let calls = 0;
  await assert.rejects(
    () => sendWithRetry(async () => {
      calls++;
      throw new Error('ECONNRESET');
    }, { maxRetries: 5, baseDelayMs: 1 }),
    /ECONNRESET/,
  );
  // Synchronous throws are not retried — they're typically not transient
  // rate-limit signals, and the Resend SDK returns them via the {error}
  // envelope when they are.
  assert.equal(calls, 1);
});

test('exponential backoff — second retry waits longer than first', async () => {
  const delays = [];
  const start = Date.now();
  let calls = 0;
  const checkpoints = [];
  await sendWithRetry(async () => {
    calls++;
    checkpoints.push(Date.now() - start);
    return calls < 3 ? rateLimit() : ok();
  }, { maxRetries: 3, baseDelayMs: 50 });

  // checkpoints[0] = 0 (first call, no wait)
  // checkpoints[1] should be ≥ 50 (1× baseDelay)
  // checkpoints[2] should be ≥ 50 + 100 = 150 (1× + 2× baseDelay, exponential)
  assert.ok(checkpoints[1] >= 45, `expected ≥45ms before 2nd attempt, got ${checkpoints[1]}`);
  assert.ok(checkpoints[2] >= 140, `expected ≥140ms before 3rd attempt (exponential backoff), got ${checkpoints[2]}`);
});
