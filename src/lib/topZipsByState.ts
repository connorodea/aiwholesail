/**
 * Top N ZIPs per state ranked by population. Sourced from the static
 * zipcodes.json that pSEO uses (PR #175 — 1,000 US ZIPs, ACS 2022 5-yr
 * population). Cached at module load so repeat resolves are O(1).
 *
 * Used by the off-market location resolver: when the user types "MI",
 * we'd rather fan out to Detroit / Grand Rapids / Warren ZIPs than to
 * 25 random rural ZIPs the centroid file happens to list first.
 *
 * If the static file doesn't include any ZIPs for a given state (small
 * states or all-rural ones), the resolver falls back to centroid-only.
 */

import zipcodes from '@/data/zipcodes.json';

interface ZipEntry {
  zip: string;
  state: string;
  population?: number;
}

const byState: Map<string, string[]> = (() => {
  const groups = new Map<string, ZipEntry[]>();
  for (const entry of zipcodes as ZipEntry[]) {
    const s = entry.state?.toUpperCase();
    if (!s) continue;
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(entry);
  }
  const ranked = new Map<string, string[]>();
  for (const [state, entries] of groups) {
    entries.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    ranked.set(state, entries.map((e) => e.zip));
  }
  return ranked;
})();

export function topZipsInState(state: string, max: number): string[] {
  const all = byState.get(state.toUpperCase()) || [];
  return all.slice(0, max);
}
