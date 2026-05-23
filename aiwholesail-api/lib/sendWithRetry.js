// Resend rate-limit retry helper.
//
// The Resend SDK returns rate-limit failures as `{ error: { statusCode: 429, ... } }`
// instead of throwing — the spread-alert worker's per-loop dispatch hits
// the 5-RPS account limit when many alerts are due in the same run.
//
// Wraps any async sendFn that returns `{ data, error }` (Resend SDK shape).
// Retries on 429 with exponential backoff, throws immediately on every
// other error (validation, network, anything not transient). Synchronous
// throws are NOT retried — Resend surfaces transient backend issues via
// the {error} envelope, so a sync throw is almost always a real bug.

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimit(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.statusCode === 429) return true;
  if (error.name === 'rate_limit_exceeded') return true;
  return false;
}

async function sendWithRetry(sendFn, { maxRetries = 3, baseDelayMs = 250 } = {}) {
  let attempt = 0;
  // total attempts = 1 initial + maxRetries
  for (;;) {
    const result = await sendFn();

    if (!result?.error) return result;

    if (!isRateLimit(result.error)) {
      const msg = result.error?.message || result.error?.name || 'send failed';
      const name = result.error?.name || 'send_error';
      throw new Error(`${name}: ${msg}`);
    }

    if (attempt >= maxRetries) {
      const msg = result.error?.message || 'rate limit exceeded';
      throw new Error(`rate_limit_exceeded after ${attempt + 1} attempts: ${msg}`);
    }

    // Exponential backoff: baseDelay × 2^attempt.
    const delay = baseDelayMs * Math.pow(2, attempt);
    await sleep(delay);
    attempt++;
  }
}

module.exports = { sendWithRetry };
