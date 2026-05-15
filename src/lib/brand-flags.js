// Brand-flag kill switches (#413 follow-up).
//
// PR #413 made body font-bold + headings font-extrabold globally. Reviewer
// asked for a flag-first rollout so the change can be flipped off at the
// DB level without a redeploy. This module is the pure-JS predicate plus
// a tiny DOM helper that toggles `data-brand-bold` on the html element.
//
// Pair with the CSS scoping in src/index.css:
//   html[data-brand-bold="true"] body  → font-bold rules
//   html[data-brand-bold="true"] h1-h6 → font-extrabold rules
// When the attribute is absent (default OFF), the site reverts to the
// pre-#413 appearance.

/**
 * Canonical feature-flag slug. Frozen so a refactor cannot silently
 * rename and disable the kill switch.
 */
export const BRAND_BOLD_FLAG = 'brand-bold';

/**
 * Strict predicate (only `=== true` returns true). Fails closed on cold
 * cache, non-function getter, or thrown lookup error.
 *
 * @param {() => boolean | undefined} getFlag
 * @returns {boolean}
 */
export function isBrandBoldEnabled(getFlag) {
  if (typeof getFlag !== 'function') return false;
  try {
    return getFlag() === true;
  } catch {
    return false;
  }
}

/**
 * Toggle the `data-brand-bold` attribute on the given element based on
 * the flag. Safe to call on every render or every flag-cache update —
 * setAttribute / removeAttribute are idempotent.
 *
 * @param {{setAttribute: Function, removeAttribute: Function} | null} el
 *   Typically `document.documentElement`.
 * @param {() => boolean | undefined} getFlag
 */
export function applyBrandBoldAttribute(el, getFlag) {
  if (!el || typeof el.setAttribute !== 'function') return;
  if (isBrandBoldEnabled(getFlag)) {
    el.setAttribute('data-brand-bold', 'true');
  } else {
    el.removeAttribute('data-brand-bold');
  }
}
