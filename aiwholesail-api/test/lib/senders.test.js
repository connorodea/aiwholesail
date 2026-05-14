/**
 * Unit tests for lib/senders.js — verified Resend FROM addresses and
 * outreach Reply-To routing.
 *
 * These addresses are part of the deliverability contract (Phase 1):
 *   - transactional/security/contact go on notifications.aiwholesail.com
 *     so password resets + receipts are insulated from outreach reputation.
 *   - outreach goes on send.aiwholesail.com.
 *   - Outreach replies route into reply.aiwholesail.com via Reply-To so
 *     the inbound webhook can parse intents.
 *
 * If a sender FROM address changes, fix the constant in lib/senders.js, NOT
 * the test — these strings ship on every email and must match what Resend
 * has verified.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { getSender, getReplyTo, SENDERS } = require('../../lib/senders');

test('getSender', async (t) => {
  await t.test('transactional → noreply@notifications.aiwholesail.com', () => {
    const s = getSender('transactional');
    assert.match(s, /noreply@notifications\.aiwholesail\.com/);
  });

  await t.test('outreach → outreach@send.aiwholesail.com', () => {
    const s = getSender('outreach');
    assert.match(s, /outreach@send\.aiwholesail\.com/);
  });

  await t.test('security → security FROM on notifications subdomain', () => {
    const s = getSender('security');
    assert.match(s, /noreply@notifications\.aiwholesail\.com/);
    assert.match(s, /Security/);
  });

  await t.test('contact → contact FROM on notifications subdomain', () => {
    const s = getSender('contact');
    assert.match(s, /noreply@notifications\.aiwholesail\.com/);
    assert.match(s, /Contact/);
  });

  await t.test('returns the exact verified strings (full snapshot)', () => {
    // Pinning the full strings so an accidental rename is caught here
    // rather than at deliver time.
    assert.equal(getSender('transactional'), 'AIWholesail <noreply@notifications.aiwholesail.com>');
    assert.equal(getSender('security'),      'AIWholesail Security <noreply@notifications.aiwholesail.com>');
    assert.equal(getSender('contact'),       'AIWholesail Contact <noreply@notifications.aiwholesail.com>');
    assert.equal(getSender('outreach'),      'AIWholesail <outreach@send.aiwholesail.com>');
  });

  await t.test('unknown category throws', () => {
    assert.throws(() => getSender('unknown'), /Unknown sender type/);
    assert.throws(() => getSender(''),        /Unknown sender type/);
    assert.throws(() => getSender(undefined), /Unknown sender type/);
    assert.throws(() => getSender(null),      /Unknown sender type/);
  });

  await t.test('SENDERS map is exported for callers that need the raw table', () => {
    assert.equal(typeof SENDERS, 'object');
    assert.ok(SENDERS.outreach.includes('send.aiwholesail.com'));
  });
});

test('getReplyTo', async (t) => {
  await t.test('outreach → reply@reply.aiwholesail.com', () => {
    assert.equal(getReplyTo('outreach'), 'reply@reply.aiwholesail.com');
  });

  await t.test('transactional → null (FROM is reply destination)', () => {
    assert.equal(getReplyTo('transactional'), null);
  });

  await t.test('security → null', () => {
    assert.equal(getReplyTo('security'), null);
  });

  await t.test('contact → null', () => {
    assert.equal(getReplyTo('contact'), null);
  });

  await t.test('unknown category → null (does NOT throw — getReplyTo is best-effort)', () => {
    assert.equal(getReplyTo('unknown'), null);
    assert.equal(getReplyTo(''), null);
    assert.equal(getReplyTo(undefined), null);
    assert.equal(getReplyTo(null), null);
  });
});
