import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { config, r2Configured } from '../config';
import { logger } from '../logger';

/**
 * R2 is S3-API compatible. We write raw HTML snapshots so that if we improve
 * adapter selectors later, we can re-parse from snapshot without re-scraping
 * the source. Keys:
 *   raw/{state}/{county}/{recordType}/{YYYY-MM-DD}/page-{n}-{externalId}.html
 *
 * If R2 isn't configured (no creds set), snapshot writes become no-ops and
 * adapters get back `null` for snapshotKey — the records still flow.
 */

let _client: S3Client | null = null;

function client(): S3Client | null {
  if (!r2Configured) return null;
  if (_client) return _client;
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
  return _client;
}

export function buildSnapshotKey(parts: {
  state: string;
  county: string;
  recordType: string;
  date: string;
  page: number;
  externalId: string;
}): string {
  const safeId = parts.externalId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `raw/${parts.state}/${parts.county}/${parts.recordType}/${parts.date}/page-${parts.page}-${safeId}.html`;
}

export async function putSnapshot(key: string, html: string): Promise<string | null> {
  const c = client();
  if (!c) return null;
  try {
    await c.send(
      new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
        Body: html,
        ContentType: 'text/html; charset=utf-8',
      }),
    );
    return key;
  } catch (err) {
    logger.warn({ err, key }, 'R2 putSnapshot failed — continuing without snapshot');
    return null;
  }
}

export async function getSnapshot(key: string): Promise<string | null> {
  const c = client();
  if (!c) return null;
  try {
    const resp = await c.send(new GetObjectCommand({ Bucket: config.r2.bucket, Key: key }));
    const body = await resp.Body?.transformToString();
    return body ?? null;
  } catch (err) {
    logger.warn({ err, key }, 'R2 getSnapshot failed');
    return null;
  }
}
