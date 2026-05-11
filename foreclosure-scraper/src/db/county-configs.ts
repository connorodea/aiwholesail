import { pool } from './index';
import { CountyConfigRow, RecordType } from '../types';

interface DbRow {
  id: string;
  county: string;
  state: string;
  adapter_name: string;
  base_url: string;
  record_types: string[];
  cron_schedule: string;
  rate_limit_ms: number;
  enabled: boolean;
  config_json: Record<string, unknown> | null;
}

function rowToConfig(row: DbRow): CountyConfigRow {
  return {
    id: row.id,
    county: row.county,
    state: row.state,
    adapterName: row.adapter_name,
    baseUrl: row.base_url,
    recordTypes: row.record_types as RecordType[],
    cronSchedule: row.cron_schedule,
    rateLimitMs: row.rate_limit_ms,
    enabled: row.enabled,
    configJson: row.config_json ?? {},
  };
}

export async function listEnabledConfigs(): Promise<CountyConfigRow[]> {
  const { rows } = await pool.query<DbRow>(
    `SELECT id, county, state, adapter_name, base_url, record_types,
            cron_schedule, rate_limit_ms, enabled, config_json
       FROM county_configs
      WHERE enabled = TRUE
      ORDER BY state, county`,
  );
  return rows.map(rowToConfig);
}

export async function findConfig(adapterName: string): Promise<CountyConfigRow | null> {
  const { rows } = await pool.query<DbRow>(
    `SELECT id, county, state, adapter_name, base_url, record_types,
            cron_schedule, rate_limit_ms, enabled, config_json
       FROM county_configs
      WHERE adapter_name = $1
      LIMIT 1`,
    [adapterName],
  );
  return rows[0] ? rowToConfig(rows[0]) : null;
}
