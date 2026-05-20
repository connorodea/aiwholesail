import { Capacitor } from '@capacitor/core';

export const REVENUECAT_PRO_ENTITLEMENT =
  import.meta.env.VITE_REVENUECAT_PRO_ENTITLEMENT || 'AIWHOLESAIL Pro';

const APPLE_KEY = import.meta.env.VITE_REVENUECAT_APPLE_API_KEY || '';
const GOOGLE_KEY = import.meta.env.VITE_REVENUECAT_GOOGLE_API_KEY || '';

export type NativePlatform = 'ios' | 'android';

export function getNativePlatform(): NativePlatform | null {
  if (!Capacitor.isNativePlatform()) return null;
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : null;
}

export function isIos(): boolean {
  return getNativePlatform() === 'ios';
}

export function isAndroid(): boolean {
  return getNativePlatform() === 'android';
}

export function isNative(): boolean {
  return getNativePlatform() !== null;
}

export function getRevenueCatApiKey(): string | null {
  const platform = getNativePlatform();
  if (platform === 'ios') return APPLE_KEY || null;
  if (platform === 'android') return GOOGLE_KEY || null;
  return null;
}
