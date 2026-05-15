/**
 * Backend-side workaround for PropData's broken `absentee_only=true` filter.
 *
 * Vendor confirmed broken on 2026-05-14 — requests with absentee_only=true
 * return empty arrays for ZIPs that DO contain absentee-owner properties.
 * The vendor still returns the data needed to recompute the filter
 * locally, so we stop sending the bad parameter upstream and post-filter
 * on the response.
 *
 * Definition of "absentee owner" (matches PropData's documented intent):
 *   - flags.is_absentee_owner === true (vendor pre-computed), OR
 *   - owner.mailing_zip differs from address.zip, OR
 *   - owner.mailing_state differs from the property's state.
 * Records with no owner block are dropped — we can't determine.
 */

'use strict';

function _norm(s) {
  return typeof s === 'string' ? s.trim().toUpperCase() : '';
}

function _isAbsentee(record) {
  if (!record || typeof record !== 'object') return false;
  const owner = record.owner;
  if (!owner || typeof owner !== 'object') return false;

  if (record.flags && record.flags.is_absentee_owner === true) return true;

  const propertyZip = record.address && record.address.zip;
  const mailingZip = owner.mailing_zip;
  if (propertyZip && mailingZip && _norm(propertyZip) !== _norm(mailingZip)) {
    return true;
  }

  const propertyState = record.state;
  const mailingState = owner.mailing_state;
  if (propertyState && mailingState && _norm(propertyState) !== _norm(mailingState)) {
    return true;
  }

  return false;
}

function filterAbsenteeOwners(records) {
  if (!Array.isArray(records)) {
    throw new TypeError('filterAbsenteeOwners: expected array');
  }
  return records.filter(_isAbsentee);
}

/**
 * Apply the absentee-only post-filter to a vendor response body in place
 * of the broken upstream `absentee_only=true` parameter.
 *
 * When `options.absentee_only` is truthy AND `body.properties` is an array,
 * returns a new body with `properties` filtered + `count` adjusted to the
 * filtered length. All other fields preserved by shallow copy.
 *
 * When `options.absentee_only` is falsy: returns the body argument
 * unchanged (no copy, no allocation) — this path is hot for non-absentee
 * queries.
 */
function applyAbsenteeFilterToBody(body, options) {
  const wantAbsentee = options && options.absentee_only;
  if (!wantAbsentee) return body;
  if (body == null) return body;
  if (!Array.isArray(body.properties)) return body;

  const filtered = filterAbsenteeOwners(body.properties);
  return {
    ...body,
    properties: filtered,
    count: filtered.length,
  };
}

module.exports = { filterAbsenteeOwners, applyAbsenteeFilterToBody };
