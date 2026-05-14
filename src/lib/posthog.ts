/**
 * PostHog (Cloud) browser SDK init + thin wrapper.
 *
 * Initialized once from main.tsx after marketing-attribution.captureAttribution()
 * runs, so the first events emitted already have the first-touch UTM payload
 * available via marketing-attribution.getAttribution().
 *
 * Env:
 *   VITE_POSTHOG_KEY   — Project API key (phc_…). When unset, this module
 *                        no-ops and exposes a stub so dev/test envs and
 *                        CI builds don't try to ship events to a missing host.
 *   VITE_POSTHOG_HOST  — Defaults to https://us.i.posthog.com. Override if
 *                        you migrate to self-hosted or to the EU cluster.
 *
 * Session recordings: enabled by default per the spec. PostHog Cloud's free
 * tier covers 5K recordings/month — plenty for current trial volume.
 *
 * Autocapture: enabled. Captures clicks, form submits, page views without
 * per-component instrumentation. Custom events still fire via capture()
 * for higher-fidelity funnel/cohort analysis.
 */

import posthogJs, { type PostHog } from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';
const MODE = import.meta.env.MODE;

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  if (!KEY) return;             // no key configured → no-op (dev/test/CI builds)
  if (MODE === 'test') return;  // skip in vitest/jest

  posthogJs.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
    session_recording: {
      // Standard mask defaults — recordings hide password inputs + payment
      // fields automatically.
      maskAllInputs: false,
      maskTextSelector: '[data-ph-mask]',
    },
    loaded: () => {
      // Surface the distinct_id once init resolves so signup/login flows
      // can attach it to their API calls before posthog.identify() runs.
      try {
        (window as unknown as { __posthog_distinct_id?: string }).__posthog_distinct_id =
          posthogJs.get_distinct_id();
      } catch {
        // posthog-js sometimes returns undefined under sync init guarantees;
        // fine to skip, the signup form falls back to undefined.
      }
    },
  });
  initialized = true;
}

/**
 * Best-effort getter for the current distinct_id. Returns `undefined` when
 * PostHog isn't initialized (no key configured, etc) so callers can
 * conditionally include it in payloads without a runtime check.
 */
export function getDistinctId(): string | undefined {
  if (!initialized) return undefined;
  try { return posthogJs.get_distinct_id(); } catch { return undefined; }
}

export function identify(userId: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  try { posthogJs.identify(userId, properties); } catch { /* swallow */ }
}

export function alias(userId: string, distinctId: string): void {
  if (!initialized || !distinctId) return;
  try { posthogJs.alias(userId, distinctId); } catch { /* swallow */ }
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  try { posthogJs.capture(event, properties); } catch { /* swallow */ }
}

export function reset(): void {
  if (!initialized) return;
  try { posthogJs.reset(); } catch { /* swallow */ }
}

export function getPostHog(): PostHog | null {
  return initialized ? posthogJs : null;
}
