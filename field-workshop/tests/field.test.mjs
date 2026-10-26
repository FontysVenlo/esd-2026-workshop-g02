import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, test } from 'node:test';
import { createStorefrontServer } from '../services/storefront.mjs';
import { initializeProxies } from '../services/proxy-init.mjs';

const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

async function serve(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}

test('real proxy-path delay increases customer latency and is recorded', async () => {
  let proxyCalls = 0;
  const inventoryProxy = await serve(async (_req, res) => {
    proxyCalls += 1;
    await new Promise(resolve => setTimeout(resolve, 120));
    json(res, 200, { quantity: 12 });
  });
  const shippingProxy = await serve((_req, res) => json(res, 200, { priceEur: 4.9, etaDays: 3 }));
  const storefront = createStorefrontServer({ inventoryUrl: inventoryProxy, shippingUrl: shippingProxy });
  await new Promise(resolve => storefront.listen(0, '127.0.0.1', resolve));
  servers.push(storefront);
  const base = `http://127.0.0.1:${storefront.address().port}`;
  const started = performance.now();
  const response = await fetch(`${base}/api/product`);
  const elapsed = performance.now() - started;
  assert.equal(response.status, 200);
  assert.ok(elapsed >= 100, `expected delay in actual request, observed ${elapsed} ms`);
  assert.equal((await response.json()).inventory.source, 'live');
  assert.equal(proxyCalls, 1);
  const metrics = await (await fetch(`${base}/metrics`)).text();
  assert.match(metrics, /workshop_http_requests_total\{service="storefront",route="\/api\/product",status="200"\} 1/);
  assert.match(metrics, /workshop_dependency_calls_total\{service="storefront",dependency="inventory",outcome="success"\} 1/);
});

test('inventory timeout fails closed or returns explicitly unconfirmed stock with fallback', async () => {
  const inventoryProxy = await serve(async (_req, res) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    json(res, 200, { quantity: 12 });
  });
  const shippingProxy = await serve((_req, res) => json(res, 200, { priceEur: 4.9 }));
  const strict = createStorefrontServer({ inventoryUrl: inventoryProxy, shippingUrl: shippingProxy, inventoryTimeoutMs: 40 });
  await new Promise(resolve => strict.listen(0, '127.0.0.1', resolve));
  servers.push(strict);
  const strictResponse = await fetch(`http://127.0.0.1:${strict.address().port}/api/product`);
  assert.equal(strictResponse.status, 504);

  const resilient = createStorefrontServer({ inventoryUrl: inventoryProxy, shippingUrl: shippingProxy, inventoryTimeoutMs: 40, inventoryFallback: true });
  await new Promise(resolve => resilient.listen(0, '127.0.0.1', resolve));
  servers.push(resilient);
  const base = `http://127.0.0.1:${resilient.address().port}`;
  const response = await fetch(`${base}/api/product`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.degraded, true);
  assert.equal(body.inventory.available, null);
  assert.equal(body.inventory.source, 'unconfirmed');
  assert.match(await (await fetch(`${base}/metrics`)).text(), /workshop_fallbacks_total\{service="storefront",dependency="inventory"\} 1/);
});

test('shipping failure affects order preview but can be isolated from inventory', async () => {
  const inventoryProxy = await serve((_req, res) => json(res, 200, { quantity: 12 }));
  const shippingProxy = await serve((_req, res) => json(res, 503, { error: 'offline' }));
  const strict = createStorefrontServer({ inventoryUrl: inventoryProxy, shippingUrl: shippingProxy });
  await new Promise(resolve => strict.listen(0, '127.0.0.1', resolve));
  servers.push(strict);
  assert.equal((await fetch(`http://127.0.0.1:${strict.address().port}/api/order-preview`)).status, 503);

  const resilient = createStorefrontServer({ inventoryUrl: inventoryProxy, shippingUrl: shippingProxy, shippingFallback: true });
  await new Promise(resolve => resilient.listen(0, '127.0.0.1', resolve));
  servers.push(resilient);
  const response = await fetch(`http://127.0.0.1:${resilient.address().port}/api/order-preview`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.inventory.source, 'live');
  assert.equal(body.shipping.source, 'unavailable');
  assert.equal(body.shipping.priceEur, null);
  assert.equal(body.degraded, true);
});

test('proxy initialization creates only fixed local service routes and is idempotent', async () => {
  const created = {};
  const api = await serve(async (req, res) => {
    if (req.method === 'GET') return json(res, 200, created);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    created[body.name] = body;
    json(res, 201, body);
  });
  await initializeProxies(api, async () => {});
  assert.equal(created.inventory.listen, '0.0.0.0:8666');
  created.inventory.listen = '[::]:8666';
  created.shipping.listen = '[::]:8667';
  await initializeProxies(api, async () => {});
  assert.deepEqual(Object.keys(created).sort(), ['inventory', 'shipping']);
  assert.equal(created.inventory.upstream, 'inventory:8080');
  assert.equal(created.shipping.upstream, 'shipping:8080');
  assert.equal(created.inventory.listen, '[::]:8666');
});
