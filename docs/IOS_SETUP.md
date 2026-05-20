# AIWholesail iOS App — Setup & Build

The iOS app is a Capacitor wrapper around the existing React/Vite app, with
RevenueCat handling in-app subscriptions (Apple IAP, mandatory under App
Store guideline 3.1.1).

This doc covers first-time local setup, the day-to-day dev loop, and the
configuration required in App Store Connect + RevenueCat.

---

## Prerequisites

- macOS with Xcode 15+ (`xcode-select --install`)
- CocoaPods (`sudo gem install cocoapods` or `brew install cocoapods`)
- Apple Developer account (paid, $99/yr) — already set up
- An iCloud sandbox tester account for IAP testing (App Store Connect →
  Users and Access → Sandbox)
- RevenueCat account (free up to $2.5K MTR)

## One-time local setup

```bash
# 1. Install deps (root)
npm install

# 2. Build web bundle so Capacitor has something to copy
npm run build

# 3. Scaffold the native iOS Xcode project (creates ./ios/)
npx cap add ios

# 4. Install CocoaPods deps
cd ios/App && pod install && cd ../..

# 5. Open in Xcode to configure signing
npx cap open ios
```

In Xcode:
- Select the `App` target → Signing & Capabilities → check
  "Automatically manage signing", pick your team.
- Set the bundle ID to `com.aiwholesail.app` (already set in
  `capacitor.config.ts`).
- Add capabilities: **In-App Purchase**, **Push Notifications** (later),
  **Sign in with Apple** (later).

## Day-to-day dev loop

```bash
# Push web changes into the iOS bundle
npm run ios:sync

# Open Xcode (then Cmd+R to run on a simulator or device)
npm run ios:open
```

Live-reload against the dev server: temporarily set `server.url` in
`capacitor.config.ts` to your laptop's LAN IP (`http://192.168.x.x:8080`)
and run `npm run dev`. Remove `server.url` before building for release.

---

## RevenueCat configuration

### 1. App Store Connect — create the subscription products

App Store Connect → My Apps → AIWholesail → In-App Purchases → Subscriptions:

- Subscription Group: **AIWholesail Pro**
  - Product ID: `aiwholesail_pro_monthly` — Auto-renewing, monthly
  - Product ID: `aiwholesail_pro_yearly` — Auto-renewing, yearly

Non-renewing or one-time (separate from subscriptions):
- Product ID: `aiwholesail_pro_lifetime` — Non-consumable

Pricing tiers should approximate the web Stripe prices ($49/mo, $99/mo) —
note Apple keeps 15-30% so you may want to mark up for native, or accept
the smaller net.

### 2. RevenueCat dashboard

Project Settings → Apps → Add → iOS:
- Bundle ID: `com.aiwholesail.app`
- Upload your Apple App-Specific Shared Secret (App Store Connect → App
  Information → App-Specific Shared Secret)
- Upload an App Store Connect API Key (Users and Access → Keys) so RC
  can verify receipts server-side.

Entitlements → Create:
- Identifier: **`AIWHOLESAIL Pro`** (must match
  `VITE_REVENUECAT_PRO_ENTITLEMENT`, including the space)
- Attach the products created above.

Offerings → Create the default offering with packages:
- Monthly → `aiwholesail_pro_monthly`
- Annual → `aiwholesail_pro_yearly`
- Lifetime → `aiwholesail_pro_lifetime`

Paywalls → build the paywall in the dashboard editor. The app calls
`RevenueCatUI.presentPaywall()` which renders whatever you've published.

### 3. API keys

Copy the **public iOS SDK key** from RevenueCat (Project → API keys → App
specific keys → Apple). It starts with `appl_` for production or `test_`
for sandbox.

Update `.env`:
```bash
VITE_REVENUECAT_APPLE_API_KEY="appl_xxxxxxxxxxxxxxxxxxxxxxxxxx"
VITE_REVENUECAT_PRO_ENTITLEMENT="AIWHOLESAIL Pro"
```

> RC public SDK keys are designed to ship in the client bundle — they
> are not secrets. The webhook auth header (server-only) IS a secret and
> belongs in the API server env, never in `VITE_*`.

### 4. Server-side webhook (TODO)

Configure RevenueCat → Project → Integrations → Webhooks to POST to
`https://api.aiwholesail.com/api/iap/revenuecat/webhook`. The handler
should:

1. Verify the `Authorization` header against a shared secret.
2. Resolve `event.app_user_id` → internal `user_id`.
3. Upsert a row in `subscriptions` with `source = 'revenuecat'`, the
   product id, period end, and trial flag.
4. Mirror cancellations / refunds back to the row.

Until that handler exists, RC + the app know the user is Pro but the
backend doesn't — so server-gated features will still 403. Track the
handler implementation in a follow-up PR.

---

## App Store submission checklist

- App Privacy nutrition labels: declare RevenueCat data collection
  (Anonymous ID, Purchase History) and any other SDK data.
- Sign in with Apple: required if any 3rd-party auth (Google, Facebook)
  is offered.
- Restore Purchases button: present in the app (Pricing page footer).
- Manage Subscription: linked via RevenueCat Customer Center on the
  Pricing page when subscribed.
- Screenshots: 6.7" (iPhone 15 Pro Max) and 6.5" (iPhone 11 Pro Max).
- Privacy Policy + Terms URLs: live and linked from the app.
