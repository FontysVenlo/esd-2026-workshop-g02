import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, test } from 'node:test';
import { createStorefrontServer } from '../services/storefront.mjs';
import { createMitigations } from '../services/mitigations.mjs';
import { createBreaker } from '../services/breaker.mjs';

const servers = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        }),
    ),
  );
});
async function serve(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
function dependency(handler) {
  return http.createServer(async (req, res) => {
    await handler(req, res);
    if (!res.writableEnded) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ quantity: 8, priceEur: 4.9, etaDays: 3 }));
    }
  });
}
async function waitFor(base, predicate) {
  const until = Date.now() + 2000;
  while (Date.now() < until) {
    const state = await (await fetch(`${base}/api/system`)).json();
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('expected worker state did not appear');
}

test('two slow lamp calls cause a healthy product to queue and reject; mitigation contains it', async () => {
  const pending = [];
  const slow = await serve(dependency(() => new Promise((resolve) => pending.push(resolve))));
  const healthy = await serve(dependency(async () => {}));
  const mitigations = createMitigations();
  const base = await serve(
    createStorefrontServer({
      inventoryUrl: slow,
      shippingUrl: healthy,
      healthyInventoryUrl: healthy,
      mitigations,
      capacity: { queueTimeoutMs: 70 },
    }),
  );
  const lamp1 = fetch(`${base}/api/product`);
  const lamp2 = fetch(`${base}/api/product`);
  await waitFor(base, (state) => state.active === 2);
  const occupiedMetrics = await (await fetch(`${base}/metrics`)).text();
  assert.match(occupiedMetrics, /^workshop_workers_active 2$/m);
  assert.match(occupiedMetrics, /^workshop_workers_limit 2$/m);
  const healthyFailure = await fetch(`${base}/api/product?sku=CHAIR-02`);
  assert.equal(healthyFailure.status, 503, 'healthy branch should be affected by occupied workers');
  assert.equal((await (await fetch(`${base}/api/system`)).json()).rejected, 1);
  assert.match(
    await (await fetch(`${base}/metrics`)).text(),
    /^workshop_capacity_rejections_total 1$/m,
  );
  for (const resolve of pending.splice(0)) resolve();
  await Promise.all([lamp1, lamp2]);

  mitigations.apply({
    action: 'configure',
    dependency: 'inventory',
    timeoutMs: 50,
    fallback: true,
    breaker: true,
  });
  const degraded = await (await fetch(`${base}/api/product`)).json();
  assert.equal(degraded.inventory.source, 'unconfirmed');
  const system = await (await fetch(`${base}/api/system`)).json();
  assert.equal(system.circuits[0].key, 'LAMP-01:inventory');
  const pausedMetrics = await (await fetch(`${base}/metrics`)).text();
  assert.match(
    pausedMetrics,
    /workshop_circuit_state\{sku="LAMP-01",dependency="lighting-inventory"\} 1/,
  );
  assert.match(
    pausedMetrics,
    /workshop_circuit_state\{sku="CHAIR-02",dependency="seating-inventory"\} 0/,
  );
  const retry = pausedMetrics.match(
    /workshop_circuit_retry_seconds\{sku="LAMP-01",dependency="lighting-inventory"\} ([\d.]+)/,
  );
  assert.ok(Number(retry?.[1]) > 0 && Number(retry[1]) <= 5);
  // An open lamp circuit must not reject healthy product work or call the lamp.
  const callsBefore = pending.length;
  const responses = await Promise.all(
    ['LAMP-01', 'CHAIR-02', 'DESK-03'].map((sku) => fetch(`${base}/api/product?sku=${sku}`)),
  );
  const bodies = await Promise.all(responses.map((response) => response.json()));
  assert.ok(responses.every((response) => response.status === 200));
  assert.deepEqual(
    bodies.map((body) => body.inventory.source),
    ['unconfirmed', 'live', 'live'],
  );
  assert.equal(pending.length, callsBefore);
  assert.equal((await (await fetch(`${base}/api/system`)).json()).active, 0);
  for (const resolve of pending.splice(0)) resolve();
});

test('shared Shipping outage preserves stock with fallback and quotes recover after reconnect', async () => {
  let offline = true;
  const shipping = await serve(
    dependency(async (_req, res) => {
      if (offline) {
        res.writeHead(503);
        res.end('{}');
      }
    }),
  );
  const healthy = await serve(dependency(async () => {}));
  const mitigations = createMitigations();
  const base = await serve(
    createStorefrontServer({
      inventoryUrl: healthy,
      shippingUrl: shipping,
      healthyInventoryUrl: healthy,
      mitigations,
      breaker: { cooldownMs: 20 },
    }),
  );
  assert.equal((await fetch(`${base}/api/catalog?preview=true`)).status, 503);
  assert.equal((await fetch(`${base}/api/catalog`)).status, 200);
  assert.equal((await fetch(`${base}/api/order-preview?sku=CHAIR-02`)).status, 503);
  mitigations.apply({
    action: 'configure',
    dependency: 'shipping',
    timeoutMs: 400,
    fallback: true,
    breaker: true,
  });
  const response = await fetch(`${base}/api/catalog?preview=true`);
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.equal(catalog.products.length, 3);
  assert.deepEqual(
    catalog.products.map((result) => result.shipping.source),
    ['unavailable', 'unavailable', 'unavailable'],
  );
  assert.equal(catalog.products[0].shipping.priceEur, null);
  assert.ok(catalog.products.every((result) => result.inventory.source === 'live'));
  assert.deepEqual(
    catalog.circuits.map((c) => c.key),
    ['shipping'],
  );
  offline = false;
  await new Promise((resolve) => setTimeout(resolve, 25));
  await fetch(`${base}/api/order-preview?sku=CHAIR-02`); // Successful recovery probe reopens quotes for every SKU.
  const recovered = await (await fetch(`${base}/api/catalog?preview=true`)).json();
  assert.ok(recovered.products.every((result) => !result.degraded));
  assert.equal(recovered.circuits.length, 0);
  const metrics = await (await fetch(`${base}/metrics`)).text();
  assert.match(
    metrics,
    /workshop_product_duration_seconds_bucket\{service="storefront",sku="CHAIR-02"/,
  );
  assert.match(metrics, /^workshop_open_circuits 0$/m);
  assert.match(metrics, /workshop_circuit_state\{sku="all",dependency="shipping"\} 0/);
  assert.match(metrics, /workshop_circuit_retry_seconds\{sku="all",dependency="shipping"\} 0/);
  assert.equal(
    (metrics.match(/^workshop_circuit_state\{/gm) ?? []).length,
    4,
    'all paths remain visible after recovery',
  );
});

test('a circuit allows just one recovery probe and resets on success or disabled policy', async () => {
  const breaker = createBreaker({ cooldownMs: 5 });
  breaker.failure('lamp');
  assert.equal(breaker.enter('lamp', true), false);
  assert.equal(breaker.enter('chair', true), true);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(breaker.enter('lamp', true), true);
  assert.equal(breaker.enter('lamp', true), false);
  breaker.success('lamp');
  assert.equal(breaker.enter('lamp', true), true);
  breaker.failure('lamp');
  assert.equal(breaker.enter('lamp', false), true);
  assert.equal(breaker.snapshot().length, 0);
});
