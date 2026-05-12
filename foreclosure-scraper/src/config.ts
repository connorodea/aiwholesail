import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

function asInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),

  r2: {
    accountId: optional('R2_ACCOUNT_ID', ''),
    accessKeyId: optional('R2_ACCESS_KEY_ID', ''),
    secretAccessKey: optional('R2_SECRET_ACCESS_KEY', ''),
    bucket: optional('R2_BUCKET_NAME', 'foreclosure-snapshots'),
  },

  proxyUrl: process.env.PROXY_URL || undefined,

  queueConcurrency: asInt(process.env.QUEUE_CONCURRENCY, 3),
  maxPagesPerRun: asInt(process.env.MAX_PAGES_PER_RUN, 50),
  defaultRateLimitMs: asInt(process.env.DEFAULT_RATE_LIMIT_MS, 2000),

  port: asInt(process.env.PORT, 8081),
  logLevel: optional('LOG_LEVEL', 'info'),
  logPretty: asBool(process.env.LOG_PRETTY, false),

  processRole: (optional('PROCESS_ROLE', 'all') as 'all' | 'worker' | 'scheduler'),
} as const;

export const r2Configured = Boolean(
  config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey,
);
