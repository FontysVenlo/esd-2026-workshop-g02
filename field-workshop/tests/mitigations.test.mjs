import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, test } from 'node:test';
import { createMitigations, createMitigationServer, defaultMitigations } from '../services/mitigations.mjs';
import { createStorefrontServer } from '../services/storefront.mjs';
import { createFaultConsoleServer } from '../services/fault-console.mjs';

const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});
async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
async function fixture(inventoryHandler = (_req, res) => json(res, 200, { quantity: 12 })) {
  const inventoryUrl = await listen(http.createServer(inventoryHandler));
  const shippingUrl = await listen(http.createServer((_req, res) => json(res, 503, { error: 'provider offline' })));
  const mitigations = createMitigations();
  const mitigationApi = await listen(createMitigationServer(mitigations));
  const storefront = await listen(createStorefrontServer({ inventoryUrl, shippingUrl, mitigations }));
  let faultCalls = 0;
  const toxiproxyApi = await listen(http.createServer((_req, res) => { faultCalls++; json(res, 500, {}); }));
  const consoleBase = await listen(createFaultConsoleServer({ mitigationApi, toxiproxyApi }));
  const apply = (body, headers = {}) => fetch(`${consoleBase}/api/mitigations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
  });
  return { storefront, consoleBase, mitigations, apply, faultCalls: () => faultCalls };
}

test('browser settings change actual stock responses without restarting or changing faults', async () => {
  const { storefront, consoleBase, apply, faultCalls } = await fixture(async (_req, res) => {
    await new Promise(resolve => setTimeout(resolve, 120));
    json(res, 200, { quantity: 12 });
  });
  const initial = await (await fetch(`${consoleBase}/api/mitigations`)).json();
  assert.deepEqual(initial, defaultMitigations);
  assert.equal((await (await fetch(`${storefront}/api/product`)).json()).inventory.source, 'live');
  const response = await apply({ action: 'configure', dependency: 'inventory', timeoutMs: 50, fallback: true });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).shipping, defaultMitigations.shipping);
  const fallback = await fetch(`${storefront}/api/product`);
  assert.equal(fallback.status, 200);
  assert.deepEqual((await fallback.json()).inventory, { available: null, quantity: null, source: 'unconfirmed', warning: 'Availability cannot be confirmed.' });
  assert.match(await (await fetch(`${storefront}/metrics`)).text(), /workshop_fallbacks_total\{service="storefront",dependency="inventory"\} 1/);
  assert.equal(faultCalls(), 0, 'a mitigation must not remove or replace the injected fault');
  assert.equal((await apply({ action: 'reset' })).status, 200);
  assert.equal((await (await fetch(`${storefront}/api/product`)).json()).inventory.source, 'live');
});

test('Shipping fallback preserves a useful preview and disabling it restores failure', async () => {
  const { storefront, apply } = await fixture();
  assert.equal((await fetch(`${storefront}/api/order-preview`)).status, 503);
  await apply({ action: 'configure', dependency: 'shipping', timeoutMs: 3000, fallback: true });
  const response = await fetch(`${storefront}/api/order-preview`);
  assert.equal(response.status, 200);
  const preview = await response.json();
  assert.equal(preview.inventory.source, 'live');
  assert.equal(preview.shipping.source, 'unavailable');
  assert.equal(preview.shipping.priceEur, null);
  assert.equal(preview.shipping.etaDays, null);
  assert.equal((await fetch(`${storefront}/api/product`)).status, 200);
  await apply({ action: 'configure', dependency: 'shipping', timeoutMs: 3000, fallback: false });
  assert.equal((await fetch(`${storefront}/api/order-preview`)).status, 503);
});

test('settings reject invalid and cross-origin changes without changing active policy', async () => {
  const { consoleBase, mitigations, apply } = await fixture();
  for (const input of [
    { action: 'configure', dependency: 'external', timeoutMs: 400, fallback: true },
    { action: 'configure', dependency: 'inventory', timeoutMs: 0, fallback: true },
    { action: 'configure', dependency: 'inventory', timeoutMs: 5001, fallback: true },
    { action: 'configure', dependency: 'inventory', timeoutMs: 1.5, fallback: true },
    { action: 'configure', dependency: 'inventory', timeoutMs: 400, fallback: 'true' },
    { action: 'configure', dependency: 'inventory', timeoutMs: 400, fallback: true, command: 'anything' },
    { action: 'reset', dependency: 'inventory' }, null, []
  ]) assert.equal((await apply(input)).status, 400);
  assert.equal((await apply({ action: 'reset' }, { Origin: 'http://evil.example' })).status, 403);
  assert.equal((await apply({ action: 'reset' }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await fetch(`${consoleBase}/api/mitigations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await fetch(`${consoleBase}/api/mitigations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(1025) })).status, 413);
  assert.deepEqual(mitigations.snapshot(), defaultMitigations);
  assert.equal((await fetch(`${consoleBase}/api/mitigations`, { method: 'PUT' })).status, 405);
});

test('an in-flight customer request keeps its original policy when settings change', async () => {
  let notifyStarted;
  let release;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const { storefront, apply } = await fixture(async (_req, res) => {
    notifyStarted();
    await gate;
    json(res, 503, { error: 'offline' });
  });
  const pending = fetch(`${storefront}/api/product`);
  await started;
  await apply({ action: 'configure', dependency: 'inventory', timeoutMs: 400, fallback: true });
  release();
  assert.equal((await pending).status, 503, 'the already-running request began without fallback');
  const next = await fetch(`${storefront}/api/product`);
  assert.equal(next.status, 200);
  assert.equal((await next.json()).inventory.source, 'unconfirmed');
});

test('the public customer server does not expose the settings listener', async () => {
  const { storefront } = await fixture();
  assert.equal((await fetch(`${storefront}/settings`)).status, 404);
  assert.equal((await fetch(`${storefront}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"reset"}' })).status, 405);
});
