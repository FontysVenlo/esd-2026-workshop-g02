import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, test } from 'node:test';
import { createStorefrontServer } from '../services/storefront.mjs';
import {
  createMitigations,
  createMitigationServer,
  defaultMitigations,
} from '../services/mitigations.mjs';
import { createFaultConsoleServer } from '../services/fault-console.mjs';
import { CUSTOMER_REQUEST_TIMEOUT_MS } from '../src/shared/request-limits.js';

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
async function listen(server) {
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

test('reset drains old work, coalesces concurrent callers and clears old cache and circuits', async () => {
  const gate = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const firstReset = Promise.withResolvers();
  const secondReset = Promise.withResolvers();
  let invalid = false;
  let inventoryCalls = 0;
  let shippingCalls = 0;
  let controlCalls = 0;
  const inventoryUrl = await listen(
    http.createServer(async (_req, res) => {
      inventoryCalls++;
      const call = inventoryCalls;
      entered.resolve();
      if (!invalid) await gate.promise;
      json(res, call === 2 ? 503 : 200, { quantity: invalid ? -3 : 12 });
    }),
  );
  const shippingUrl = await listen(
    http.createServer(async (_req, res) => {
      shippingCalls++;
      const call = shippingCalls;
      if (!invalid) await gate.promise;
      json(res, call === 2 ? 503 : 200, {
        priceEur: invalid ? -4.9 : 4.9,
        etaDays: invalid ? -2 : 3,
      });
    }),
  );
  const toxiproxyApi = await listen(
    http.createServer((_req, res) => {
      controlCalls++;
      json(res, 200, {});
    }),
  );
  const mitigations = createMitigations();
  for (const dependency of ['inventory', 'shipping'])
    mitigations.apply({
      action: 'configure',
      dependency,
      timeoutMs: 3000,
      fallback: false,
      breaker: true,
    });
  const server = createStorefrontServer({ inventoryUrl, shippingUrl, toxiproxyApi, mitigations });
  const mitigationApi = await listen(createMitigationServer(mitigations));
  const consoleBase = await listen(
    createFaultConsoleServer({
      mitigationApi,
      toxiproxyApi,
      inventoryControlUrl: inventoryUrl,
      shippingControlUrl: shippingUrl,
    }),
  );
  let resetRequests = 0;
  server.on('request', (req) => {
    if (req.url === '/api/workshop/reset') {
      resetRequests++;
      (resetRequests === 1 ? firstReset : secondReset).resolve();
    }
  });
  const shop = await listen(server);
  const first = fetch(shop + '/api/order-preview');
  await entered.promise;
  const queued = fetch(shop + '/api/order-preview');
  // Observe admission rather than depending on an arbitrary sleep.
  for (let attempt = 0; ; attempt++) {
    const system = await (await fetch(shop + '/api/system')).json();
    if (system.queued === 1) break;
    assert.ok(attempt < 100, 'the second old request should enter the worker queue');
  }
  const reset = () =>
    fetch(shop + '/api/workshop/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  const resetOne = reset();
  await firstReset.promise;
  const resetTwo = reset();
  await secondReset.promise;
  try {
    assert.equal(controlCalls, 0, 'fault cleanup must wait for the existing requests');
    const blocked = await fetch(shop + '/api/product?sku=CHAIR-02');
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).outcome, 'resetting');
    assert.equal(inventoryCalls, 1, 'new traffic must not start more dependency work');
    for (const [path, body] of [
      ['/api/action', { action: 'disconnect', proxy: 'inventory' }],
      ['/api/response-fault', { proxy: 'inventory', mode: 'invalid-data' }],
      [
        '/api/mitigations',
        { action: 'configure', dependency: 'inventory', timeoutMs: 400, fallback: true },
      ],
    ]) {
      const mutation = await fetch(consoleBase + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(mutation.status, 409, `${path} must not change the experiment during reset`);
    }
    assert.equal(controlCalls, 0);
  } finally {
    gate.resolve();
  }
  assert.equal((await first).status, 200);
  assert.equal((await queued).status, 503);
  assert.equal((await resetOne).status, 200);
  assert.equal((await resetTwo).status, 200);
  assert.equal(controlCalls, 1, 'overlapping reset callers must share one cleanup');
  assert.deepEqual(mitigations.snapshot(), defaultMitigations);
  const system = await (await fetch(shop + '/api/system')).json();
  assert.equal(system.active, 0);
  assert.equal(system.queued, 0);
  assert.deepEqual(system.circuits, []);
  invalid = true;
  for (const dependency of ['inventory', 'shipping'])
    mitigations.apply({
      action: 'configure',
      dependency,
      timeoutMs: 3000,
      fallback: false,
      validate: true,
    });
  const next = await (await fetch(shop + '/api/order-preview')).json();
  assert.equal(next.inventory.source, 'rejected', 'no old stock may populate the new cache');
  assert.equal(next.shipping.source, 'rejected', 'no old quote may populate the new cache');
  assert.equal(controlCalls, 1, 'there must be no later cleanup of the new experiment');
});

test('the customer budget accommodates a slow primary and a slow backup beyond six seconds', async () => {
  const inventoryUrl = await listen(
    http.createServer((_req, res) => json(res, 200, { quantity: 12 })),
  );
  const shippingUrl = await listen(
    http.createServer(async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
      json(res, 503, {});
    }),
  );
  const backupShippingUrl = await listen(
    http.createServer(async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
      json(res, 200, { priceEur: 4.9, etaDays: 5 });
    }),
  );
  const shop = await listen(
    createStorefrontServer({
      inventoryUrl,
      shippingUrl,
      backupShippingUrl,
      shippingTimeoutMs: 5000,
      shippingFallback: true,
    }),
  );
  const response = await fetch(shop + '/api/order-preview', {
    signal: AbortSignal.timeout(CUSTOMER_REQUEST_TIMEOUT_MS),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).shipping.source, 'backup');
});
