/**
 * Template rendering for email/SMS sequence steps.
 *
 * Substitutes `{key}` tokens in the template with the corresponding value
 * from `vars`. Unmatched placeholders (key missing, or value null/undefined)
 * are intentionally LEFT AS-IS so they show up in send logs and reviews
 * rather than silently producing empty strings.
 *
 * Numeric (and other non-string) values are stringified via String(...).
 *
 * Extracted from scripts/sequence-execution-worker.js so the pure
 * substitution logic can be unit-tested without booting Postgres + Resend.
 */
function renderTemplate(template, vars) {
  if (!template) return '';
  const v = vars && typeof vars === 'object' ? vars : {};
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const val = v[key];
    return val === undefined || val === null ? match : String(val);
  });
}

module.exports = { renderTemplate };
