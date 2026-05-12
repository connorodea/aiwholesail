/**
 * Public unsubscribe surface — no auth, no rate-limit-by-user (the
 * recipient isn't a logged-in user). The global IP rate-limiter still
 * applies via the index.js mount.
 *
 * GET  /api/unsubscribe/:token   sets unsubscribed_at on the target row,
 *                                returns a simple server-rendered HTML
 *                                confirmation page (no JS, no client app
 *                                needed — works from any email client)
 * POST /api/unsubscribe/:token   resubscribe (clears unsubscribed_at) —
 *                                hidden form on the confirmation page
 *                                so an accidental click is recoverable
 *
 * Both endpoints are idempotent. Repeated GET → 200, the page just says
 * "you're already unsubscribed".
 */

const express = require('express');
const { query } = require('../config/database');
const { asyncHandler, logSecurityEvent } = require('../middleware/errorHandler');
const { verify } = require('../lib/unsubscribe');

const router = express.Router();

function htmlEscape(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderPage({ title, message, showResubscribe, token }) {
  const resubForm = showResubscribe
    ? `<form method="post" action="/api/unsubscribe/${encodeURIComponent(token)}" style="margin-top:24px;">
         <button type="submit" style="background:transparent;border:1px solid #404040;color:#a3a3a3;font-size:13px;padding:8px 16px;border-radius:6px;cursor:pointer;">
           Made a mistake? Click here to resubscribe.
         </button>
       </form>`
    : '';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEscape(title)} — AIWholesail</title>
<style>
  body { margin:0; background:#000; color:#e5e5e5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }
  .wrap { max-width:540px; margin:80px auto; padding:32px; background:#0a0a0b; border:1px solid #1a1a1a; border-radius:12px; }
  h1 { font-size:22px; font-weight:700; letter-spacing:-0.3px; margin:0 0 12px; }
  p  { font-size:15px; line-height:1.6; color:#a3a3a3; margin:0; }
  button:hover { background:#171717; }
</style>
</head><body>
  <div class="wrap">
    <h1>${htmlEscape(title)}</h1>
    <p>${htmlEscape(message)}</p>
    ${resubForm}
  </div>
</body></html>`;
}

function sendHtml(res, status, body) {
  res.status(status).set('Content-Type', 'text/html; charset=utf-8').send(body);
}

/**
 * Single shared handler for both verbs — both verify the token, look up
 * the right table, and either set or clear unsubscribed_at.
 */
async function handle(req, res, mode /* 'unsubscribe' | 'resubscribe' */) {
  const token = req.params.token;
  const decoded = verify(token);
  if (!decoded) {
    return sendHtml(res, 400, renderPage({
      title: 'Invalid or expired link',
      message: 'This unsubscribe link is no longer valid. If you continue to receive messages, reply to one and ask to be removed.',
      showResubscribe: false,
      token,
    }));
  }

  if (decoded.audience === 'buyer') {
    const sqlSet = mode === 'unsubscribe'
      ? 'UPDATE buyers SET unsubscribed_at = NOW() WHERE id = $1 AND unsubscribed_at IS NULL RETURNING id'
      : 'UPDATE buyers SET unsubscribed_at = NULL WHERE id = $1 AND unsubscribed_at IS NOT NULL RETURNING id';
    const r = await query(sqlSet, [decoded.id]);
    // Note: an unsubscribe applied to an already-unsubscribed row returns
    // 0 rows. That's still a successful outcome from the recipient's view
    // — show the success page in both cases.
    await logSecurityEvent(`unsubscribe_${mode}`, {
      audience: 'buyer',
      buyer_id: decoded.id,
      was_no_op: r.rows.length === 0,
    }, null, req);
    const title   = mode === 'unsubscribe' ? "You've been unsubscribed" : "You're resubscribed";
    const message = mode === 'unsubscribe'
      ? "We've removed you from this user's outreach list. You won't receive any more messages from them through AIWholesail."
      : "We've added you back to this user's outreach list. You may receive messages from them again.";
    return sendHtml(res, 200, renderPage({
      title,
      message,
      showResubscribe: mode === 'unsubscribe',
      token,
    }));
  }

  // 'lead' audience reserved for follow-up — gate when implemented.
  return sendHtml(res, 501, renderPage({
    title: 'Not yet supported',
    message: 'This unsubscribe link references a feature that is not yet enabled. Reply to the email you received to be removed.',
    showResubscribe: false,
    token,
  }));
}

router.get('/:token',  asyncHandler((req, res) => handle(req, res, 'unsubscribe')));
router.post('/:token', express.urlencoded({ extended: false }), asyncHandler((req, res) => handle(req, res, 'resubscribe')));

module.exports = router;
