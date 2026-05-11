import { ScraperAdapter } from '../types';
import { MaricopaAdapter } from './maricopa-az';
import { ClarkNvAdapter } from './clark-nv';
import { CookIlAdapter } from './cook-il';

/**
 * Adapter registry. Adding a new county = drop the class in this folder and
 * register it here. The scheduler and worker resolve adapters by name from
 * `county_configs.adapter_name`.
 */
const factories: Record<string, (opts: { baseUrl: string; rateLimitMs: number }) => ScraperAdapter> = {
  'maricopa-az': (opts) => new MaricopaAdapter(opts),
  'clark-nv': (opts) => new ClarkNvAdapter(opts),
  'cook-il': (opts) => new CookIlAdapter(opts),
};

export function getAdapter(
  name: string,
  opts: { baseUrl: string; rateLimitMs: number },
): ScraperAdapter {
  const factory = factories[name];
  if (!factory) {
    throw new Error(`Unknown adapter: ${name}. Known: ${Object.keys(factories).join(', ')}`);
  }
  return factory(opts);
}

export function listAdapters(): string[] {
  return Object.keys(factories);
}
