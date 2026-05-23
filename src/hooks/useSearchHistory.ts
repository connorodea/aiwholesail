import { useCallback, useEffect, useState } from 'react';
import {
  clearHistory,
  hashParams,
  patchEntry,
  pushEntry,
  readHistory,
  removeEntry,
  SEARCH_HISTORY_MAX,
  storageKey,
  writeHistory,
} from '@/lib/searchHistoryStorage.js';

// Mirror of the JSDoc typedef in src/lib/searchHistoryStorage.js. Kept here
// so TS consumers get strong types without re-introducing a .ts source
// (CI runs node --test on Node 20 which can't load .ts natively).
export type SearchHistoryMode = 'on-market' | 'off-market';
export interface SearchHistoryEntry<P = unknown> {
  id: string;
  label: string;
  params: P;
  timestamp: number;
  resultCount?: number;
}

interface UseSearchHistoryOptions<P> {
  mode: SearchHistoryMode;
  /** Build the chip's display label from params. Keep it short — one line. */
  buildLabel: (params: P) => string;
  /** Override the dedupe key. Defaults to a stable hash of params. */
  buildId?: (params: P) => string;
  /** Max entries to retain. Defaults to 4. */
  max?: number;
}

interface UseSearchHistoryResult<P> {
  history: SearchHistoryEntry<P>[];
  /** Record a new search. Returns the entry id (useful for resultCount updates). */
  recordSearch: (params: P) => string;
  /** Patch resultCount on the most-recent entry matching `id`. No-op if not found. */
  recordResultCount: (id: string, count: number) => void;
  removeSearch: (id: string) => void;
  clear: () => void;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useSearchHistory<P>(opts: UseSearchHistoryOptions<P>): UseSearchHistoryResult<P> {
  const { mode, buildLabel, buildId, max = SEARCH_HISTORY_MAX } = opts;
  const [history, setHistory] = useState<SearchHistoryEntry<P>[]>(() => {
    const storage = getStorage();
    return storage ? readHistory<P>(storage, mode) : [];
  });

  // Cross-tab sync — if another tab updates the same key, mirror it here.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = storageKey(mode);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      const storage = getStorage();
      if (!storage) return;
      setHistory(readHistory<P>(storage, mode));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [mode]);

  const recordSearch = useCallback(
    (params: P): string => {
      const id = buildId ? buildId(params) : hashParams(params);
      const entry: SearchHistoryEntry<P> = {
        id,
        label: buildLabel(params),
        params,
        timestamp: Date.now(),
      };
      setHistory((prev) => {
        const next = pushEntry(prev, entry, max);
        const storage = getStorage();
        if (storage) writeHistory(storage, mode, next);
        return next;
      });
      return id;
    },
    [buildId, buildLabel, max, mode],
  );

  const recordResultCount = useCallback(
    (id: string, count: number) => {
      setHistory((prev) => {
        const next = patchEntry(prev, id, { resultCount: count });
        // patchEntry returns the same reference on no-op — skip the write.
        if (next === prev) return prev;
        const storage = getStorage();
        if (storage) writeHistory(storage, mode, next);
        return next;
      });
    },
    [mode],
  );

  const removeSearch = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const next = removeEntry(prev, id);
        const storage = getStorage();
        if (storage) writeHistory(storage, mode, next);
        return next;
      });
    },
    [mode],
  );

  const clear = useCallback(() => {
    setHistory([]);
    const storage = getStorage();
    if (storage) clearHistory(storage, mode);
  }, [mode]);

  return { history, recordSearch, recordResultCount, removeSearch, clear };
}
