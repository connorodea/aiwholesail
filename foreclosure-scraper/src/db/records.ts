import { PoolClient } from 'pg';
import { pool } from './index';
import { ForeclosureRecord } from '../types';

export type ForeclosureInsert = Omit<ForeclosureRecord, 'id' | 'createdAt' | 'updatedAt' | 'scrapedAt'> & {
  scrapedAt?: Date;
};

export interface UpsertResult {
  inserted: number;
  updated: number;
}

/**
 * Bulk-upsert normalized records. Conflict resolution policy:
 *   - Conflict key: (external_id, county, state, record_type)
 *   - Mutable fields (sale_date, default_amount, parcel/property/owner/lender,
 *     case_number, trustee_info, raw_data, source_url, snapshot_key) are
 *     overwritten only when the new value IS NOT NULL — so a sparser re-scrape
 *     never blanks out a previously enriched record.
 *   - created_at is never touched.
 */
export async function upsertRecords(
  records: ForeclosureInsert[],
  client?: PoolClient,
): Promise<UpsertResult> {
  if (records.length === 0) return { inserted: 0, updated: 0 };
  const exec = client ?? pool;

  let inserted = 0;
  let updated = 0;

  for (const r of records) {
    const result = await exec.query<{ xmax: string }>(
      `
      INSERT INTO foreclosure_records (
        external_id, county, state, record_type,
        parcel_number, property_address, owner_name, lender_name,
        default_amount, recorded_date, sale_date, case_number,
        trustee_info, raw_data, source_url, snapshot_key, scraped_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13::jsonb, $14::jsonb, $15, $16, COALESCE($17, NOW())
      )
      ON CONFLICT (external_id, county, state, record_type) DO UPDATE SET
        parcel_number    = COALESCE(EXCLUDED.parcel_number,    foreclosure_records.parcel_number),
        property_address = COALESCE(EXCLUDED.property_address, foreclosure_records.property_address),
        owner_name       = COALESCE(EXCLUDED.owner_name,       foreclosure_records.owner_name),
        lender_name      = COALESCE(EXCLUDED.lender_name,      foreclosure_records.lender_name),
        default_amount   = COALESCE(EXCLUDED.default_amount,   foreclosure_records.default_amount),
        recorded_date    = COALESCE(EXCLUDED.recorded_date,    foreclosure_records.recorded_date),
        sale_date        = COALESCE(EXCLUDED.sale_date,        foreclosure_records.sale_date),
        case_number      = COALESCE(EXCLUDED.case_number,      foreclosure_records.case_number),
        trustee_info     = COALESCE(EXCLUDED.trustee_info,     foreclosure_records.trustee_info),
        raw_data         = foreclosure_records.raw_data || EXCLUDED.raw_data,
        source_url       = EXCLUDED.source_url,
        snapshot_key     = COALESCE(EXCLUDED.snapshot_key,     foreclosure_records.snapshot_key),
        scraped_at       = EXCLUDED.scraped_at,
        updated_at       = NOW()
      RETURNING xmax::text
      `,
      [
        r.externalId,
        r.county,
        r.state,
        r.recordType,
        r.parcelNumber,
        r.propertyAddress,
        r.ownerName,
        r.lenderName,
        r.defaultAmount,
        r.recordedDate,
        r.saleDate,
        r.caseNumber,
        r.trusteeInfo ? JSON.stringify(r.trusteeInfo) : null,
        JSON.stringify(r.rawData ?? {}),
        r.sourceUrl,
        r.snapshotKey,
        r.scrapedAt ?? null,
      ],
    );

    // xmax = '0' means a fresh INSERT; nonzero means UPDATE path was taken.
    const xmax = result.rows[0]?.xmax ?? '0';
    if (xmax === '0') inserted += 1;
    else updated += 1;
  }

  return { inserted, updated };
}
