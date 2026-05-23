/**
 * Tests for the RevenueCat client lifecycle in src/lib/revenuecat/client.ts.
 *
 * Strategy: mock the @revenuecat/purchases-capacitor module and the
 * Capacitor platform check via Node's module substitution. We exercise
 * the actual TS source after transpiling on the fly with esbuild — same
 * code that ships to native.
 *
 * Invariants pinned:
 *  - ensureConfigured() does not cache a rejection forever; the next call
 *    retries (regression test for the "stranded provider" review finding).
 *  - A successful configure is cached and not called twice.
 *  - Without a native platform, ensureConfigured returns false without
 *    touching the SDK.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

const SRC = path.resolve(__dirname, '../client.ts');
const CONFIG_SRC = path.resolve(__dirname, '../config.ts');

let nativePlatform = 'ios';
let apiKey = 'test_xyz';
let configureCalls = 0;
let configureShouldReject = false;

// Minimal Capacitor + Purchases stubs.
const capacitorStub = {
  Capacitor: {
    isNativePlatform: () => nativePlatform !== null && nativePlatform !== 'web',
    getPlatform: () => nativePlatform || 'web',
  },
};
const purchasesStub = {
  Purchases: {
    setLogLevel: async () => {},
    configure: async () => {
      configureCalls += 1;
      if (configureShouldReject) throw new Error('configure failed');
    },
    logIn: async () => ({ customerInfo: {} }),
    logOut: async () => {},
    getCustomerInfo: async () => ({ customerInfo: {} }),
    getOfferings: async () => ({ current: null }),
    purchasePackage: async () => ({ customerInfo: {} }),
    restorePurchases: async () => ({ customerInfo: {} }),
    setAttributes: async () => {},
    setEmail: async () => {},
    addCustomerInfoUpdateListener: async () => 'listener-id',
    removeCustomerInfoUpdateListener: async () => ({ wasRemoved: true }),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN' },
};

// Inject stubs via require resolver hooks.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '@capacitor/core') return require.resolve('node:stream');
  if (request === '@revenuecat/purchases-capacitor') return require.resolve('node:stream');
  return originalResolve.call(this, request, parent, ...rest);
};

// Intercept require() for the stubbed modules.
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (request === '@capacitor/core') return capacitorStub;
  if (request === '@revenuecat/purchases-capacitor') return purchasesStub;
  return originalRequire.call(this, request);
};

// Transpile the TS sources fresh per test via esbuild.
async function loadClientFresh() {
  // Force fresh require by clearing the cache.
  Object.keys(require.cache).forEach((k) => {
    if (k.includes('/src/lib/revenuecat/')) delete require.cache[k];
  });

  // Build config.ts and client.ts to CJS in memory.
  const result = await build({
    entryPoints: [SRC],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    write: false,
    external: ['@capacitor/core', '@revenuecat/purchases-capacitor'],
    loader: { '.ts': 'ts' },
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.VITE_REVENUECAT_APPLE_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_REVENUECAT_GOOGLE_API_KEY': '""',
      'import.meta.env.VITE_REVENUECAT_PRO_ENTITLEMENT': '"AIWHOLESAIL Pro"',
    },
  });
  const code = result.outputFiles[0].text;
  const m = { exports: {} };
  const fn = new Function('require', 'module', 'exports', code);
  fn(require, m, m.exports);
  return m.exports;
}

test('ensureConfigured: returns false on non-native platforms', async () => {
  nativePlatform = 'web';
  configureCalls = 0;
  const client = await loadClientFresh();
  const result = await client.ensureConfigured();
  assert.equal(result, false);
  assert.equal(configureCalls, 0, 'configure must not be called on web');
});

test('ensureConfigured: returns false when API key missing', async () => {
  nativePlatform = 'ios';
  apiKey = '';
  configureCalls = 0;
  const client = await loadClientFresh();
  const result = await client.ensureConfigured();
  assert.equal(result, false);
  assert.equal(configureCalls, 0);
});

test('ensureConfigured: caches success — concurrent + sequential calls configure once', async () => {
  nativePlatform = 'ios';
  apiKey = 'test_xyz';
  configureShouldReject = false;
  configureCalls = 0;
  const client = await loadClientFresh();

  // Concurrent
  const [a, b] = await Promise.all([client.ensureConfigured(), client.ensureConfigured()]);
  assert.equal(a, true);
  assert.equal(b, true);
  // Sequential after success
  const c = await client.ensureConfigured();
  assert.equal(c, true);
  assert.equal(configureCalls, 1, 'configure must be called exactly once');
});

test('ensureConfigured: a rejected configure does NOT poison subsequent calls — retry recovers', async () => {
  nativePlatform = 'ios';
  apiKey = 'test_xyz';
  configureCalls = 0;
  configureShouldReject = true;
  const client = await loadClientFresh();

  const first = await client.ensureConfigured();
  assert.equal(first, false, 'first call returns false when configure rejects');
  assert.equal(configureCalls, 1);

  // Now the native bridge "recovers" — the next call should retry.
  configureShouldReject = false;
  const second = await client.ensureConfigured();
  assert.equal(second, true, 'second call retries and succeeds');
  assert.equal(configureCalls, 2, 'configure was retried once');
});

// Cleanup module substitution so we don't leak into adjacent tests.
test.after(() => {
  Module._resolveFilename = originalResolve;
  Module.prototype.require = originalRequire;
});
