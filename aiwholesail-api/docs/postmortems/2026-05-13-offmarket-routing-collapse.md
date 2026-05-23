# Post-Incident — Off-market search routing collapse (2026-05-13)

## Timeline (UTC)
- **2026-05-12** (precise time TBD): off-market v2 ships behind `off-market-search-v2` flag. Latent single-feed planner bug in `getServerParamsForLeads` becomes triggerable as soon as the v2 chip set lets users pick Pre-Foreclosure or Auctions alongside any property-feed lead.
- **2026-05-13 ~13:30Z**: User reports "off market is not working at all" via screenshot. FL + all 12 v2 lead types selected → toast "No absentee owners found, 1 of 25 ZIPs hit rate-limit."
- **2026-05-13 ~13:35Z**: Triage starts (Connor).
- **2026-05-13 ~13:45Z**: Prod logs pulled via `ssh hetznerCO 'sudo journalctl -u aiwholesail-api'`. Root cause confirmed: 25/25 fan-out calls hit `/api/propdata/preforeclosure`, zero `/api/propdata/property` calls. Preforeclosure responses: ~13 NOT_FOUND, ~12 rate-limited 429.
- **2026-05-13 13:51Z**: PR #311 opened with fix + 7 new dual-feed planner tests (93/93 lead-types tests passing).
- **2026-05-13 14:57Z**: PR #317 opened — routing-collapse monitor (4 SLIs, cron, runbook).
- **2026-05-13 19:02Z**: PR #324 opened — `/api/offmarket-search-log` route activates SLI-1 + SLI-3.
- **(Pending)** PR #311 → smoke → #324 → #317 → manual systemd timer install. Backfill MTTR and impact numbers in this doc post-merge.

## Impact
- **Users affected:** Any paying user who selected a lead-type combination including Pre-Foreclosure or Auctions alongside any property-feed lead. The default "all 12 selected" mode triggered the bug — realistic blast radius is "every v2-flagged user who ran an off-market search."
- **Customer-visible behavior:** Hardcoded toast "No absentee owners found" with misleading "1 of 25 ZIPs hit rate-limit" subtext. Total search failure — no partial results.
- **Quantification (TODO post-merge):** Count distinct `user_id` values that hit `/api/propdata/preforeclosure` ≥5× in the 24h before #311 merge; cross-reference Stripe customer table for MRR exposed.

## Root cause
`getServerParamsForLeads` in `src/lib/lead-types.ts` and `aiwholesail-api/lib/lead-types.js` collapsed any multi-lead selection to a single `primarySource`. Rule: "if any selected lead has `primarySource: 'preforeclosure'`, the whole query routes to the preforeclosure feed." This was correct in the v1 era (off-market = absentee_only; pre-foreclosure was an exclusive alternate path). v2's multi-select UI broke the invariant: mixing Pre-Foreclosure or Auctions with any of the 10 property-feed lead types silently dropped the property-feed leads. The per-ZIP fan-out at `AbsenteeOwnerSearch.tsx:347` was a single-feed-per-ZIP ternary, multiplying the loss by 25.

## Detection gap
No monitor covered "off-market search returning empty for users." Detection required a user complaint — hours after v2 rollout. No SLI on empty-result rate, no SLI on feed-dispatch ratio, no integration test simulating a realistic multi-feed selection.

## What worked
- Structured propdata logs (`component:'propdata'`, `endpoint:`, `code:` fields) made root cause confirmation a 60-second `journalctl + grep`.
- Feature-flag-gated v2 rollout limited blast radius — v1 users on the legacy absentee_only call path were unaffected.
- Backend test suite for the lead-types planner was trivially extensible (7 new dual-feed tests).
- Fix scope stayed tight: pure frontend routing change + new pure helper. No API change, no DB change, no migration.

## What didn't
- No SLI alerted on empty-result rate or feed-dispatch ratio. Both obvious in hindsight.
- The single-feed planner's "preforeclosure wins" rule was unit-tested as the *intended* behavior. The bug was the missing test case: "what happens when the user wants both?"
- Off-market had no integration test simulating realistic multi-feed scenarios — only per-helper unit tests.
- Toast copy was hardcoded to "No absentee owners found" — v2-era language was never refreshed; the symptom-vs-cause mismatch slowed initial triage.

## Mitigations shipped this incident
- **PR #311** — `getSearchPlanForLeads(slugs)` returns both feed plans (`{ property, preforeclosure }`); per-ZIP fan-out hits both sequentially. Outcome counting absorbs OK-empty preforeclosure responses. Toast copy updated to "No off-market leads found."
- **PR #317** — cron monitor (`aiwholesail-offmarket-routing-monitor.timer`, every 5 min) with 4 SLIs: feed-ratio, endpoint-diversity, empty-rate, 429-burst. Cooldown-enforced. Resend email alerts. Target detection: 5-10 min.
- **PR #324** — `/api/offmarket-search-log` route emits one structured `component:'offmarket-search'` line per search. Activates SLI-1 + SLI-3 (inert without this route).

## Action items
- [ ] **(P0)** Merge #311 → smoke → #324 → #317 → manual systemd timer install per [`docs/runbooks/offmarket-debug.md`](../runbooks/offmarket-debug.md).
- [ ] **(P1)** Add component-level integration tests covering multi-feed selection (deferred nit from #311 review). Requires vitest infra — separate P1.
- [ ] **(P1)** Audit other planner-like routing logic in the codebase for similar "first wins" patterns — `routes/property.js`, skip-trace V1/V2 fallback, Stripe webhook handler.
- [ ] **(P2)** Add an "off-market regression suite" Playwright test running daily against staging — would catch this class of regression before user impact.
- [ ] **(P2)** Backfill the quantification numbers in "Impact" above once #311 merges and the journalctl window is bounded.

## Lessons
1. **"Mutually exclusive" upstream feeds are rarely actually mutually exclusive when user-facing UI lets users pick both.** Audit every "X wins" routing rule the moment the UI lets users pick X *and* Y.
2. **Structured logs are the difference between hours and minutes to root cause.** The absence of `component:'offmarket-search'` is exactly why SLI-1 + SLI-3 needed a separate PR — emit the log line the day you ship the feature, not the day you write the postmortem.
3. **A test that asserts the intended behavior is half the story.** Add a paired test that asserts the bug case fails when the spec changes — i.e., "what if a future lead type added to the catalog mixes sources?"

## Related
- Runbook: [`docs/runbooks/offmarket-debug.md`](../runbooks/offmarket-debug.md)
- PRs: [#311](https://github.com/connorodea/aiwholesail/pull/311) (fix), [#317](https://github.com/connorodea/aiwholesail/pull/317) (monitor), [#324](https://github.com/connorodea/aiwholesail/pull/324) (SLI activation)
- Source code: `src/lib/lead-types.ts`, `aiwholesail-api/lib/lead-types.js`, `src/components/AbsenteeOwnerSearch.tsx`
