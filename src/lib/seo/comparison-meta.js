// Pure helpers for ComparisonPage meta tags.
// Plain JS (ESM) so they can be unit-tested with node:test without a transpiler.

const META_TITLE_MAX = 60;
const META_DESC_MAX = 160;
const EM_DASH = '—';

function yearOf(lastUpdated) {
  const m = /^(\d{4})/.exec(String(lastUpdated || ''));
  return m ? m[1] : new Date().getFullYear().toString();
}

/**
 * Build the SERP title for /vs/<slug>.
 * Target: <= 60 chars. Uses year only (not full ISO date) and an em-dash
 * for typography.
 */
export function buildComparisonTitle(comp, lastUpdated) {
  const year = yearOf(lastUpdated);
  const full = `AIWholesail vs ${comp.name} ${EM_DASH} Honest Comparison ${year}`;
  if (full.length <= META_TITLE_MAX) return full;
  // Drop "Honest" if needed for long competitor names.
  const short = `AIWholesail vs ${comp.name} ${EM_DASH} Comparison ${year}`;
  return short.length <= META_TITLE_MAX ? short : short.slice(0, META_TITLE_MAX);
}

/**
 * Build the SERP description for /vs/<slug>.
 * Target: <= 160 chars. Prefers summary text; truncates at sentence
 * boundary if needed.
 */
export function buildComparisonDescription(comp, lastUpdated) {
  const prefix = `AIWholesail vs ${comp.name}: `;
  const fallback = `Compare features, pricing, and use cases. AIWholesail at $49/mo vs ${comp.name} at ${comp.pricing}. Updated ${lastUpdated}.`;
  if (!comp.summary) {
    const out = prefix + fallback;
    return out.length <= META_DESC_MAX ? out : trimToSentence(out, META_DESC_MAX);
  }
  const full = prefix + comp.summary;
  if (full.length <= META_DESC_MAX) return full;
  return trimToSentence(full, META_DESC_MAX);
}

// Truncate to the last sentence-ending punctuation that fits within max,
// preserving readability. Adds a final period if none found.
function trimToSentence(text, max) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  // Find the last `.`, `!`, or `?` followed by space or end-of-string.
  const m = slice.match(/^(.*[.!?])(?:\s|$)/);
  if (m && m[1].length >= max / 2) return m[1];
  // Fall back to last word boundary, then append a period.
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > max / 2) return slice.slice(0, lastSpace).replace(/[,;:\-]$/, '') + '.';
  return slice.replace(/[,;:\-]$/, '') + '.';
}
