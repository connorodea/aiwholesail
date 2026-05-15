/**
 * Pure storage helpers for the property-search history feature.
 *
 * Stores the last N (default 4) searches per mode under a stable localStorage
 * key. Designed as a side-effect-free module so it can be unit-tested with
 * node:test (the rest of the repo's test pattern) without jsdom — callers
 * pass an explicit Storage instance.
 *
 * Keep this module React-free; useSearchHistory.ts is the thin React wrapper.
 *
 * @typedef {'on-market' | 'off-market'} SearchHistoryMode
 * @typedef {Object} SearchHistoryEntry
 * @property {string} id          Stable id derived from params — used to dedupe.
 * @property {string} label       Human-readable single-line summary shown in the UI chip.
 * @property {unknown} params     Full search params payload, replayed on click.
 * @property {number} timestamp   Epoch ms of when the search ran.
 * @property {number} [resultCount] Optional result count.
 */

export const SEARCH_HISTORY_MAX = 4;
export const SEARCH_HISTORY_KEY_PREFIX = 'aiw_search_history_v1';

/** @param {SearchHistoryMode} mode */
export function storageKey(mode) {
  return `${SEARCH_HISTORY_KEY_PREFIX}:${mode}`;
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {Storage} storage
 * @param {SearchHistoryMode} mode
 * @returns {SearchHistoryEntry[]}
 */
export function readHistory(storage, mode) {
  const raw = storage.getItem(storageKey(mode));
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (e) =>
      e != null &&
      typeof e === 'object' &&
      typeof e.id === 'string' &&
      typeof e.label === 'string' &&
      typeof e.timestamp === 'number',
  );
}

/**
 * @param {Storage} storage
 * @param {SearchHistoryMode} mode
 * @param {SearchHistoryEntry[]} entries
 */
export function writeHistory(storage, mode, entries) {
  try {
    storage.setItem(storageKey(mode), JSON.stringify(entries));
  } catch {
    // Quota exceeded / storage disabled — non-fatal; in-memory state still works.
  }
}

/**
 * Push a new entry to the head of the list, dedupe by id, cap to `max`.
 * Pure — returns a new array; doesn't touch storage.
 *
 * @param {SearchHistoryEntry[]} existing
 * @param {SearchHistoryEntry} next
 * @param {number} [max]
 * @returns {SearchHistoryEntry[]}
 */
export function pushEntry(existing, next, max = SEARCH_HISTORY_MAX) {
  const filtered = existing.filter((e) => e.id !== next.id);
  return [next, ...filtered].slice(0, Math.max(1, max));
}

/**
 * @param {SearchHistoryEntry[]} existing
 * @param {string} id
 * @returns {SearchHistoryEntry[]}
 */
export function removeEntry(existing, id) {
  return existing.filter((e) => e.id !== id);
}

/**
 * @param {Storage} storage
 * @param {SearchHistoryMode} mode
 */
export function clearHistory(storage, mode) {
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
 *
 * @param {unknown} params
 * @returns {string}
 */
export function hashParams(params) {
  const s = stableStringify(params);
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
function stableStringify(value) {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}
