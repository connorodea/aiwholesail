/**
 * RevenueCat integration for iOS In-App Purchases.
 * Only active on native platforms — web uses Stripe.
 */
import { isNative } from './platform';

// RevenueCat public API key — set this after creating RevenueCat project
const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY || '';

// Entitlement IDs configured in RevenueCat dashboard
export const ENTITLEMENTS = {
  PRO: 'pro',
  ELITE: 'elite',
} as const;

// RevenueCat Capacitor plugin — loaded at runtime on native only.
// On web, all purchase functions are safe no-ops.
let Purchases: any = null;

// Register plugin at runtime if available (Capacitor registers native plugins on window)
function getPurchasesPlugin(): any {
  if (Purchases) return Purchases;
  try {
    // Capacitor registers native plugins on the global Capacitor.Plugins object
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.PurchasesPlugin) {
      Purchases = cap.Plugins.PurchasesPlugin;
    }
  } catch { /* not available */ }
  return Purchases;
}

export async function initPurchases(): Promise<void> {
  if (!isNative || !REVENUECAT_API_KEY) return;

  try {
    const plugin = getPurchasesPlugin();
    if (!plugin) {
      console.warn('[Purchases] RevenueCat plugin not registered');
      return;
    }
    await plugin.configure({ apiKey: REVENUECAT_API_KEY });
    Purchases = plugin;
    console.log('[Purchases] RevenueCat initialized');
  } catch (err) {
    console.warn('[Purchases] RevenueCat init failed:', err);
  }
}

export async function identifyUser(userId: string): Promise<void> {
  if (!Purchases) return;
  await Purchases.logIn({ appUserID: userId });
}

export async function getOfferings(): Promise<any> {
  if (!Purchases) return null;
  const { offerings } = await Purchases.getOfferings();
  return offerings;
}

export async function purchasePackage(pkg: any): Promise<any> {
  if (!Purchases) return null;
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return customerInfo;
  } catch (e: any) {
    if (e.userCancelled) return null;
    throw e;
  }
}

export async function getCustomerInfo(): Promise<any> {
  if (!Purchases) return null;
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo;
}

export async function checkEntitlement(entitlementId: string): Promise<boolean> {
  const info = await getCustomerInfo();
  if (!info) return false;
  return info.entitlements?.active?.[entitlementId] !== undefined;
}

export async function hasAnySubscription(): Promise<boolean> {
  const hasPro = await checkEntitlement(ENTITLEMENTS.PRO);
  const hasElite = await checkEntitlement(ENTITLEMENTS.ELITE);
  return hasPro || hasElite;
}

export async function restorePurchases(): Promise<any> {
  if (!Purchases) return null;
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
}
