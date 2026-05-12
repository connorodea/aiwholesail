/**
 * Required-in-production URL accessors.
 *
 * Replaces the silent `process.env.X || 'https://aiwholesail.com'` pattern
 * that was scattered across routes/, auth.js, communications.js, stripe.js,
 * and the trial-lifecycle worker. The old pattern silently fired Twilio
 * callbacks at prod from any non-prod environment whose .env was missing
 * the var — which is how a "dev" deployment can rings prod's phone.
 *
 * Behavior:
 *   - In production (NODE_ENV === 'production'): the resolver throws if
 *     no candidate env var is set. The first request that hits the
 *     resolver returns 500, the error reaches journalctl, the operator
 *     sets the env var. Loud and recoverable.
 *   - In non-production: falls back to the dev default. Lets local dev
 *     and ad-hoc one-off envs keep working without an .env edit.
 *
 * Chained env vars: APP_URL and FRONTEND_URL refer to the same thing in
 * this codebase (consolidating to one name is a separate cleanup PR).
 * The chain just means "use whichever is set first" so we don't break
 * the prod deploy that has FRONTEND_URL set but not APP_URL.
 */

function resolveUrl({ envNames, devDefault, purpose }) {
  for (const name of envNames) {
    const v = process.env[name];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `${purpose}: no URL env var set in production. ` +
      `Set one of: ${envNames.join(', ')}.`
    );
  }
  return devDefault;
}

const apiUrl = () => resolveUrl({
  envNames: ['API_URL'],
  devDefault: 'http://localhost:3202',
  purpose: 'API URL (callbacks, server-rendered links)',
});

// APP_URL and FRONTEND_URL are aliases in this codebase. The chain reads
// APP_URL first because it's the older / preferred name; FRONTEND_URL is
// what most of the codebase actually uses today.
const appUrl = () => resolveUrl({
  envNames: ['APP_URL', 'FRONTEND_URL'],
  devDefault: 'http://localhost:8080',
  purpose: 'App / frontend URL (email links, redirects)',
});

const frontendUrl = () => resolveUrl({
  envNames: ['FRONTEND_URL', 'APP_URL'],
  devDefault: 'http://localhost:8080',
  purpose: 'Frontend URL (email links, redirects)',
});

module.exports = { apiUrl, appUrl, frontendUrl };
