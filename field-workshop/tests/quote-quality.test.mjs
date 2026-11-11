import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, test } from 'node:test';
import { createShippingServer } from '../services/shipping.mjs';
import { createInventoryServer } from '../services/inventory.mjs';
import { createStorefrontServer } from '../services/storefront.mjs';
import { createFaultConsoleServer } from '../services/fault-console.mjs';
import {
  createMitigations,
  createMitigationServer,
  defaultMitigations,
} from '../services/mitigations.mjs';

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
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
function post(base, path, body, headers = {}) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
async function checkResponse(base, dependency, validate) {
  const settings = await (await fetch(base + '/api/mitigations')).json();
  return post(base, '/api/mitigations', {
    action: 'configure',
    dependency,
    ...settings[dependency],
    validate,
  });
}
async function fixture() {
  const primary = await listen(createShippingServer('primary'));
  const lighting = await listen(createInventoryServer('lighting'));
  const backup = await listen(createShippingServer('backup'));
  const healthy = await listen(
    http.createServer((req, res) => {
      res.writeHead(req.url === '/reset' ? 204 : 200, { 'Content-Type': 'application/json' });
      res.end(
        req.url === '/reset'
          ? ''
          : JSON.stringify(
              req.url === '/proxies'
                ? {
                    inventory: { enabled: true, toxics: [] },
                    shipping: { enabled: true, toxics: [] },
                  }
                : { quantity: 12 },
            ),
      );
    }),
  );
  const mitigations = createMitigations();
  const mitigationApi = await listen(createMitigationServer(mitigations));
  const shop = await listen(
    createStorefrontServer({
      inventoryUrl: healthy,
      lightingInventoryUrl: lighting,
      inventoryControlUrl: lighting,
      shippingUrl: primary,
      backupShippingUrl: backup,
      shippingControlUrl: primary,
      toxiproxyApi: healthy,
      mitigations,
    }),
  );
  const consoleBase = await listen(
    createFaultConsoleServer({
      shippingControlUrl: primary,
      inventoryControlUrl: lighting,
      mitigationApi,
      toxiproxyApi: healthy,
    }),
  );
  return { primary, lighting, backup, shop, consoleBase, mitigations };
}

