/**
 * Unit tests for lib/template-render.js — renderTemplate(template, vars).
 *
 * Substitutes {key} tokens. Unknown placeholders, and placeholders whose
 * value is null/undefined, are intentionally LEFT AS-IS so they surface in
 * send logs rather than silently turning into empty strings — that's a
 * stated contract from the worker.
 *
 * Extracted from scripts/sequence-execution-worker.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderTemplate } = require('../../lib/template-render');

test('renderTemplate', async (t) => {
  await t.test('single {key} substitution', () => {
    assert.equal(renderTemplate('Hi {name}', { name: 'Alex' }), 'Hi Alex');
  });

  await t.test('multiple {key} substitutions', () => {
    assert.equal(
      renderTemplate('Hi {first}, your offer on {address} is ready', {
        first: 'Alex',
        address: '123 Main St',
      }),
      'Hi Alex, your offer on 123 Main St is ready'
    );
  });

  await t.test('unknown placeholder is left as-is', () => {
    // The worker comment is explicit: "Unmatched placeholders are left as-is
    // so we can spot them in send logs rather than silently sending empty
    // strings."
    assert.equal(
      renderTemplate('Hi {first}, your {wat} is ready', { first: 'Alex' }),
      'Hi Alex, your {wat} is ready'
    );
  });

  await t.test('numeric values are stringified', () => {
    assert.equal(
      renderTemplate('You have {count} offers', { count: 7 }),
      'You have 7 offers'
    );
    assert.equal(
      renderTemplate('Price: {amount}', { amount: 0 }),
      'Price: 0'  // 0 is NOT null/undefined → must substitute, not skip.
    );
  });

  await t.test('boolean values are stringified', () => {
    assert.equal(renderTemplate('cash={cash}', { cash: true }), 'cash=true');
    assert.equal(renderTemplate('cash={cash}', { cash: false }), 'cash=false');
  });

  await t.test('null value → placeholder left as-is', () => {
    assert.equal(
      renderTemplate('Hi {first}', { first: null }),
      'Hi {first}'
    );
  });

  await t.test('undefined value → placeholder left as-is', () => {
    assert.equal(
      renderTemplate('Hi {first}', { first: undefined }),
      'Hi {first}'
    );
  });

  await t.test('empty template → empty string', () => {
    assert.equal(renderTemplate('', { name: 'Alex' }), '');
  });

  await t.test('null template → empty string', () => {
    assert.equal(renderTemplate(null, { name: 'Alex' }), '');
  });

  await t.test('undefined template → empty string', () => {
    assert.equal(renderTemplate(undefined, { name: 'Alex' }), '');
  });

  await t.test('template with no placeholders → returned verbatim', () => {
    assert.equal(
      renderTemplate('Hello, world!', { name: 'Alex' }),
      'Hello, world!'
    );
  });

  await t.test('adjacent placeholders {a}{b} → both substituted', () => {
    assert.equal(
      renderTemplate('{a}{b}', { a: 'foo', b: 'bar' }),
      'foobar'
    );
  });

  await t.test('repeated placeholder substitutes every occurrence', () => {
    assert.equal(
      renderTemplate('{name} and {name} again', { name: 'Alex' }),
      'Alex and Alex again'
    );
  });

  await t.test('placeholder with digits + underscores in key', () => {
    assert.equal(
      renderTemplate('{first_name_1}', { first_name_1: 'Alex' }),
      'Alex'
    );
  });

  await t.test('keys with hyphens or punctuation are NOT recognized as placeholders', () => {
    // The regex is [a-zA-Z0-9_] — hyphen breaks the match, so the whole
    // {x-y} is left verbatim.
    assert.equal(
      renderTemplate('{first-name}', { 'first-name': 'Alex' }),
      '{first-name}'
    );
  });

  await t.test('empty vars object — all placeholders pass through', () => {
    assert.equal(
      renderTemplate('Hi {first} on {address}', {}),
      'Hi {first} on {address}'
    );
  });
});
