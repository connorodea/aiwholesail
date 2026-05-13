// Campaign scheduling helpers.
//
// nextAllowedSendTime(date, sendWindow)
//   Snap a candidate send time forward to the next minute that satisfies the
//   campaign's send window (allowed weekdays + allowed hour-of-day range).
//
// sendWindow shape:
//   {
//     startHour: 0..23 | null    // inclusive start (e.g. 9 → 09:00 local)
//     endHour:   0..23 | null    // EXCLUSIVE end   (e.g. 18 → up to 17:59)
//     days:      number[] | null // 0=Sun..6=Sat; null = all days
//   }
// If a field is null/undefined, that dimension is unconstrained.
//
// Times are evaluated in UTC. The route layer is responsible for converting
// from the user's timezone before calling this — see TODO in routes/campaigns.js.
//
// Pure / no side effects → unit-testable in isolation.

const MAX_ITER = 8; // a couple of full-day skips is plenty

function normalizeWindow(w) {
  if (!w || typeof w !== 'object') return { startHour: null, endHour: null, days: null };
  const days = Array.isArray(w.days) && w.days.length > 0
    ? w.days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    : null;
  const startHour = Number.isInteger(w.startHour) && w.startHour >= 0 && w.startHour <= 23
    ? w.startHour
    : null;
  const endHour = Number.isInteger(w.endHour) && w.endHour >= 0 && w.endHour <= 23
    ? w.endHour
    : null;
  return { startHour, endHour, days };
}

function startOfHour(d) {
  const out = new Date(d.getTime());
  out.setUTCMinutes(0, 0, 0);
  return out;
}

function dayMatch(d, days) {
  if (!days || days.length === 0) return true;
  return days.includes(d.getUTCDay());
}

function hourMatch(d, startHour, endHour) {
  const h = d.getUTCHours();
  if (startHour === null && endHour === null) return true;
  const start = startHour === null ? 0 : startHour;
  const end = endHour === null ? 24 : endHour;
  if (start <= end) return h >= start && h < end;
  // Window wraps midnight, e.g. 22..6: allowed if h >= start OR h < end.
  return h >= start || h < end;
}

function nextAllowedSendTime(date, sendWindow) {
  const win = normalizeWindow(sendWindow);
  if (win.startHour === null && win.endHour === null && !win.days) {
    return new Date(date.getTime());
  }

  let cur = new Date(date.getTime());

  for (let i = 0; i < MAX_ITER * 24; i++) {
    if (dayMatch(cur, win.days) && hourMatch(cur, win.startHour, win.endHour)) {
      return cur;
    }

    // Day not allowed → jump to start of next day at startHour (or 00:00).
    if (!dayMatch(cur, win.days)) {
      const next = new Date(cur.getTime());
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(win.startHour === null ? 0 : win.startHour, 0, 0, 0);
      cur = next;
      continue;
    }

    // Day allowed but hour out of range.
    const h = cur.getUTCHours();
    const start = win.startHour === null ? 0 : win.startHour;
    const end = win.endHour === null ? 24 : win.endHour;

    if (start <= end) {
      if (h < start) {
        cur = startOfHour(cur);
        cur.setUTCHours(start, 0, 0, 0);
      } else {
        // h >= end → roll to next day at start
        const next = new Date(cur.getTime());
        next.setUTCDate(next.getUTCDate() + 1);
        next.setUTCHours(start, 0, 0, 0);
        cur = next;
      }
    } else {
      // wrapping window; if neither side matched, jump forward an hour.
      cur = new Date(cur.getTime() + 60 * 60 * 1000);
      cur.setUTCMinutes(0, 0, 0);
    }
  }

  // Fail-safe: return the input unchanged rather than loop forever.
  return new Date(date.getTime());
}

module.exports = { nextAllowedSendTime, normalizeWindow };
