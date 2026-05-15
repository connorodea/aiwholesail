/**
 * Pure storage helpers for the property-search history feature.
 *
 * Stores the last N (default 4) searches per mode under a stable localStorage
 * key. Designed as a side-effect-free module so it can be unit-tested with
 * node:test (the rest of the repo's test pattern) without jsdom — callers
 * pass an explicit Storage instance.
 *
 * Keep this module React-free; useSearchHistory.ts is the thin React wrapper.
 */

export const SEARCH_HISTORY_MAX = 4;
export const SEARCH_HISTORY_KEY_PREFIX = 'aiw_search_history_v1';

export type SearchHistoryMode = 'on-market' | 'off-market';

export interface SearchHistoryEntry<P = unknown> {
  /** Stable id derived from params — used to dedupe. */
  id: string;
  /** Human-readable single-line summary shown in the UI chip. */
  label: string;
  /** Full search params payload, replayed on click. */
  params: P;
  /** Epoch ms of when the search ran. */
  timestamp: number;
  /** Optional result count, populated by recordResultCount(). */
  resultCount?: number;
}

export function storageKey(mode: SearchHistoryMode): string {
  return `${SEARCH_HISTORY_KEY_PREFIX}:${mode}`;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readHistory<P>(storage: Storage, mode: SearchHistoryMode): SearchHistoryEntry<P>[] {
  const raw = storage.getItem(storageKey(mode));
  const parsed = safeParse<SearchHistoryEntry<P>[]>(raw);
  if (!Array.isArray(parsed)) return [];
  // Drop malformed entries defensively — bad data shouldn't crash the UI.
  return parsed.filter(
    (e) =>
      e != null &&
      typeof e === 'object' &&
      typeof e.id === 'string' &&
      typeof e.label === 'string' &&
      typeof e.timestamp === 'number',
  );
}

export function writeHistory<P>(
  storage: Storage,
  mode: SearchHistoryMode,
  entries: SearchHistoryEntry<P>[],
): void {
  try {
    storage.setItem(storageKey(mode), JSON.stringify(entries));
  } catch {
    // Quota exceeded / storage disabled — non-fatal; in-memory state still works.
  }
}

/**
 * Push a new entry to the head of the list, dedupe by id, cap to `max`.
 * Pure — returns a new array; doesn't touch storage.
 */
export function pushEntry<P>(
  existing: SearchHistoryEntry<P>[],
  next: SearchHistoryEntry<P>,
  max: number = SEARCH_HISTORY_MAX,
): SearchHistoryEntry<P>[] {
  const filtered = existing.filter((e) => e.id !== next.id);
  return [next, ...filtered].slice(0, Math.max(1, max));
}

export function removeEntry<P>(
  existing: SearchHistoryEntry<P>[],
  id: string,
): SearchHistoryEntry<P>[] {
  return existing.filter((e) => e.id !== id);
}

export function clearHistory(storage: Storage, mode: SearchHistoryMode): void {
  try {
    storage.removeItem(storageKey(mode));
  } catch {
    // ignored
  }
}

/**
 * Deterministic id derived from JSON-stringified params. Stable across
 * renders and machines, so two identical searches dedupe correctly.
 * Not cryptographic — collisions don't matter (it's a UI dedupe key).
 */
export function hashParams(params: unknown): string {
  const s = stableStringify(params);
  // djb2 hash — short, dependency-free, plenty for dedupe.
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(36)}`;
}

/**
 * JSON.stringify with sorted keys so { a:1, b:2 } and { b:2, a:1 } produce
 * the same id. Skips undefined values; coerces null through.
 */
function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
