import pseoCopy from '@/data/generated/pseo-copy.json';

export interface PseoEntry {
  intro: string;
  insights: string[];
  callout: string;
  generatedAt: string;
  model: string;
}

const entries = pseoCopy as Record<string, PseoEntry>;

export function getPseoCopy(routeKey: string): PseoEntry | null {
  return entries[routeKey] ?? null;
}
