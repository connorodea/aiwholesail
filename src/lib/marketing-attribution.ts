/**
 * Marketing attribution — first-touch capture.
 *
 * On every page load (call `captureAttribution()` once from the app
 * root) we sniff the URL for UTM params + click IDs (fbclid, gclid).
 * If anything is present, we persist a payload to localStorage. The
 * very first capture wins — subsequent visits don't overwrite. This
 * way someone who lands via a Facebook ad, browses around, leaves,
 * comes back direct three days later, and THEN signs up still gets
 * tagged to the original ad.
 *
 * `getAttribution()` exposes the saved payload to the signup form;
 * the form sends it along with email/password so the backend can
 * persist it to the user row and propagate to Stripe metadata.
 *
 * fbp / fbc cookies (Meta's first-party identifiers) are read by name
 * if present — Pixel sets these client-side. They're what powers the
 * server-side CAPI deduplication in Layer 2.
 */

const STORAGE_KEY = 'aiw_attribution_v1';
const TTL_DAYS = 30;

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  fbp?: string;
  fbc?: string;
  landing_url?: string;
  referrer?: string;
  first_visit_at?: string; // ISO
}

interface StoredAttribution extends Attribution {
  capturedAt: number; // ms epoch — used for TTL
}

/** Read a cookie value by name. Returns undefined if not set. */
function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[$()*+./?[\\\]^{|}]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function isExpired(stored: StoredAttribution): boolean {
  const ageMs = Date.now() - stored.capturedAt;
  return ageMs > TTL_DAYS * 24 * 60 * 60 * 1000;
}

function readStored(): StoredAttribution | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttribution;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.capturedAt !== 'number') return null;
    if (isExpired(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Captures URL params + cookies into localStorage on first visit.
 * Safe to call on every render — it short-circuits if attribution
 * is already stored and not expired. First-touch semantics: nothing
 * overwrites the saved payload until it ages out at TTL_DAYS.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;

  // Always refresh fbp/fbc on each call — Pixel may set them after the
  // first capture, and CAPI needs the latest values for matching.
  const existing = readStored();

  const params = new URLSearchParams(window.location.search);
  const candidate: Attribution = {
    utm_source:   params.get('utm_source')   || undefined,
    utm_medium:   params.get('utm_medium')   || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_content:  params.get('utm_content')  || undefined,
    utm_term:     params.get('utm_term')     || undefined,
    fbclid:       params.get('fbclid')       || undefined,
    gclid:        params.get('gclid')        || undefined,
  };

  const hasAnyParam =
    !!(candidate.utm_source || candidate.utm_medium || candidate.utm_campaign ||
       candidate.utm_content || candidate.utm_term || candidate.fbclid || candidate.gclid);

  // Live cookies — refreshed every call.
  const fbp = readCookie('_fbp');
  const fbc = readCookie('_fbc');

  if (existing) {
    // First-touch wins for UTM payload. Refresh fbp/fbc only.
    const merged: StoredAttribution = {
      ...existing,
      fbp: fbp || existing.fbp,
      fbc: fbc || existing.fbc,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
    return merged;
  }

  if (!hasAnyParam && !fbp && !fbc) return null;

  const now = new Date();
  const stored: StoredAttribution = {
    ...candidate,
    fbp,
    fbc,
    landing_url: window.location.href.slice(0, 2000),
    referrer: (document.referrer || '').slice(0, 2000) || undefined,
    first_visit_at: now.toISOString(),
    capturedAt: now.getTime(),
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch { /* ignore */ }
  return stored;
}

/** Returns the stored attribution payload (without internal `capturedAt`). */
export function getAttribution(): Attribution | null {
  const stored = readStored();
  if (!stored) {
    // Even if no UTM-bearing first visit, surface fbp/fbc if Pixel set them.
    if (typeof window === 'undefined') return null;
    const fbp = readCookie('_fbp');
    const fbc = readCookie('_fbc');
    if (fbp || fbc) return { fbp, fbc };
    return null;
  }
  const { capturedAt: _capturedAt, ...rest } = stored;
  return rest;
}

/** Test-only: clear attribution so we can simulate first-touch repeatedly. */
export function clearAttribution(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
