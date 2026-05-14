#!/usr/bin/env node
/**
 * verify-resend-domains.js
 *
 * Polls the Resend CLI to verify that the aiwholesail subdomain Resend domains
 * have moved from `not_started` -> `verified` after DNS records propagate.
 *
 * Behavior:
 *   - For each domain, every 30s:
 *       1. `resend domains verify <id>`  (kick re-verification)
 *       2. `resend domains get <id>`     (read current status)
 *       3. Log `[timestamp] <domain> -> status=<status>`
 *   - Stop polling a domain once its status is `verified` or `failure`.
 *   - Exit 0 when both domains are `verified`.
 *   - Exit 1 if either domain reports `failure`.
 *   - Exit 2 after a 30-minute hard timeout.
 *
 * Self-contained: no npm install required. Uses only Node built-ins.
 */

'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const POLL_INTERVAL_MS = 30 * 1000;       // 30 seconds
const HARD_TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes

const DOMAINS = [
  {
    name: 'notifications.aiwholesail.com',
    id: '3f533f47-7ea9-4c57-a2d8-9a78f704e668',
    status: 'unknown',
    done: false,
  },
  {
    name: 'send.aiwholesail.com',
    id: 'e8329920-63ab-4182-af91-ceada5bf72f6',
    status: 'unknown',
    done: false,
  },
];

const TERMINAL_STATUSES = new Set(['verified', 'failure']);

function ts() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

function logErr(msg) {
  console.error(`[${ts()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Try to extract a `status` field from arbitrary text that may or may not be
 * pure JSON. Resend CLI output formats vary across versions, so we are lenient.
 */
function parseStatus(stdout) {
  if (!stdout) return null;
  const trimmed = stdout.trim();

  // Try direct JSON parse first.
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === 'object') {
      if (typeof obj.status === 'string') return obj.status;
      if (obj.data && typeof obj.data.status === 'string') return obj.data.status;
    }
  } catch (_) {
    // not pure JSON, fall through
  }

  // Try to locate a JSON object substring.
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const obj = JSON.parse(slice);
      if (obj && typeof obj === 'object') {
        if (typeof obj.status === 'string') return obj.status;
        if (obj.data && typeof obj.data.status === 'string') return obj.data.status;
      }
    } catch (_) {
      // fall through
    }
  }

  // Last-resort regex.
  const m = trimmed.match(/"status"\s*:\s*"([^"]+)"/);
  if (m) return m[1];

  return null;
}

async function runResend(args) {
  try {
    const { stdout, stderr } = await execAsync(`resend ${args}`, {
      maxBuffer: 4 * 1024 * 1024,
    });
    return { ok: true, stdout: stdout || '', stderr: stderr || '' };
  } catch (err) {
    return {
      ok: false,
      stdout: (err && err.stdout) || '',
      stderr: (err && err.stderr) || (err && err.message) || 'unknown error',
    };
  }
}

async function pollDomain(domain) {
  // 1. Trigger re-verification (best-effort; do not fail the loop on this).
  const verifyResult = await runResend(`domains verify ${domain.id}`);
  if (!verifyResult.ok) {
    logErr(`${domain.name} -> verify trigger failed: ${verifyResult.stderr.trim()}`);
  }

  // 2. Read current status.
  const getResult = await runResend(`domains get ${domain.id}`);
  if (!getResult.ok) {
    logErr(`${domain.name} -> get failed: ${getResult.stderr.trim()}`);
    return;
  }

  const status = parseStatus(getResult.stdout);
  if (!status) {
    logErr(`${domain.name} -> could not parse status from output: ${getResult.stdout.trim().slice(0, 200)}`);
    return;
  }

  domain.status = status;
  log(`${domain.name} -> status=${status}`);

  if (TERMINAL_STATUSES.has(status)) {
    domain.done = true;
  }
}

async function main() {
  const start = Date.now();
  log(`Starting Resend domain verification poll for ${DOMAINS.length} domains.`);
  log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s, hard timeout: ${HARD_TIMEOUT_MS / 60000}m`);

  while (true) {
    // Hard timeout check.
    if (Date.now() - start >= HARD_TIMEOUT_MS) {
      logErr('Hard timeout reached (30 minutes). Exiting with code 2.');
      for (const d of DOMAINS) {
        logErr(`  final: ${d.name} status=${d.status} done=${d.done}`);
      }
      process.exit(2);
    }

    // Poll all not-yet-done domains in parallel.
    const pending = DOMAINS.filter((d) => !d.done);
    if (pending.length === 0) {
      break; // all terminal
    }

    await Promise.all(pending.map(pollDomain));

    // Determine exit conditions.
    const anyFailure = DOMAINS.some((d) => d.status === 'failure');
    if (anyFailure) {
      logErr('At least one domain reported `failure`. Exiting with code 1.');
      for (const d of DOMAINS) {
        logErr(`  final: ${d.name} status=${d.status}`);
      }
      process.exit(1);
    }

    const allVerified = DOMAINS.every((d) => d.status === 'verified');
    if (allVerified) {
      break;
    }

    // Wait before next poll cycle.
    await sleep(POLL_INTERVAL_MS);
  }

  // Final assessment.
  const allVerified = DOMAINS.every((d) => d.status === 'verified');
  if (allVerified) {
    log('All domains verified. Exiting 0.');
    for (const d of DOMAINS) {
      log(`  final: ${d.name} status=${d.status}`);
    }
    process.exit(0);
  }

  // Mixed terminal (e.g., some verified, some failure handled above) — defensive.
  logErr('Loop ended without all domains verified. Exiting 1.');
  for (const d of DOMAINS) {
    logErr(`  final: ${d.name} status=${d.status}`);
  }
  process.exit(1);
}

main().catch((err) => {
  logErr(`Unhandled error: ${(err && err.stack) || err}`);
  process.exit(1);
});
