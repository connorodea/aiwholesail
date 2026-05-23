import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMetaDescription } from '../software-review-meta.js';

const PROPSTREAM = {
  name: 'PropStream',
  rating: 3.5,
  pricing: '$99/month',
  bestFor: 'Data-heavy investors who need skip tracing and nationwide property data access',
  pros: ['1', '2', '3', '4', '5'],
  cons: ['1', '2', '3', '4', '5'],
};

const SHORT_NAME = {
  name: 'DealMachine',
  rating: 4.0,
  pricing: '$49/month',
  bestFor: 'Driving for dollars',
  pros: ['1', '2'],
  cons: ['1', '2'],
};

test('buildMetaDescription returns <= 160 chars for verbose reviews', () => {
  const desc = buildMetaDescription(PROPSTREAM, '2026-05-12');
  assert.ok(desc.length <= 160, `Description too long: ${desc.length} chars: "${desc}"`);
});

test('buildMetaDescription returns <= 160 chars for short reviews', () => {
  const desc = buildMetaDescription(SHORT_NAME, '2026-05-12');
  assert.ok(desc.length <= 160, `Description too long: ${desc.length} chars`);
});

test('buildMetaDescription includes name, rating, pricing, AIWholesail comparison, date', () => {
  const desc = buildMetaDescription(PROPSTREAM, '2026-05-12');
  assert.ok(desc.includes('PropStream'), 'missing product name');
  assert.ok(desc.includes('3.5'), 'missing rating');
  assert.ok(desc.includes('$99'), 'missing pricing');
  assert.ok(/AIWholesail/i.test(desc), 'missing AIWholesail comparison');
  assert.ok(desc.includes('2026-05-12'), 'missing last updated');
});

test('buildMetaDescription preserves bestFor context when there is room', () => {
  const desc = buildMetaDescription(SHORT_NAME, '2026-05-12');
  assert.ok(
    desc.toLowerCase().includes('driving for dollars'),
    'short reviews should include bestFor since there is room',
  );
});

test('buildMetaDescription truncates bestFor gracefully when no room', () => {
  const desc = buildMetaDescription(PROPSTREAM, '2026-05-12');
  // Should not end mid-word with no terminator
  assert.ok(
    !/[a-z]$/i.test(desc) || /[.!?]$/.test(desc),
    `Description should end on punctuation, not mid-word: "${desc}"`,
  );
});

test('buildMetaDescription handles rating as integer cleanly (no trailing zero)', () => {
  const desc = buildMetaDescription({ ...SHORT_NAME, rating: 4 }, '2026-05-12');
  assert.ok(desc.includes('4/5') || desc.includes('4 / 5'), `expected "4/5" not "4.0/5": "${desc}"`);
});
