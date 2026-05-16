# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- **Comps tab returned out-of-area properties for every subject** (#84, #85, #86).
  The fallback `recently_sold` search in `getPropertyComps` was sending
  `?location=XX+` (state-only) to upstream Zillow because the location-string
  parser couldn't handle the 3-part `"City, State, Zip"` format produced by
  `ComparableSalesTable`. Result: a Saint Augustine subject got Jacksonville
  foreclosures 19–26 mi away, with ARV math anchored on $80–110/sqft instead
  of the actual ~$200/sqft. Production impact was 100% of comps requests
  since the upstream `/similar` endpoint reliably returns empty, forcing the
  fallback path on every property.
  - Parser now accepts both `"City, State Zip"` and `"City, State, Zip"`,
    plus zip+4 formats.
  - Fallback results are tier-filtered (≤10 mi + beds ±1 + sqft 70–130%, with
    graceful relaxation when too few matches).
  - Foreclosure-auction subjects (description match, $/sqft < $10, or
    < $25K on > 800 sqft) no longer show a green "Great Deal" verdict against
    their opening-bid price; they get an amber "Auction subject" warning.

### Changed

- CI install step now uses `npm ci --legacy-peer-deps` to match the lockfile
  resolution mode used locally; unblocks `react-leaflet@5` peer-dep conflict
  with `react@18` (#89).

### Removed

- Deleted four unused UI template files referencing uninstalled packages
  (`next/link`, `@/components/container`, `fuzzy-search`, `simplex-noise`):
  `blog-content-with-toc.tsx`, `blog-with-search-magazine.tsx`,
  `wavy-background.tsx`, `wavy-background-demo.tsx` (#89).
