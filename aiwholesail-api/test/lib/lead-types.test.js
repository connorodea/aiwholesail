/**
 * Unit tests for the lead-type registry — the substrate behind the
 * off-market multi-select search (PropStream parity, Phase 1).
 *
 * Mirrors tier-resolver.test.js. Runs under built-in node:test.
 *   $ npm test    (from aiwholesail-api/)
 *   $ node --test aiwholesail-api/test/lib/lead-types.test.js  (from repo root)
 *
 * The test surface is the JS module (the canonical predicate impl). The
 * frontend TS copy in src/lib/lead-types.ts must stay byte-equivalent in
 * predicate logic — if it drifts, fix the .ts file, not these tests.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LEAD_TYPES,
  applyLeadFilters,
  tagRecordWithLeadTypes,
  getServerParamsForLeads,
  getSearchPlanForLeads,
} = require('../../lib/lead-types');

// ─── Test fixtures ───────────────────────────────────────────────────────
//
// Each builder returns the minimum shape the predicate needs. Tests then
// override the relevant fields. Keeps positive/negative cases tight.

function absenteeRecord(overrides = {}) {
  return {
    parcel_id: 'P-ABS-1',
    flags: { is_absentee_owner: true },
    equity: {},
    ...overrides,
  };
}

function ownerOccupiedRecord(overrides = {}) {
  return {
    parcel_id: 'P-OO-1',
    flags: { is_absentee_owner: false },
    equity: {},
    ...overrides,
  };
}

test('LEAD_TYPES registry', async (t) => {
  await t.test('exports exactly 12 lead types', () => {
    assert.equal(LEAD_TYPES.length, 12);
  });

  await t.test('all slugs are unique and kebab-case', () => {
    const slugs = LEAD_TYPES.map((lt) => lt.slug);
    assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug');
    for (const slug of slugs) {
      assert.match(slug, /^[a-z][a-z0-9-]*$/, `slug "${slug}" is not kebab-case`);
    }
  });

  await t.test('every lead type has the required fields', () => {
    for (const lt of LEAD_TYPES) {
      assert.equal(typeof lt.slug, 'string', `${lt.slug} slug`);
      assert.equal(typeof lt.label, 'string', `${lt.slug} label`);
      assert.equal(typeof lt.description, 'string', `${lt.slug} description`);
      assert.ok(['free', 'pro', 'elite'].includes(lt.tier), `${lt.slug} tier`);
      assert.ok(['property', 'preforeclosure'].includes(lt.primarySource), `${lt.slug} source`);
      assert.equal(typeof lt.serverParams, 'object', `${lt.slug} serverParams`);
      assert.equal(typeof lt.clientFilter, 'function', `${lt.slug} clientFilter`);
      assert.equal(typeof lt.badgeColor, 'string', `${lt.slug} badgeColor`);
      assert.equal(typeof lt.icon, 'string', `${lt.slug} icon`);
    }
  });
});

// ─── Per-lead-type predicate coverage ────────────────────────────────────

test('clientFilter: absentee', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'absentee');
  await t.test('matches when is_absentee_owner=true', () => {
    assert.equal(lt.clientFilter(absenteeRecord()), true);
  });
  await t.test('does not match when is_absentee_owner=false', () => {
    assert.equal(lt.clientFilter(ownerOccupiedRecord()), false);
  });
  await t.test('does not match when flags missing', () => {
    assert.equal(lt.clientFilter({}), false);
  });
});

test('clientFilter: pre-foreclosure (passthrough)', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'pre-foreclosure');
  await t.test('matches any record (server-side mode)', () => {
    assert.equal(lt.clientFilter({}), true);
    assert.equal(lt.clientFilter(absenteeRecord()), true);
  });
});

test('clientFilter: auctions', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'auctions');
  await t.test('matches doc_type "Notice of Trustee Sale"', () => {
    assert.equal(lt.clientFilter({ doc_type: 'Notice of Trustee Sale' }), true);
  });
  await t.test('matches doc_type "Sheriff Sale" (case insensitive)', () => {
    assert.equal(lt.clientFilter({ doc_type: 'SHERIFF sale' }), true);
  });
  await t.test('does not match "Lis Pendens"', () => {
    assert.equal(lt.clientFilter({ doc_type: 'Lis Pendens' }), false);
  });
  await t.test('does not match when doc_type missing', () => {
    assert.equal(lt.clientFilter({}), false);
  });
});

test('clientFilter: tax-delinquent', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'tax-delinquent');
  await t.test('matches tax_status="delinquent"', () => {
    assert.equal(lt.clientFilter({ tax_status: 'delinquent' }), true);
  });
  await t.test('matches "past due" (space)', () => {
    assert.equal(lt.clientFilter({ tax_status: 'past due' }), true);
  });
  await t.test('matches "past_due" (underscore)', () => {
    assert.equal(lt.clientFilter({ tax_status: 'past_due' }), true);
  });
  await t.test('does not match "current"', () => {
    assert.equal(lt.clientFilter({ tax_status: 'current' }), false);
  });
  await t.test('does not match when tax_status missing', () => {
    assert.equal(lt.clientFilter({}), false);
  });
});

test('clientFilter: high-equity', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'high-equity');
  await t.test('matches at exactly 50% equity', () => {
    assert.equal(lt.clientFilter({ equity: { equity_pct: 50 } }), true);
  });
  await t.test('matches at $100k estimated equity even with low pct', () => {
    assert.equal(lt.clientFilter({ equity: { equity_pct: 10, estimated_equity: 100000 } }), true);
  });
  await t.test('does not match at 49% / $50k', () => {
    assert.equal(lt.clientFilter({ equity: { equity_pct: 49, estimated_equity: 50000 } }), false);
  });
  await t.test('does not match when equity missing', () => {
    assert.equal(lt.clientFilter({}), false);
  });
});

test('clientFilter: free-and-clear', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'free-and-clear');
  await t.test('matches est_loan_balance === 0', () => {
    assert.equal(lt.clientFilter({ equity: { est_loan_balance: 0 } }), true);
  });
  await t.test('matches equity_pct >= 100', () => {
    assert.equal(lt.clientFilter({ equity: { equity_pct: 100 } }), true);
  });
  await t.test('does not match when est_loan_balance > 0 and equity_pct < 100', () => {
    assert.equal(lt.clientFilter({ equity: { est_loan_balance: 50000, equity_pct: 80 } }), false);
  });
  await t.test('does not match when equity missing entirely', () => {
    assert.equal(lt.clientFilter({}), false);
  });
});

test('clientFilter: upside-down', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'upside-down');
  await t.test('matches negative equity_pct', () => {
    assert.equal(lt.clientFilter({ equity: { equity_pct: -5 } }), true);
  });
  await t.test('does not match zero equity (just barely positive)', () => {
    assert.equal(lt.clientFilter({ equity: { equity_pct: 0 } }), false);
  });
  await t.test('does not match positive equity', () => {
    assert.equal(lt.clientFilter({ equity: { equity_pct: 40 } }), false);
  });
  await t.test('does not match when equity missing (must not false-positive)', () => {
    assert.equal(lt.clientFilter({}), false);
  });
});

test('clientFilter: tired-landlord', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'tired-landlord');
  await t.test('matches absentee with 15+ years held', () => {
    assert.equal(
      lt.clientFilter(absenteeRecord({ equity: { years_held: 20 } })),
      true
    );
  });
  await t.test('matches at exactly 15 years', () => {
    assert.equal(
      lt.clientFilter(absenteeRecord({ equity: { years_held: 15 } })),
      true
    );
  });
  await t.test('does not match owner-occupied even with 30 years held', () => {
    assert.equal(
      lt.clientFilter(ownerOccupiedRecord({ equity: { years_held: 30 } })),
      false
    );
  });
  await t.test('does not match absentee with 10 years held', () => {
    assert.equal(
      lt.clientFilter(absenteeRecord({ equity: { years_held: 10 } })),
      false
    );
  });
});

test('clientFilter: senior-owner', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'senior-owner');
  await t.test('matches 25 years held', () => {
    assert.equal(lt.clientFilter({ equity: { years_held: 25 } }), true);
  });
  await t.test('matches 50 years held', () => {
    assert.equal(lt.clientFilter({ equity: { years_held: 50 } }), true);
  });
  await t.test('does not match 24 years held', () => {
    assert.equal(lt.clientFilter({ equity: { years_held: 24 } }), false);
  });
  await t.test('does not match when years_held missing', () => {
    assert.equal(lt.clientFilter({}), false);
  });
});

test('clientFilter: cash-buyer', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'cash-buyer');
  await t.test('matches absentee + free-and-clear + has last_sale_date', () => {
    assert.equal(
      lt.clientFilter(absenteeRecord({
        equity: { est_loan_balance: 0 },
        sale: { last_sale_date: '2024-03-15' },
      })),
      true
    );
  });
  await t.test('does not match without last_sale_date', () => {
    assert.equal(
      lt.clientFilter(absenteeRecord({
        equity: { est_loan_balance: 0 },
      })),
      false
    );
  });
  await t.test('does not match if owner-occupied even with rest', () => {
    assert.equal(
      lt.clientFilter(ownerOccupiedRecord({
        equity: { est_loan_balance: 0 },
        sale: { last_sale_date: '2024-03-15' },
      })),
      false
    );
  });
  await t.test('does not match if has loan balance', () => {
    assert.equal(
      lt.clientFilter(absenteeRecord({
        equity: { est_loan_balance: 50000 },
        sale: { last_sale_date: '2024-03-15' },
      })),
      false
    );
  });
});

test('clientFilter: vacant-land', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'vacant-land');
  await t.test('matches is_vacant_land=true', () => {
    assert.equal(lt.clientFilter({ flags: { is_vacant_land: true } }), true);
  });
  await t.test('does not match is_vacant_land=false', () => {
    assert.equal(lt.clientFilter({ flags: { is_vacant_land: false } }), false);
  });
  await t.test('does not match when flags missing', () => {
    assert.equal(lt.clientFilter({}), false);
  });
});

test('clientFilter: flippers', async (t) => {
  const lt = LEAD_TYPES.find((x) => x.slug === 'flippers');
  await t.test('matches years_held=1', () => {
    assert.equal(lt.clientFilter({ equity: { years_held: 1 } }), true);
  });
  await t.test('matches years_held=0 (just bought)', () => {
    assert.equal(lt.clientFilter({ equity: { years_held: 0 } }), true);
  });
  await t.test('does not match years_held=2', () => {
    assert.equal(lt.clientFilter({ equity: { years_held: 2 } }), false);
  });
  await t.test('does not match when years_held missing (defaults sky-high)', () => {
    assert.equal(lt.clientFilter({}), false);
  });
});

// ─── applyLeadFilters: OR-merge semantics ────────────────────────────────

test('applyLeadFilters', async (t) => {
  const dataset = [
    // 0 — vanilla absentee, no other signals
    absenteeRecord({ parcel_id: 'A' }),
    // 1 — owner-occupied with high equity
    ownerOccupiedRecord({ parcel_id: 'B', equity: { equity_pct: 75, estimated_equity: 200000 } }),
    // 2 — owner-occupied vacant land
    ownerOccupiedRecord({ parcel_id: 'C', flags: { is_vacant_land: true, is_absentee_owner: false } }),
    // 3 — no signals at all
    { parcel_id: 'D' },
    // 4 — tax delinquent owner-occupied
    ownerOccupiedRecord({ parcel_id: 'E', tax_status: 'delinquent' }),
  ];

  await t.test('empty selection returns empty array (explicit selection required)', () => {
    assert.deepEqual(applyLeadFilters(dataset, []), []);
  });

  await t.test('absentee alone returns only absentees', () => {
    const out = applyLeadFilters(dataset, ['absentee']);
    assert.deepEqual(out.map((r) => r.parcel_id), ['A']);
  });

  await t.test('high-equity alone returns only high-equity records', () => {
    const out = applyLeadFilters(dataset, ['high-equity']);
    assert.deepEqual(out.map((r) => r.parcel_id), ['B']);
  });

  await t.test('absentee OR high-equity OR vacant-land returns union', () => {
    const out = applyLeadFilters(dataset, ['absentee', 'high-equity', 'vacant-land']);
    assert.deepEqual(out.map((r) => r.parcel_id).sort(), ['A', 'B', 'C']);
  });

  await t.test('absentee OR tax-delinquent returns union', () => {
    const out = applyLeadFilters(dataset, ['absentee', 'tax-delinquent']);
    assert.deepEqual(out.map((r) => r.parcel_id).sort(), ['A', 'E']);
  });

  await t.test('unknown slug is silently dropped, valid ones still apply', () => {
    const out = applyLeadFilters(dataset, ['absentee', 'totally-fake-slug']);
    assert.deepEqual(out.map((r) => r.parcel_id), ['A']);
  });

  await t.test('all unknown slugs returns empty array', () => {
    assert.deepEqual(applyLeadFilters(dataset, ['fake-1', 'fake-2']), []);
  });

  await t.test('non-array records returns empty array', () => {
    assert.deepEqual(applyLeadFilters(null, ['absentee']), []);
    assert.deepEqual(applyLeadFilters(undefined, ['absentee']), []);
  });

  await t.test('tolerates malformed record without throwing', () => {
    // Predicate access patterns use optional chaining, so a primitive
    // record shouldn't blow up the whole filter run.
    const out = applyLeadFilters([null, absenteeRecord({ parcel_id: 'OK' })], ['absentee']);
    assert.deepEqual(out.map((r) => r.parcel_id), ['OK']);
  });
});

// ─── tagRecordWithLeadTypes ──────────────────────────────────────────────

test('tagRecordWithLeadTypes', async (t) => {
  await t.test('records carry their matched slugs', () => {
    const records = [
      absenteeRecord({
        parcel_id: 'CASH',
        equity: { est_loan_balance: 0, equity_pct: 100, years_held: 30 },
        sale: { last_sale_date: '2023-01-01' },
      }),
      ownerOccupiedRecord({
        parcel_id: 'NONE',
      }),
    ];
    const out = tagRecordWithLeadTypes(records);
    const cash = out.find((r) => r.parcel_id === 'CASH');
    const none = out.find((r) => r.parcel_id === 'NONE');
    // The cash-buyer record hits absentee, free-and-clear, high-equity,
    // tired-landlord, senior-owner, cash-buyer.
    assert.ok(cash.matchedLeadTypes.includes('absentee'));
    assert.ok(cash.matchedLeadTypes.includes('free-and-clear'));
    assert.ok(cash.matchedLeadTypes.includes('high-equity'));
    assert.ok(cash.matchedLeadTypes.includes('tired-landlord'));
    assert.ok(cash.matchedLeadTypes.includes('senior-owner'));
    assert.ok(cash.matchedLeadTypes.includes('cash-buyer'));
    // pre-foreclosure is always skipped during tagging (passthrough
    // predicate would false-positive every record).
    assert.ok(!cash.matchedLeadTypes.includes('pre-foreclosure'));
    // The no-signal record should match nothing.
    assert.deepEqual(none.matchedLeadTypes, []);
  });

  await t.test('preserves original record fields', () => {
    const out = tagRecordWithLeadTypes([absenteeRecord({ parcel_id: 'X', state: 'CA' })]);
    assert.equal(out[0].parcel_id, 'X');
    assert.equal(out[0].state, 'CA');
    assert.ok(Array.isArray(out[0].matchedLeadTypes));
  });

  await t.test('non-array input returns empty array', () => {
    assert.deepEqual(tagRecordWithLeadTypes(null), []);
    assert.deepEqual(tagRecordWithLeadTypes(undefined), []);
  });

  await t.test('vacant-land record only matches vacant-land', () => {
    const out = tagRecordWithLeadTypes([{ parcel_id: 'V', flags: { is_vacant_land: true } }]);
    assert.deepEqual(out[0].matchedLeadTypes, ['vacant-land']);
  });
});

// ─── getServerParamsForLeads ─────────────────────────────────────────────

test('getServerParamsForLeads', async (t) => {
  await t.test('empty selection → property source, no params', () => {
    assert.deepEqual(getServerParamsForLeads([]), { primarySource: 'property' });
  });

  await t.test('absentee → property + absentee_only:true', () => {
    assert.deepEqual(getServerParamsForLeads(['absentee']), {
      primarySource: 'property',
      absentee_only: true,
    });
  });

  await t.test('high-equity alone → property, no extra params', () => {
    assert.deepEqual(getServerParamsForLeads(['high-equity']), {
      primarySource: 'property',
    });
  });

  await t.test('pre-foreclosure → preforeclosure source (no absentee_only)', () => {
    const out = getServerParamsForLeads(['pre-foreclosure']);
    assert.equal(out.primarySource, 'preforeclosure');
    assert.equal(out.absentee_only, undefined);
  });

  await t.test('auctions → preforeclosure source', () => {
    assert.equal(getServerParamsForLeads(['auctions']).primarySource, 'preforeclosure');
  });

  await t.test('mixing preforeclosure + property source → preforeclosure wins, drops property params', () => {
    // absentee on its own would set absentee_only:true, but with
    // pre-foreclosure in the mix the whole query goes against the
    // preforeclosure feed and property params are dropped.
    const out = getServerParamsForLeads(['absentee', 'pre-foreclosure']);
    assert.equal(out.primarySource, 'preforeclosure');
    assert.equal(out.absentee_only, undefined);
  });

  await t.test('multiple absentee-flag chips collapse to one absentee_only:true', () => {
    const out = getServerParamsForLeads(['absentee', 'tired-landlord', 'cash-buyer']);
    assert.deepEqual(out, { primarySource: 'property', absentee_only: true });
  });

  await t.test('unknown slug is silently dropped', () => {
    assert.deepEqual(getServerParamsForLeads(['fake-slug']), { primarySource: 'property' });
  });

  await t.test('non-array input → property source default', () => {
    assert.deepEqual(getServerParamsForLeads(null), { primarySource: 'property' });
    assert.deepEqual(getServerParamsForLeads(undefined), { primarySource: 'property' });
  });
});

// ─── getSearchPlanForLeads ───────────────────────────────────────────────
// Regression coverage for the dual-feed routing bug surfaced 2026-05-13:
// selecting any preforeclosure-source lead would collapse the entire
// search to the preforeclosure feed and silently drop all property-source
// leads (absentee, tax-delinquent, high-equity, etc.). The new planner
// returns both feed plans independently so callers can fan out per ZIP.

test('getSearchPlanForLeads', async (t) => {
  await t.test('empty input → property-only default', () => {
    assert.deepEqual(getSearchPlanForLeads([]), { property: {}, preforeclosure: null });
    assert.deepEqual(getSearchPlanForLeads(null), { property: {}, preforeclosure: null });
    assert.deepEqual(getSearchPlanForLeads(undefined), { property: {}, preforeclosure: null });
  });

  await t.test('absentee alone → property only with absentee_only:true', () => {
    const plan = getSearchPlanForLeads(['absentee']);
    assert.deepEqual(plan.property, { absentee_only: true });
    assert.equal(plan.preforeclosure, null);
  });

  await t.test('pre-foreclosure alone → preforeclosure only, no property', () => {
    const plan = getSearchPlanForLeads(['pre-foreclosure']);
    assert.equal(plan.property, null);
    assert.deepEqual(plan.preforeclosure, {});
  });

  await t.test('mixed selection → BOTH feeds populated (the bug fix)', () => {
    // This is the regression case: previously the whole query collapsed
    // to preforeclosure-only and the 10 property-feed leads were dropped.
    const plan = getSearchPlanForLeads(['absentee', 'pre-foreclosure']);
    assert.deepEqual(plan.property, { absentee_only: true });
    assert.deepEqual(plan.preforeclosure, {});
  });

  await t.test('all 12 lead types → BOTH feeds populated', () => {
    // The actual user-reported scenario from 2026-05-13: user selected
    // all 12 lead types on FL; old code routed all 25 ZIPs to
    // preforeclosure-only and got ~zero results.
    const allSlugs = LEAD_TYPES.map((lt) => lt.slug);
    const plan = getSearchPlanForLeads(allSlugs);
    assert.ok(plan.property !== null, 'property feed must be planned');
    assert.ok(plan.preforeclosure !== null, 'preforeclosure feed must be planned');
    // At least one property-feed lead carries absentee_only:true so the
    // merged plan keeps that signal.
    assert.equal(plan.property.absentee_only, true);
  });

  await t.test('multiple absentee-flag chips merge to one absentee_only:true', () => {
    const plan = getSearchPlanForLeads(['absentee', 'tired-landlord', 'cash-buyer']);
    assert.deepEqual(plan.property, { absentee_only: true });
    assert.equal(plan.preforeclosure, null);
  });

  await t.test('unknown slug is silently dropped', () => {
    const plan = getSearchPlanForLeads(['fake-slug']);
    // No valid leads → no property plan, no preforeclosure plan.
    // Callers fall back to a safe single property call themselves.
    assert.equal(plan.property, null);
    assert.equal(plan.preforeclosure, null);
  });
});
