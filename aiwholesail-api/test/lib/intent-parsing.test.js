/**
 * Unit tests for lib/reply-intent.js — classifyReplyIntent().
 *
 * This is the regex layer that turns the body of an inbound email reply
 * into one of: 'bounce_message' | 'unsubscribe' | 'not_interested' |
 * 'interested' | 'unknown'.
 *
 * Extracted from routes/resend-webhooks.js so it's testable without
 * Express + Postgres.
 *
 * Bounce indicators take PRECEDENCE over all other categories — if the
 * body mentions "delivery status notification", it doesn't matter that it
 * also contains "stop" or "interested" further down (those usually come
 * from the quoted original message).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyReplyIntent } = require('../../lib/reply-intent');

test('classifyReplyIntent — unsubscribe', async (t) => {
  const unsubscribeBodies = [
    'stop',
    'STOP',
    'unsubscribe',
    'remove me',
    'remove me from your list',
    'opt out',
    'opt-out',
    'do not contact me',
    'Please stop emailing me.',
    'UNSUBSCRIBE NOW',
  ];
  for (const body of unsubscribeBodies) {
    await t.test(`"${body}" → unsubscribe`, () => {
      assert.equal(classifyReplyIntent(body), 'unsubscribe');
    });
  }
});

test('classifyReplyIntent — not_interested', async (t) => {
  const bodies = [
    'no thanks',
    'No thanks!',
    'not interested',
    'I am not interested at this time',
    'wrong number',
    'wrong person',
    'You have the wrong number, sorry.',
  ];
  for (const body of bodies) {
    await t.test(`"${body}" → not_interested`, () => {
      assert.equal(classifyReplyIntent(body), 'not_interested');
    });
  }
});

test('classifyReplyIntent — interested', async (t) => {
  const bodies = [
    "yes I'm interested",
    "let's talk",
    "Lets talk tomorrow",
    'call me',
    'how much are you offering',
    'tell me more',
    "I'm in",
    'Yes, please send details.',
    'How much would you pay cash?',
  ];
  for (const body of bodies) {
    await t.test(`"${body}" → interested`, () => {
      assert.equal(classifyReplyIntent(body), 'interested');
    });
  }
});

test('classifyReplyIntent — bounce_message (regardless of other keywords)', async (t) => {
  const bodies = [
    'mailer-daemon@example.com',
    'Delivery Status Notification (Failure)',
    'address not found',
    'recipient address rejected by mail system',
    'Your message was undeliverable.',
    'Message could not be delivered',
    'Delivery has failed to these recipients',
    '550 5.1.1 user unknown',
  ];
  for (const body of bodies) {
    await t.test(`"${body.slice(0, 40)}..." → bounce_message`, () => {
      assert.equal(classifyReplyIntent(body), 'bounce_message');
    });
  }
});

test('classifyReplyIntent — unknown', async (t) => {
  await t.test('empty string → unknown', () => {
    assert.equal(classifyReplyIntent(''), 'unknown');
  });

  await t.test('null → unknown', () => {
    assert.equal(classifyReplyIntent(null), 'unknown');
  });

  await t.test('undefined → unknown', () => {
    assert.equal(classifyReplyIntent(undefined), 'unknown');
  });

  await t.test('gibberish → unknown', () => {
    assert.equal(classifyReplyIntent('asdfqwerty zxcvb'), 'unknown');
  });

  await t.test('generic "thanks" → unknown (no actionable signal)', () => {
    // "thanks" alone is a courtesy reply, not a buy/sell signal. It does
    // NOT contain "no thanks" so should fall through to unknown.
    assert.equal(classifyReplyIntent('Thanks!'), 'unknown');
  });

  await t.test('subject-line-only ping → unknown', () => {
    assert.equal(classifyReplyIntent('Re:'), 'unknown');
  });
});

test('classifyReplyIntent — precedence', async (t) => {
  await t.test('bounce wins over unsubscribe ("stop" + "delivery status notification")', () => {
    const body = 'Delivery Status Notification\n--- quoted ---\nPlease stop sending';
    assert.equal(classifyReplyIntent(body), 'bounce_message');
  });

  await t.test('bounce wins over interested', () => {
    const body = "mailer-daemon@example.com\n\n--- original ---\nyes I'm interested";
    assert.equal(classifyReplyIntent(body), 'bounce_message');
  });

  await t.test('unsubscribe wins over interested in same body (unsubscribe checked first)', () => {
    // "stop" trips UNSUBSCRIBE; "interested" trips INTERESTED. Implementation
    // checks unsubscribe first.
    const body = 'stop emailing me but yes I am interested in nothing';
    assert.equal(classifyReplyIntent(body), 'unsubscribe');
  });

  await t.test('not_interested wins over interested when both present (not_interested checked first)', () => {
    const body = 'not interested in your interested offer';
    assert.equal(classifyReplyIntent(body), 'not_interested');
  });
});

test('classifyReplyIntent — case-insensitivity', async (t) => {
  await t.test('UPPER-CASE unsubscribe', () => {
    assert.equal(classifyReplyIntent('UNSUBSCRIBE PLEASE'), 'unsubscribe');
  });

  await t.test('Mixed-case not_interested', () => {
    assert.equal(classifyReplyIntent('NOT Interested'), 'not_interested');
  });

  await t.test('Mixed-case interested', () => {
    assert.equal(classifyReplyIntent('CALL ME tomorrow'), 'interested');
  });

  await t.test('Mixed-case bounce', () => {
    assert.equal(classifyReplyIntent('MAILER-DAEMON failure'), 'bounce_message');
  });
});

test('classifyReplyIntent — optional from/headers arguments', async (t) => {
  // The function accepts (bodyText, fromAddress?, headers?) — extra args
  // are reserved for future heuristics but must not break the body path today.
  await t.test('extra args are ignored gracefully', () => {
    assert.equal(
      classifyReplyIntent('stop', 'mailer-daemon@example.com', [{ name: 'From', value: 'x' }]),
      'unsubscribe'
    );
  });
});
