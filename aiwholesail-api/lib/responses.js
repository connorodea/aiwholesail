/**
 * Unified error response helpers.
 *
 * The codebase emits at least three error shapes today:
 *
 *   { error }                                          — bare string
 *   { error, code }                                    — adds a machine-readable code
 *   { error, code, message, ... }                      — adds a user-facing longer message
 *   { error: 'Validation failed', errors: [...] }      — from express-validator
 *
 * The frontend's `ApiResponse` type (src/lib/api-client.ts) reads all four
 * via `{ error?: string, code?: string, errors?: Array<{field, message}> }`,
 * so any of the existing shapes is already a strict subset of what the
 * frontend handles. This helper just centralizes the construction so:
 *
 *   - new code doesn't invent a sixth shape
 *   - the response always includes `error` (the frontend's mandatory field)
 *   - optional fields are added uniformly
 *
 * Usage:
 *
 *   const { respondError } = require('../lib/responses');
 *   respondError(res, 400, 'Email already registered', { code: 'EMAIL_TAKEN' });
 *   respondError(res, 429, 'Rate limit exceeded', {
 *     code: 'LLM_BUDGET_EXCEEDED',
 *     details: { tier, used_cents, cap_cents },
 *   });
 *   respondError(res, 400, 'Validation failed', { errors: validationResult(req).array() });
 *
 * Migration plan: future PRs replace `res.status(N).json({ error: ... })`
 * with `respondError(res, N, ...)` opportunistically — no rush, no
 * frontend regression risk because the output shape is a superset.
 */

/**
 * @param {import('express').Response} res
 * @param {number} status   HTTP status code (400, 401, 403, 404, 409, 429, 500...)
 * @param {string} message  Human-readable error string. ALWAYS emitted as `error`.
 * @param {object} [opts]
 * @param {string} [opts.code]              Stable machine-readable code (e.g. 'BUYER_UNSUBSCRIBED', 'LLM_BUDGET_EXCEEDED').
 * @param {Array}  [opts.errors]            Array of {field, message} from express-validator.
 * @param {object} [opts.details]           Extra structured fields to merge into the body (avoid overwriting `error`/`code`/`errors`).
 * @param {object} [opts.headers]           Extra response headers to set (e.g. { 'Retry-After': '900' }).
 * @returns {import('express').Response}
 */
function respondError(res, status, message, opts = {}) {
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      res.set(k, String(v));
    }
  }
  const body = { error: String(message) };
  if (opts.code)   body.code   = opts.code;
  if (opts.errors) body.errors = opts.errors;
  if (opts.details && typeof opts.details === 'object') {
    for (const [k, v] of Object.entries(opts.details)) {
      // Never let details overwrite the canonical top-level keys.
      if (k === 'error' || k === 'code' || k === 'errors') continue;
      body[k] = v;
    }
  }
  return res.status(status).json(body);
}

module.exports = { respondError };
