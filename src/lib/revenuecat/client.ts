import {
  Purchases,
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from '@revenuecat/purchases-capacitor';

import {
  REVENUECAT_PRO_ENTITLEMENT,
  getRevenueCatApiKey,
  isNative,
} from './config';

let configurePromise: Promise<boolean> | null = null;
let currentAppUserId: string | null = null;

export async function ensureConfigured(): Promise<boolean> {
  if (!isNative()) return false;
  // Cache a successful or in-flight configure. A rejected configure is
  // cleared below so the next caller can retry instead of perpetually
  // re-throwing a cached rejection.
  if (configurePromise) {
    try {
      return await configurePromise;
    } catch {
      return false;
    }
  }
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn('[RevenueCat] No API key for current platform — skipping configure.');
    return false;
  }
  configurePromise = (async () => {
    try {
      if (import.meta.env.DEV) {
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      } else {
        await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
      }
      await Purchases.configure({ apiKey });
      return true;
    } catch (err) {
      console.error('[RevenueCat] configure() failed', err);
      configurePromise = null; // allow retry on next call
      return false;
    }
  })();
  return await configurePromise;
}

export async function identifyUser(appUserId: string): Promise<CustomerInfo | null> {
  const configured = await ensureConfigured();
  if (!configured) return null;
  if (currentAppUserId === appUserId) {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  }
  const { customerInfo } = await Purchases.logIn({ appUserID: appUserId });
  currentAppUserId = appUserId;
  return customerInfo;
}

export async function setUserAttributes(
  attributes: Record<string, string | null>,
): Promise<void> {
  const configured = await ensureConfigured();
  if (!configured) return;
  await Purchases.setAttributes(attributes);
}

export async function setUserEmail(email: string | null): Promise<void> {
  const configured = await ensureConfigured();
  if (!configured) return;
  await Purchases.setEmail({ email });
}

export async function resetUser(): Promise<void> {
  const configured = await ensureConfigured();
  if (!configured) return;
  await Purchases.logOut();
  currentAppUserId = null;
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  const configured = await ensureConfigured();
  if (!configured) return null;
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo;
}

export async function fetchCurrentOffering(): Promise<PurchasesOffering | null> {
  const configured = await ensureConfigured();
  if (!configured) return null;
  const { current } = await Purchases.getOfferings();
  return current ?? null;
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo | null> {
  const configured = await ensureConfigured();
  if (!configured) return null;
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  const configured = await ensureConfigured();
  if (!configured) return null;
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
}

export function hasProEntitlement(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  return Boolean(info.entitlements?.active?.[REVENUECAT_PRO_ENTITLEMENT]);
}
