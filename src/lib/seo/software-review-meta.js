// Pure helpers for SoftwareReviewPage meta tags + JSON-LD.
// Plain JS (ESM) so they can be unit-tested with node:test without a transpiler.

const META_DESC_MAX = 160;

function formatRating(r) {
  // 4 -> "4", 3.5 -> "3.5", 4.25 -> "4.25" (no trailing zero noise)
  return Number.isInteger(r) ? String(r) : String(r);
}

/**
 * Build an SEO-optimized meta description for a software review page.
 * Target: <= 160 chars, includes name + rating + price + AIWholesail comparison
 * + last-updated date. bestFor context is included only if it fits.
 */
export function buildMetaDescription(review, lastUpdated) {
  const rating = formatRating(review.rating);
  const base = `${review.name} review: ${rating}/5 at ${review.pricing}. Pros, cons, and how it compares to AIWholesail at $49/mo. Updated ${lastUpdated}.`;
  // If there's room for the bestFor clause, insert it after the rating/price.
  const withBestFor = `${review.name} review (${rating}/5, ${review.pricing}). Best for ${review.bestFor.toLowerCase()}. Vs AIWholesail at $49/mo. Updated ${lastUpdated}.`;
  if (withBestFor.length <= META_DESC_MAX) return withBestFor;
  if (base.length <= META_DESC_MAX) return base;
  // Last resort: shortest deterministic fallback (will not exceed limit for any realistic input).
  const minimal = `${review.name} review (${rating}/5, ${review.pricing}). Pros, cons & AIWholesail comparison. Updated ${lastUpdated}.`;
  return minimal.length <= META_DESC_MAX ? minimal : minimal.slice(0, META_DESC_MAX - 1) + '.';
}
