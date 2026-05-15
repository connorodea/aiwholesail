/**
 * Single source of truth for the auth-related localStorage keys.
 *
 * Both `src/lib/api-client.ts` (which writes them at sign-in / refresh) AND
 * `src/components/ErrorBoundary.tsx` (which purges them on the recovery CTA)
 * import from here. Keeping the names in one place means a future rename
 * (e.g. namespacing for multi-tenant deployments) can't desync the
 * boundary's recovery from the writer.
 *
 * Zero-dependency module on purpose — `ErrorBoundary` lives in the entry
 * chunk and its bundle should not transitively pull in `api-client`'s
 * fetch wrappers / feature-flag setup just to learn three string literals.
 */

export const ACCESS_TOKEN_KEY = 'aiwholesail_access_token';
export const REFRESH_TOKEN_KEY = 'aiwholesail_refresh_token';
export const USER_KEY = 'aiwholesail_user';

/**
 * All three keys as a frozen tuple — convenient for bulk-clear operations
 * (e.g. ErrorBoundary's "Sign out & reset" CTA, or any future "log out
 * everywhere" flow).
 */
export const AUTH_STORAGE_KEYS = [
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
] as const;
