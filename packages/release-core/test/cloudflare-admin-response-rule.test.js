import assert from 'node:assert/strict';
import test from 'node:test';

import { ADMIN_RESPONSE_RULE_PHASE, createAdminResponseRuleClient } from '../src/cloudflare-admin-response-rule.js';

const policy = {
  ruleRef: 'product_admin_no_transform_v1',
  ruleDescription: 'Product admin no-transform and no-store',
  rulesetName: 'Product cache response rules',
  rulesetDescription: 'Product-managed response cache controls',
  adminPaths: ['/admin', '/es/admin'],
  publicPaths: ['/admin/', '/es/admin/']
};

test('Cloudflare response-rule factory injects only bounded consumer identity', () => {
  const client = createAdminResponseRuleClient(policy);
  const rule = client.buildAdminResponseRule('https://site.example/');
  assert.equal(client.phase, ADMIN_RESPONSE_RULE_PHASE);
  assert.equal(rule.ref, policy.ruleRef);
  assert.equal(rule.description, policy.ruleDescription);
  assert.match(rule.expression, /http\.host eq "site\.example"/);
  assert.match(rule.expression, /http\.request\.uri\.path eq "\/es\/admin"/);
  assert.equal(rule.action_parameters['no-store'].operation, 'set');
  assert.equal(client.adminResponseRuleMatches({ ...rule, id: 'provider-id' }, rule), true);
});

test('Cloudflare response-rule factory rejects unsafe policy, origins, zones, and blank tokens', async () => {
  assert.throws(() => createAdminResponseRuleClient({ ...policy, ruleRef: 'bad\nref' }), /ruleRef/);
  const client = createAdminResponseRuleClient(policy);
  assert.throws(() => client.buildAdminResponseRule('http://site.example'), /HTTPS site origin/);
  await assert.rejects(() => client.configureAdminResponseRule({ siteBase: 'https://site.example', zoneId: 'bad', token: 'token' }), /CLOUDFLARE_ZONE_ID/);
  await assert.rejects(() => client.configureAdminResponseRule({ siteBase: 'https://site.example', zoneId: 'a'.repeat(32), token: '' }), /token/);
});

test('public response-policy verification does not retain response bodies or credentials', async () => {
  const client = createAdminResponseRuleClient(policy);
  const calls = [];
  const result = await client.verifyAdminResponsePolicy({
    siteBase: 'https://site.example',
    nonce: () => 'fixed',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response('<main>safe</main>', {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store, no-transform, max-age=0, must-revalidate' }
      });
    }
  });
  assert.deepEqual(calls.map((call) => call.url), [
    'https://site.example/admin/?edge-policy-check=fixed-0',
    'https://site.example/es/admin/?edge-policy-check=fixed-1'
  ]);
  assert.ok(calls.every((call) => call.init.redirect === 'error'));
  assert.equal(result.state, 'current');
  assert.equal(result.containsResponseBodies, false);
  assert.equal(result.containsCredentials, false);
  assert.equal(JSON.stringify(result).includes('<main>'), false);
});

test('public verification fails closed on edge injection and report-only CSP', async () => {
  const client = createAdminResponseRuleClient(policy);
  await assert.rejects(() => client.verifyAdminResponsePolicy({
    siteBase: 'https://site.example',
    fetchImpl: async () => new Response('<script data-cf-beacon></script>', {
      headers: {
        'Cache-Control': 'private, no-store, no-transform, max-age=0, must-revalidate',
        'Content-Security-Policy-Report-Only': "default-src 'self'"
      }
    })
  }), /edge injection present; report-only CSP present/);
});