test('response faults are always available; shipping checks block bad values without fallback', async () => {
  const { primary, backup, shop, consoleBase, mitigations } = await fixture();
  assert.equal((await (await fetch(primary + '/fault')).json()).mode, 'none');
  assert.equal(
    (
      await post(
        consoleBase,
        '/api/response-fault',
        { mode: 'invalid-data' },
        { Origin: 'https://example.com' },
      )
    ).status,
    403,
  );
  assert.equal((await post(consoleBase, '/api/response-fault', { mode: 'unknown' })).status, 400);
  assert.equal(
    (await post(consoleBase, '/api/response-fault', { mode: 'invalid-data' })).status,
    200,
  );
  const values = [];
  for (let i = 0; i < 4; i++) {
    const response = await fetch(shop + '/api/order-preview?sku=CHAIR-02');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.inventory.source, 'live');
    values.push(data.shipping);
  }
  assert.equal(values[0].etaDays, -2);
  assert.equal(values[1].priceEur, null);
  assert.equal(values[1].etaDays, null);
  assert.equal(values[2].priceEur, -4.9);
  assert.equal(values[3].etaDays, 3);
  let metrics = await (await fetch(shop + '/metrics')).text();
  assert.match(
    metrics,
    /workshop_shipping_quotes_total\{service="storefront",provider="primary",outcome="invalid"\} 3/,
  );
  assert.match(
    metrics,
    /workshop_rejected_quotes_total\{service="storefront",provider="primary"\} 0/,
  );
  // Even with fallback and breaker enabled, invalid successful responses must
  // only be handled by the separate validation mechanism.
  await checkResponse(consoleBase, 'shipping', true);
  await post(consoleBase, '/api/mitigations', {
    action: 'configure',
    dependency: 'shipping',
    timeoutMs: 3000,
    fallback: true,
    breaker: true,
  });
  assert.equal(
    mitigations.snapshot().shipping.validate,
    true,
    'carrier settings preserve the independent validation setting',
  );
  assert.equal((await checkResponse(consoleBase, 'shipping', true)).status, 200);
  assert.equal((await checkResponse(consoleBase, 'shipping', 'yes')).status, 400);
  for (let i = 0; i < 4; i++) {
    const data = await (await fetch(shop + '/api/order-preview?sku=CHAIR-02')).json();
    assert.equal(data.inventory.source, 'live');
    assert.equal(data.shipping.source, i < 3 ? 'rejected' : 'live');
    if (i < 3) {
      assert.equal(data.shipping.priceEur, null);
      assert.equal(data.shipping.etaDays, null);
    }
  }
  metrics = await (await fetch(shop + '/metrics')).text();
  assert.match(
    metrics,
    /workshop_dependency_calls_total\{service="storefront",dependency="shipping",outcome="success"\} 8/,
  );
  assert.match(
    metrics,
    /workshop_rejected_quotes_total\{service="storefront",provider="primary"\} 3/,
  );
  assert.doesNotMatch(metrics, /workshop_fallbacks_total\{[^\n]*dependency="shipping"/);
  assert.doesNotMatch(
    await (await fetch(backup + '/metrics')).text(),
    /workshop_http_requests_total\{/,
  );
  assert.equal((await (await fetch(primary + '/fault')).json()).mode, 'invalid-data');
  assert.deepEqual(mitigations.snapshot().inventory, defaultMitigations.inventory);
});

test('intermittent errors fail real requests; fallback restores quotes and all reset paths clear response faults', async () => {
  const { primary, shop, consoleBase, mitigations } = await fixture();
  await post(shop, '/api/workshop/reset', { challenge: 4 });
  await post(consoleBase, '/api/response-fault', { mode: 'intermittent-errors' });
  assert.equal((await fetch(shop + '/api/order-preview?sku=DESK-03')).status, 503);
  assert.equal((await fetch(shop + '/api/order-preview?sku=DESK-03')).status, 200);
  await post(consoleBase, '/api/mitigations', {
    action: 'configure',
    dependency: 'shipping',
    timeoutMs: 3000,
    fallback: true,
    breaker: false,
  });
  const recovered = await (await fetch(shop + '/api/order-preview?sku=DESK-03')).json();
  assert.equal(recovered.shipping.source, 'backup');
  assert.equal(recovered.shipping.etaDays, 5);
  assert.equal(recovered.shipping.priceEur, 4.9);
  const reset = await post(consoleBase, '/api/action', { action: 'reset' });
  assert.equal(reset.status, 200);
  assert.equal((await (await fetch(primary + '/fault')).json()).mode, 'none');
  assert.equal(mitigations.snapshot().shipping.fallback, true);
  await post(consoleBase, '/api/response-fault', { mode: 'invalid-data' });
  await checkResponse(consoleBase, 'shipping', true);
  assert.equal((await post(shop, '/api/workshop/reset', { challenge: 4 })).status, 200);
  assert.deepEqual(mitigations.snapshot(), defaultMitigations);
  assert.equal((await (await fetch(primary + '/fault')).json()).mode, 'none');
  const normal = await (await fetch(shop + '/api/order-preview')).json();
  assert.equal(normal.shipping.etaDays, 3);
  assert.equal(normal.shipping.source, 'live');
});

test('Lighting response faults affect lamp stock only; its own response checker blocks bad counts', async () => {
  const { lighting, primary, shop, consoleBase, mitigations } = await fixture();
  assert.equal(
    (await post(consoleBase, '/api/response-fault', { proxy: 'inventory', mode: 'invalid-data' }))
      .status,
    200,
  );
  const quantities = [];
  for (let i = 0; i < 4; i++) {
    const response = await fetch(shop + '/api/order-preview?sku=LAMP-01');
    assert.equal(response.status, 200);
    const data = await response.json();
    quantities.push(data.inventory.quantity);
    assert.equal(data.shipping.source, 'live');
  }
  assert.deepEqual(quantities, [-3, null, 1.5, 12]);
  await checkResponse(consoleBase, 'inventory', true);
  for (let i = 0; i < 4; i++) {
    const data = await (await fetch(shop + '/api/product?sku=LAMP-01')).json();
    assert.equal(data.inventory.source, i < 3 ? 'rejected' : 'live');
    if (i < 3) assert.equal(data.inventory.quantity, null);
  }
  for (const sku of ['CHAIR-02', 'DESK-03']) {
    const data = await (await fetch(shop + '/api/product?sku=' + sku)).json();
    assert.equal(data.inventory.source, 'live');
  }
  const metrics = await (await fetch(shop + '/metrics')).text();
  assert.match(
    metrics,
    /workshop_rejected_inventory_responses_total\{service="storefront",dependency="lighting-inventory"\} 3/,
  );
  assert.equal(mitigations.snapshot().shipping.validate, false);
  assert.equal((await (await fetch(primary + '/fault')).json()).mode, 'none');
  await post(consoleBase, '/api/response-fault', {
    proxy: 'inventory',
    mode: 'intermittent-errors',
  });
  assert.equal((await fetch(shop + '/api/product?sku=LAMP-01')).status, 503);
  assert.equal((await fetch(shop + '/api/product?sku=LAMP-01')).status, 200);
  await post(consoleBase, '/api/action', { action: 'reset' });
  assert.equal((await (await fetch(lighting + '/fault')).json()).mode, 'none');
  assert.equal(mitigations.snapshot().inventory.validate, true);
  await post(consoleBase, '/api/response-fault', { proxy: 'inventory', mode: 'invalid-data' });
  await post(shop, '/api/workshop/reset', {});
  assert.equal((await (await fetch(lighting + '/fault')).json()).mode, 'none');
  assert.deepEqual(mitigations.snapshot(), defaultMitigations);
});
