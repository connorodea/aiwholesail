/**
 * Unit tests for lib/build-variables.js — buildVariables(row).
 *
 * The merge contract (Phase 2.5):
 *   auto-derived  <  sequence_variables  <  campaign_variables
 *
 * `your_name` gets a special resolution because it's set on the AUTO layer
 *   first (as a fallback). Net of the spread:
 *     campaign_variables.your_name  →  sequence_variables.your_name  →  ''
 *
 * Missing first/last name on the row falls back to 'there' for seller_name
 * and first_name so emails don't ship a naked "Hi ,".
 *
 * Extracted from scripts/sequence-execution-worker.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVariables } = require('../../lib/build-variables');

test('buildVariables', async (t) => {
  await t.test('row with only auto-derived fields → returns auto-derived', () => {
    const vars = buildVariables({
      lead_first_name: 'Alex',
      lead_last_name: 'Smith',
      property_address: '123 Main St',
    });
    assert.equal(vars.seller_name, 'Alex Smith');
    assert.equal(vars.first_name, 'Alex');
    assert.equal(vars.lead_name, 'Alex Smith');
    assert.equal(vars.property_address, '123 Main St');
    assert.equal(vars.your_name, '');
  });

  await t.test('sequence_variables override auto-derived', () => {
    const vars = buildVariables({
      lead_first_name: 'Alex',
      sequence_variables: { first_name: 'OverrideFirst', custom: 'seq-only' },
    });
    assert.equal(vars.first_name, 'OverrideFirst', 'sequence wins over auto');
    assert.equal(vars.custom, 'seq-only');
  });

  await t.test('campaign_variables override sequence_variables', () => {
    const vars = buildVariables({
      lead_first_name: 'Alex',
      sequence_variables: { first_name: 'SeqFirst', tag: 'from-seq' },
      campaign_variables: { first_name: 'CampFirst', tag: 'from-campaign' },
    });
    assert.equal(vars.first_name, 'CampFirst', 'campaign wins over sequence');
    assert.equal(vars.tag, 'from-campaign');
  });

  await t.test('campaign wins when both sequence + campaign supply the same key', () => {
    const vars = buildVariables({
      lead_first_name: 'Alex',
      sequence_variables: { property_address: 'seq-addr' },
      campaign_variables: { property_address: 'campaign-addr' },
    });
    assert.equal(vars.property_address, 'campaign-addr');
  });

  await t.test('your_name resolution — campaign wins over sequence', () => {
    const vars = buildVariables({
      sequence_variables: { your_name: 'SeqName' },
      campaign_variables: { your_name: 'CampName' },
    });
    assert.equal(vars.your_name, 'CampName');
  });

  await t.test('your_name resolution — sequence wins over auto-empty when no campaign value', () => {
    const vars = buildVariables({
      sequence_variables: { your_name: 'SeqName' },
    });
    assert.equal(vars.your_name, 'SeqName');
  });

  await t.test('your_name resolution — campaign-only sets your_name', () => {
    const vars = buildVariables({
      campaign_variables: { your_name: 'CampName' },
    });
    assert.equal(vars.your_name, 'CampName');
  });

  await t.test('your_name resolution — fallback to empty string when neither source has it', () => {
    const vars = buildVariables({
      lead_first_name: 'Alex',
      sequence_variables: { tag: 'x' },
      campaign_variables: { tag: 'y' },
    });
    assert.equal(vars.your_name, '');
  });

  await t.test('missing first_name → seller_name + first_name fall back to "there"', () => {
    const vars = buildVariables({
      lead_first_name: '',
      lead_last_name: '',
    });
    assert.equal(vars.seller_name, 'there');
    assert.equal(vars.first_name, 'there');
    assert.equal(vars.lead_name, '', 'lead_name stays empty — no fallback here');
  });

  await t.test('completely empty + missing lead_first_name → "there"', () => {
    const vars = buildVariables({});
    assert.equal(vars.seller_name, 'there');
    assert.equal(vars.first_name, 'there');
    assert.equal(vars.lead_name, '');
    assert.equal(vars.property_address, '');
  });

  await t.test('first_name only (no last_name) → seller_name uses first_name', () => {
    const vars = buildVariables({ lead_first_name: 'Alex' });
    assert.equal(vars.first_name, 'Alex');
    assert.equal(vars.seller_name, 'Alex');
    assert.equal(vars.lead_name, 'Alex');
  });

  await t.test('non-object sequence_variables is treated as empty', () => {
    // Sequence vars are read from a JSONB column → could be a string or null
    // depending on the row. Anything non-object falls through to {}.
    const vars = buildVariables({
      lead_first_name: 'Alex',
      sequence_variables: 'not-an-object',
      campaign_variables: null,
    });
    assert.equal(vars.first_name, 'Alex'); // No override → auto wins.
  });

  await t.test('null row is handled defensively', () => {
    // Worker callers go through a pg row so this won't be null in practice,
    // but the helper should not blow up if a unit test feeds it one.
    const vars = buildVariables(null);
    assert.equal(vars.first_name, 'there');
    assert.equal(vars.seller_name, 'there');
    assert.equal(vars.lead_name, '');
    assert.equal(vars.property_address, '');
    assert.equal(vars.your_name, '');
  });

  await t.test('campaign_variables can introduce keys not present elsewhere', () => {
    const vars = buildVariables({
      lead_first_name: 'Alex',
      campaign_variables: { custom_campaign_field: 'XYZ' },
    });
    assert.equal(vars.custom_campaign_field, 'XYZ');
  });
});
