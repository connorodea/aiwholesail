/**
 * In-memory per-request metrics counter for /rapidapi/zillow/*.
 *
 * Express middleware that increments counts as requests complete, plus a
 * flush() that hands the buffer to a writer callback (typically: insert
 * one row into rapidapi_request_metrics).
 *
 * Pure module — IO is the writer's concern, injected by the caller. This
 * keeps the counter logic testable with no DB.
 *
 * Wiring (index.js):
 *   const { createCollector } = require('./lib/observability/rapidapi-metrics-collector');
 *   const collector = createCollector();
 *   app.use('/rapidapi/zillow', collector.middleware, ...);
 *   // Periodic flush (every 60s) elsewhere — see scripts/rapidapi-metrics-flush.js
 *   setInterval(() => collector.flush(writeRowToDb), 60_000);
 */

const RAPIDAPI_PATH_PREFIX = '/rapidapi/zillow';

function emptyBuffer() {
  return {
    requests_total: 0,
    requests_2xx: 0,
    requests_3xx: 0,
    requests_401_our_middleware: 0,
    requests_401_rapidapi_gateway: 0,
    requests_403: 0,
    requests_4xx_other: 0,
    requests_5xx: 0,
    requests_503_gateway_unconfigured: 0,
    latency_samples_ms: [],
  };
}

function bucketMinute(now = Date.now()) {
  const d = new Date(now);
  d.setSeconds(0, 0);
  return d;
}

function classify401(body) {
  // OUR middleware emits {success: false, error: "Invalid or missing proxy secret"}.
  // RapidAPI's gateway emits {message: "Invalid API key"} or similar.
  // Distinguishing matters because W6 fires only on OUR 401s — RapidAPI's are
  // consumer-side bad-key issues, not our problem.
  if (typeof body !== 'string') return 'rapidapi_gateway';
  if (body.includes('"success":false') || body.includes('proxy secret')) {
    return 'our_middleware';
  }
  return 'rapidapi_gateway';
}

function is503Unconfigured(body) {
  return typeof body === 'string' && body.includes('Gateway not configured');
}

function createCollector() {
  let buffer = emptyBuffer();

  function record(req, res) {
    if (!req.originalUrl || !req.originalUrl.startsWith(RAPIDAPI_PATH_PREFIX)) {
      return; // not our path; nothing to record
    }

    buffer.requests_total += 1;
    const code = res.statusCode;
    const body = res.body || '';

    if (code >= 200 && code < 300) {
      buffer.requests_2xx += 1;
    } else if (code >= 300 && code < 400) {
      buffer.requests_3xx += 1;
    } else if (code === 401) {
      if (classify401(body) === 'our_middleware') {
        buffer.requests_401_our_middleware += 1;
      } else {
        buffer.requests_401_rapidapi_gateway += 1;
      }
    } else if (code === 403) {
      buffer.requests_403 += 1;
    } else if (code >= 400 && code < 500) {
      buffer.requests_4xx_other += 1;
    } else if (code >= 500) {
      buffer.requests_5xx += 1;
      if (code === 503 && is503Unconfigured(body)) {
        buffer.requests_503_gateway_unconfigured += 1;
      }
    }
  }

  function middleware(req, res, next) {
    const started = Date.now();
    res.on('finish', () => {
      buffer.latency_samples_ms.push(Date.now() - started);
      record(req, res);
    });
    next();
  }

  function snapshot() {
    return { ...buffer, latency_samples_ms: [...buffer.latency_samples_ms] };
  }

  async function flush(writer) {
    if (buffer.requests_total === 0) return;
    const snap = snapshot();
    snap.bucket_minute = bucketMinute();
    buffer = emptyBuffer();
    await writer(snap);
  }

  return { middleware, snapshot, flush };
}

module.exports = { createCollector };
