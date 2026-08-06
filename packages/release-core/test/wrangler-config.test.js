import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeWranglerInventory,
  parseWranglerConfig
} from '../src/wrangler-config.js';

const CONFIG = `name = "store-worker"
compatibility_date = "2026-07-09"
compatibility_flags = ["nodejs_compat"]

[cache]
enabled = false

[vars]
SITE_BASE = "https://shop.example"
MODE = "base"

[[kv_namespaces]]
binding = "STORE_STATE"
id = "base-id"
ignored = ["nested"]

[[r2_buckets]]
binding = "STORE_DOWNLOADS"
bucket_name = "downloads"

[exports.CachedAdminReads]
type = "worker"
[exports.CachedAdminReads.cache]
enabled = true

[env.production.vars]
MODE = "production"

[[env.production.kv_namespaces]]
binding = "STORE_STATE"
id = "production-id"

[[env.production.routes]]
pattern = "checkout.example/*"
zone_name = "example"
`;

test('parses and normalizes the exact Pool and Store Wrangler inventory contract', () => {
  assert.equal(parseWranglerConfig(CONFIG).name, 'store-worker');
  assert.deepEqual(normalizeWranglerInventory(CONFIG, { environment: 'production' }), {
    name: 'store-worker',
    environment: 'production',
    compatibilityDate: '2026-07-09',
    compatibilityFlags: ['nodejs_compat'],
    cache: { enabled: false, crossVersionCache: false },
    cachedExports: ['CachedAdminReads'],
    vars: { SITE_BASE: 'https://shop.example', MODE: 'production' },
    kvNamespaces: [{ binding: 'STORE_STATE', id: 'production-id' }],
    r2Buckets: [{ binding: 'STORE_DOWNLOADS', bucket_name: 'downloads' }],
    durableObjects: [],
    routes: [{ pattern: 'checkout.example/*', zone_name: 'example' }],
    migrations: []
  });
});

test('propagates malformed TOML instead of producing incomplete release evidence', () => {
  assert.throws(() => parseWranglerConfig('name = [not valid'));
});
