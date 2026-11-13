import { createShippingServer } from '../services/shipping.mjs';
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

test('one slow lamp call occupies the only worker and rejects healthy work; mitigation contains it', async () => {
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
  await waitFor(base, (state) => state.active === 1);
  const occupiedMetrics = await (await fetch(`${base}/metrics`)).text();
  assert.match(occupiedMetrics, /^workshop_workers_active 1$/m);
  assert.match(occupiedMetrics, /^workshop_workers_limit 1$/m);
  const healthyFailure = await fetch(`${base}/api/product?sku=CHAIR-02`);
  assert.equal(healthyFailure.status, 503, 'healthy branch should be affected by occupied workers');
  assert.equal((await (await fetch(`${base}/api/system`)).json()).rejected, 1);
  assert.match(
    await (await fetch(`${base}/metrics`)).text(),
    /^workshop_capacity_rejections_total 1$/m,
  );
  for (const resolve of pending.splice(0)) resolve();
  await lamp1;

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

test('primary Shipping outage fails over to equal-price longer delivery and recovers', async () => {
  let offline = false;
  const shipping = await serve(
    dependency(async (_req, res) => {
      if (offline) {
        res.writeHead(503);
        res.end('{}');
      }
    }),
  );
  const backup = await serve(createShippingServer('backup'));
  const healthy = await serve(dependency(async () => {}));
  const mitigations = createMitigations();
  const base = await serve(
    createStorefrontServer({
      inventoryUrl: healthy,
      shippingUrl: shipping,
      backupShippingUrl: backup,
      healthyInventoryUrl: healthy,
      mitigations,
      breaker: { cooldownMs: 20 },
    }),
  );
  const baseline = await (await fetch(`${base}/api/catalog?preview=true`)).json();
  assert.ok(
    baseline.products.every((p) => p.shipping.priceEur === 4.9 && p.shipping.etaDays === 3),
  );
  offline = true;
  const failedPreview = await (await fetch(`${base}/api/catalog?preview=true`)).json();
  assert.ok(failedPreview.products.every((item) => item.status === 503));
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
    ['backup', 'backup', 'backup'],
  );
  assert.ok(catalog.products.every((p) => p.shipping.priceEur === 4.9 && p.shipping.etaDays === 5));
  assert.ok(catalog.products.every((p) => p.degraded));
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

test('1500 ms lamp delay causes actual queue failures; timeout, fallback and breaker have separate effects', async () => {
  let lampCalls = 0;
  let healthyCalls = 0;
  let delayMs = 0;
  const slow = await serve(
    dependency(async () => {
      lampCalls++;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }),
  );
  const healthy = await serve(
    dependency(async () => {
      healthyCalls++;
    }),
  );
  const mitigations = createMitigations();
  const base = await serve(
    createStorefrontServer({
      inventoryUrl: slow,
      healthyInventoryUrl: healthy,
      shippingUrl: healthy,
      mitigations,
    }),
  );
  const catalog = async () => {
    const response = await fetch(`${base}/api/catalog`);
    assert.equal(response.status, 200, 'catalog envelope preserves individual results');
    return (await response.json()).products;
  };
  assert.ok((await catalog()).every((item) => item.inventory.source === 'live'));
  delayMs = 1500;
  // Breaker and fallback alone cannot detect or shorten a slow successful call.
  mitigations.apply({
    action: 'configure',
    dependency: 'inventory',
    timeoutMs: 3000,
    fallback: true,
    breaker: true,
  });
  const healthyBefore = healthyCalls;
  const faulted = await catalog();
  assert.equal(faulted[0].inventory.source, 'live', 'lamp eventually succeeds');
  assert.deepEqual(
    faulted.slice(1).map((item) => item.outcome),
    ['capacity', 'capacity'],
  );
  assert.equal(
    healthyCalls,
    healthyBefore,
    'queued products never reached their healthy inventory',
  );
  assert.equal((await (await fetch(`${base}/api/system`)).json()).circuits.length, 0);
  const faultMetrics = await (await fetch(`${base}/metrics`)).text();
  for (const sku of ['CHAIR-02', 'DESK-03'])
    assert.match(
      faultMetrics,
      new RegExp(
        `workshop_product_results_total\\{service="storefront",sku="${sku}",outcome="capacity"\\} 1`,
      ),
    );

  for (const breaker of [false, true]) {
    for (const fallback of [false, true]) {
      mitigations.apply({
        action: 'configure',
        dependency: 'inventory',
        timeoutMs: 400,
        fallback,
        breaker,
      });
      const before = lampCalls;
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await catalog();
        if (fallback) assert.equal(result[0].inventory.source, 'unconfirmed');
        else assert.equal(result[0].outcome, breaker && attempt ? 'circuit_open' : 'timeout');
        assert.deepEqual(
          result.slice(1).map((item) => item.inventory.source),
          ['live', 'live'],
          'timeout alone protects healthy cards',
        );
      }
      assert.equal(
        lampCalls - before,
        breaker ? 1 : 2,
        'only breaker skips repeated dependency attempts',
      );
      assert.equal((await (await fetch(`${base}/api/system`)).json()).active, 0);
    }
  }
  delayMs = 0;
  mitigations.apply({ action: 'reset' });
  assert.ok((await catalog()).every((item) => item.inventory.source === 'live'));
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
