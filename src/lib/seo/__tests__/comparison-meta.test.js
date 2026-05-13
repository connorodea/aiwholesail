import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComparisonTitle, buildComparisonDescription } from '../comparison-meta.js';

const PROPSTREAM = {
  name: 'PropStream',
  pricing: '$99/month',
  tagline: 'property-data warehouse for serious investors',
  summary:
    'PropStream is a property-data warehouse at ~$99/month best for experienced list-pullers who already do their own deal analysis. AIWholesail starts at $49/month and layers AI deal scoring on top.',
};

const DEALMACHINE = {
  name: 'DealMachine',
  pricing: '$83/month',
  tagline: 'driving-for-dollars + lead-gen',
  summary:
    'DealMachine is the best-in-class driving-for-dollars tool. AIWholesail covers the screen-based half of the wholesaler workflow.',
};

const MINIMAL = {
  name: 'Privy',
  pricing: '$97/month',
  tagline: 'MLS-based deal alerts',
  summary: '',
};

test('buildComparisonTitle is <= 60 chars for typical competitor names', () => {
  for (const c of [PROPSTREAM, DEALMACHINE, MINIMAL]) {
    const t = buildComparisonTitle(c, '2026-05-12');
    assert.ok(t.length <= 60, `${c.name}: title ${t.length} chars: "${t}"`);
  }
});

test('buildComparisonTitle uses the year, not a full ISO date', () => {
  const t = buildComparisonTitle(PROPSTREAM, '2026-05-12');
  assert.ok(t.includes('2026'), 'should include year');
  assert.ok(!t.includes('2026-05'), `should NOT include full date, got: "${t}"`);
  assert.ok(!t.includes('05-12'), `should NOT include month-day, got: "${t}"`);
});

test('buildComparisonTitle uses an em-dash, not double-hyphen', () => {
  const t = buildComparisonTitle(PROPSTREAM, '2026-05-12');
  assert.ok(!t.includes('--'), `title should not contain "--": "${t}"`);
});

test('buildComparisonTitle mentions both AIWholesail and the competitor name', () => {
  const t = buildComparisonTitle(PROPSTREAM, '2026-05-12');
  assert.ok(/AIWholesail/.test(t));
  assert.ok(t.includes('PropStream'));
});

test('buildComparisonDescription is <= 160 chars for long summaries', () => {
  const d = buildComparisonDescription(PROPSTREAM, '2026-05-12');
  assert.ok(d.length <= 160, `desc ${d.length} chars: "${d}"`);
});

test('buildComparisonDescription is <= 160 chars for medium summaries', () => {
  const d = buildComparisonDescription(DEALMACHINE, '2026-05-12');
  assert.ok(d.length <= 160, `desc ${d.length} chars: "${d}"`);
});

test('buildComparisonDescription falls back gracefully when summary is empty', () => {
  const d = buildComparisonDescription(MINIMAL, '2026-05-12');
  assert.ok(d.length > 0, 'empty fallback');
  assert.ok(d.length <= 160, `fallback desc ${d.length} chars`);
  assert.ok(d.includes('Privy'), 'should mention competitor');
  assert.ok(/AIWholesail/.test(d), 'should mention AIWholesail');
});

test('buildComparisonDescription does not end mid-word for truncated summaries', () => {
  const d = buildComparisonDescription(PROPSTREAM, '2026-05-12');
  // Should end on punctuation OR full-stop, not a bare letter
  assert.ok(/[.!?]$/.test(d), `description should end on punctuation: "${d}"`);
});

test('buildComparisonDescription mentions AIWholesail and the competitor', () => {
  const d = buildComparisonDescription(DEALMACHINE, '2026-05-12');
  assert.ok(/AIWholesail/.test(d));
  assert.ok(d.includes('DealMachine'));
});
