/**
 * Unit tests for filterAbsenteeOwners — backend-side workaround for
 * PropData's broken `absentee_only=true` filter (live-confirmed broken
 * 2026-05-14, vendor side).
 *
 * The proxy stops forwarding `absentee_only` upstream (where it returns
 * empty) and instead post-filters the bulk response using fields PropData
 * still returns correctly:
 *   - flags.is_absentee_owner === true, OR
 *   - owner.mailing_zip differs from address.zip (geographic absentee), OR
 *   - any owner.mailing_state differs from property state.
 *
 * Run:
 *   $ npm test
 *   $ node --test test/lib/propdata-absentee-filter.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Module under test does not exist yet — RED.
const {
  filterAbsenteeOwners,
  applyAbsenteeFilterToBody,
} = require('../../lib/propdata-absentee-filter');

const _ownerOccupied = {
  parcel_id: 'OO-1',
  address: { street: '100 Main St', city: 'Chicago', zip: '60601' },
  state: 'IL',
  owner: { name: 'JOHN DOE', mailing_address: '100 Main St', mailing_zip: '60601', mailing_state: 'IL' },
  flags: { is_absentee_owner: false },
};

const _absenteeByFlag = {
  parcel_id: 'ABS-FLAG-1',
  address: { street: '200 Elm St', city: 'Chicago', zip: '60601' },
  state: 'IL',
  owner: { name: 'JANE LANDLORD', mailing_address: '500 5th Ave', mailing_zip: '10018', mailing_state: 'NY' },
  flags: { is_absentee_owner: true },
};

const _absenteeByZipMismatch = {
  parcel_id: 'ABS-ZIP-1',
  address: { street: '300 Oak St', city: 'Chicago', zip: '60601' },
  state: 'IL',
  owner: { name: 'BOB INVESTOR', mailing_address: '900 Pine Ave', mailing_zip: '60611', mailing_state: 'IL' },
  flags: { /* no is_absentee_owner flag */ },
};

const _absenteeByStateMismatch = {
  parcel_id: 'ABS-ST-1',
  address: { street: '400 Pine St', city: 'Chicago', zip: '60601' },
  state: 'IL',
  owner: { name: 'OUT-OF-STATE LLC', mailing_zip: '60601', mailing_state: 'CA' },
  flags: {},
};

const _missingOwner = {
  parcel_id: 'NO-OWNER-1',
  address: { street: '500 Birch St', zip: '60601' },
  state: 'IL',
  /* no owner block */
  flags: {},
};

test('filterAbsenteeOwners', async (t) => {
  await t.test('keeps a property whose flags.is_absentee_owner is true', () => {
    const out = filterAbsenteeOwners([_absenteeByFlag]);
    assert.equal(out.length, 1);
    assert.equal(out[0].parcel_id, 'ABS-FLAG-1');
  });

  await t.test('drops owner-occupied property (same mailing addr)', () => {
    const out = filterAbsenteeOwners([_ownerOccupied]);
    assert.deepEqual(out, []);
  });

  await t.test('keeps property where mailing_zip differs from address.zip', () => {
    const out = filterAbsenteeOwners([_absenteeByZipMismatch]);
    assert.equal(out.length, 1);
    assert.equal(out[0].parcel_id, 'ABS-ZIP-1');
  });

  await t.test('keeps property where mailing_state differs from property state', () => {
    const out = filterAbsenteeOwners([_absenteeByStateMismatch]);
    assert.equal(out.length, 1);
    assert.equal(out[0].parcel_id, 'ABS-ST-1');
  });

  await t.test('drops record with no owner info (cannot determine absentee)', () => {
    const out = filterAbsenteeOwners([_missingOwner]);
    assert.deepEqual(out, []);
  });

  await t.test('mixed input — only absentee survive, original order preserved', () => {
    const input = [
      _ownerOccupied,
      _absenteeByFlag,
      _missingOwner,
      _absenteeByZipMismatch,
      _absenteeByStateMismatch,
    ];
    const out = filterAbsenteeOwners(input);
    assert.deepEqual(
      out.map((p) => p.parcel_id),
      ['ABS-FLAG-1', 'ABS-ZIP-1', 'ABS-ST-1']
    );
  });

  await t.test('empty input → empty output', () => {
    assert.deepEqual(filterAbsenteeOwners([]), []);
  });

  await t.test('non-array input → throws (defensive)', () => {
    assert.throws(() => filterAbsenteeOwners(null), /array/);
    assert.throws(() => filterAbsenteeOwners(undefined), /array/);
    assert.throws(() => filterAbsenteeOwners({ properties: [] }), /array/);
  });

  await t.test('case-insensitive state comparison (IL vs il)', () => {
    const lc = {
      parcel_id: 'LC-1',
      address: { zip: '60601' },
      state: 'il',
      owner: { mailing_zip: '60601', mailing_state: 'IL' },
      flags: {},
    };
    assert.deepEqual(filterAbsenteeOwners([lc]), []);  // same state, just casing
  });
});


test('applyAbsenteeFilterToBody', async (t) => {
  const mixed = {
    query: { zip: '60601' },
    count: 5,
    properties: [
      _ownerOccupied,
      _absenteeByFlag,
      _missingOwner,
      _absenteeByZipMismatch,
      _absenteeByStateMismatch,
    ],
    enrichment: { is_opportunity_zone: false },
  };

  await t.test('no-ops when absentee_only=false (or missing)', () => {
    const out = applyAbsenteeFilterToBody(mixed, { absentee_only: false });
    assert.equal(out, mixed); // same reference — no copy when not filtering
  });

  await t.test('filters + adjusts count when absentee_only=true', () => {
    const out = applyAbsenteeFilterToBody(mixed, { absentee_only: true });
    assert.notEqual(out, mixed); // new object
    assert.equal(out.properties.length, 3);
    assert.deepEqual(
      out.properties.map((p) => p.parcel_id),
      ['ABS-FLAG-1', 'ABS-ZIP-1', 'ABS-ST-1']
    );
    assert.equal(out.count, 3);
    // Other fields preserved.
    assert.deepEqual(out.query, { zip: '60601' });
    assert.deepEqual(out.enrichment, { is_opportunity_zone: false });
  });

  await t.test('absentee_only=true with no properties array → no-op', () => {
    const noProps = { count: 0, properties: [] };
    const out = applyAbsenteeFilterToBody(noProps, { absentee_only: true });
    assert.deepEqual(out.properties, []);
    assert.equal(out.count, 0);
  });

  await t.test('absentee_only=true with non-array properties → leaves unchanged', () => {
    // Defensive: if vendor returns a degenerate shape, don't crash.
    const weird = { count: 1, properties: null };
    const out = applyAbsenteeFilterToBody(weird, { absentee_only: true });
    assert.equal(out.properties, null);
  });

  await t.test('null body → returns null (defensive)', () => {
    assert.equal(applyAbsenteeFilterToBody(null, { absentee_only: true }), null);
  });
});
