# Pending Tasks — SEO + Marketing Sprint 2026-05-12

> Tracked here because Todoist API rate-limited mid-sync.
> When the rate limit clears, copy these into Todoist project "AIWholesail.com" → section "SEO Sprint 2026-05-12" (id `6gcxP93QgPMV6fcQ`).
> Already in Todoist: 11 shipped + 7 of 15 pending (the first batch).

## High priority (P4 in Todoist)

### Build 5 trial-lifecycle email templates — TEMPLATES NOW SHIPPED IN PR #284
Status updated: **HTML done, backend triggers pending.** See follow-up task below.

### Wire backend triggers for trial-lifecycle emails (PR #284 follow-up)
Stripe `subscription.trial_will_end` webhook + Supabase cron. Send: `trial-day-minus-2`, `minus-1`, `day-0`, `plus-3`, `plus-14`. Templates are merged in `email-templates/`.

## Medium-high priority (P3 in Todoist)

### Implement homepage CRO fixes (counter + demo + recent deals)
From `marketing/CRO_AUDIT_2026-05-12.md` #1-3. Add: (1) above-fold counter showing investors / deals / total spread, (2) 60-90s product demo GIF or video, (3) "Recent deals AIWholesail scored 90+" section with 3 anonymized examples. Highest-impact CRO improvement on the homepage.

### Configure GA4 + GSC event tracking for the funnel
Plug actuals into `marketing/funnel-metrics-template.csv` weekly. Need: page-view events, `signup_start`, `signup_complete`, `trial_to_paid`, `plan_upgraded`. Pipe Stripe webhooks into GA4 via GTM. Without this we are flying blind on which CRO fixes actually moved the needle.

### Coordinate with the trial-upgrade agent before /auth CRO changes
Another agent has `fix/trial-upgrade-paid-gate-and-day-zero` and `fix/trial-upgrade-require-card` branches in flight. CRO audit on `/auth` was paused for this reason. Once their PRs merge, re-audit the signup flow. Check progress: `gh pr list --search "fix/trial-upgrade"`.

## Medium priority (P2 in Todoist)

### Add exit-intent on /guides/finding-motivated-sellers
Highest-value content page on the site. Capture 3-8% of bounces as email leads with a "Get the 10-step motivated-seller checklist" exit-intent modal. Use the `/popup-cro` skill or a simple `useEffect` mouse-leave detector.

### Add sticky scroll-CTA to long-form content (guides + blog)
CRO Audit #2 site-wide pattern. Sticky bottom-bar "Start your 7-day trial" appearing after 30% scroll. Typically 2-4x lift on content-page trial conversion. Apply to `BlogPost.tsx` and `GuidePage.tsx`.

### Add social proof stat to /vs/[competitor] pages
10-min change with measurable lift. CRO Audit site-wide #3. Real number, no placeholder. Could be "X investors switched from PropStream this year" or "Used by Y wholesalers in [their] market" — pull from internal data. `/vs` pages are commercial intent — highest converting cluster in B2B SaaS.

### Add CRO fixes to /pricing — bigger trial banner + annual toggle test
CRO Audit #2-3 for `/pricing`. PR #279 added FAQs. Still missing: (a) much more visible "7-day free trial · No card" banner directly under each plan price, (b) annual discount toggle (15-20% off, lifts LTV without hurting conversion).

### Pitch real estate investor newsletters for sponsored placement
From `marketing/DIRECTORY_SUBMISSIONS.md` Tier 4. The Daily REI Newsletter (~25K subscribers), Tactical Real Estate (~12K), audio podcast directories if doing a podcast tour. Reply to a recent edition, pitch a guest spot or paid sponsorship slot. Founder-direct (Connor) outreach beats agency.

---

## Already in Todoist (for reference)

These 12 tasks made it into Todoist section "SEO Sprint 2026-05-12" before the rate limit. Listed here for completeness:

1. Apply for Google Ads Basic Access (manual web form)
2. Re-run IndexNow with full sitemap after PR #264 deploys
3. Build "How to find motivated sellers" pillar [COMPLETED via PR #265]
4. Wait 14 days, re-run GSC opportunity report
5. Sweep all pages that pass canonicalUrl explicitly to SEOHead
6. Consider running /seo-backlinks audit
7. Track propstream-review page CTR
8. Build 5 trial-lifecycle email templates [TEMPLATES DONE in PR #284 — backend wiring still pending]
9. Submit to Tier 1 real estate / PropTech directories
10. Submit to AI tool directories (Tier 3)
11. Submit to G2 + Capterra + AlternativeTo
12. Submit to Product Hunt
13. Run Lighthouse audit on top 10 pages
14. Launch first Google Ads RSA campaign with new copy library
15. Launch first Meta Ads campaign with new ad copy variations

---

## Resuming the Todoist sync

Once the rate limit clears (typically a few hours), run:

```bash
source ~/.zshrc
python3 /tmp/td_final.py
```

That script has the 9 remaining tasks ready to post. After they're synced, this file can be deleted.

> **Heads-up for future bursts:** Todoist API silently throttles POST /tasks after ~15-20 creations in a short window. Space requests ≥12s apart or batch into one cron job.
