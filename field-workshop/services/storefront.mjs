import http from 'node:http';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { Metrics } from './metrics.mjs';
import { createMitigations, createMitigationServer } from './mitigations.mjs';
import { renderPage, serveContentAsset } from './web-content.mjs';
import { products, inventoryCategory } from './catalog.mjs';
import { createCapacity } from './capacity.mjs';
import { createBreaker } from './breaker.mjs';

const page = renderPage('index.html');
const workshopPage = renderPage('workshop.html');
const toolsPage = renderPage('tools.html');
const siteCss = readFileSync(new URL('../build/site.css', import.meta.url));
const guideFiles = new Map([
  ['/docs/assignments.md', readFileSync(new URL('../docs/assignments.md', import.meta.url))],
  ['/docs/tool-reference.md', readFileSync(new URL('../docs/tool-reference.md', import.meta.url))],
  ['/docs/experiment-record.md', readFileSync(new URL('../docs/experiment-record.md', import.meta.url))]
]);

export function createStorefrontServer(config = {}) {
  const settings = {
    inventoryUrls: {
      lighting: config.lightingInventoryUrl ?? process.env.LIGHTING_INVENTORY_URL ?? config.inventoryUrl ?? 'http://localhost:8666',
      seating: config.seatingInventoryUrl ?? process.env.SEATING_INVENTORY_URL ?? config.healthyInventoryUrl ?? config.inventoryUrl ?? 'http://localhost:8668',
      desks: config.desksInventoryUrl ?? process.env.DESKS_INVENTORY_URL ?? config.healthyInventoryUrl ?? config.inventoryUrl ?? 'http://localhost:8670'
    },
    shippingUrl: config.shippingUrl ?? process.env.SHIPPING_URL ?? 'http://localhost:8667',
    healthyShippingUrl: config.healthyShippingUrl ?? process.env.HEALTHY_SHIPPING_URL ?? config.shippingUrl ?? 'http://localhost:8669',
    inventoryTimeoutMs: Number(config.inventoryTimeoutMs ?? process.env.INVENTORY_TIMEOUT_MS ?? 3000),
    shippingTimeoutMs: Number(config.shippingTimeoutMs ?? process.env.SHIPPING_TIMEOUT_MS ?? 3000),
    inventoryFallback: config.inventoryFallback ?? process.env.INVENTORY_FALLBACK === 'true',
    shippingFallback: config.shippingFallback ?? process.env.SHIPPING_FALLBACK === 'true'
  };
  for (const timeout of [settings.inventoryTimeoutMs, settings.shippingTimeoutMs]) {
    if (!Number.isFinite(timeout) || timeout < 1) throw new Error('Dependency timeouts must be positive milliseconds');
  }
  const mitigations = config.mitigations ?? createMitigations({
    inventory: { timeoutMs: settings.inventoryTimeoutMs, fallback: settings.inventoryFallback },
    shipping: { timeoutMs: settings.shippingTimeoutMs, fallback: settings.shippingFallback }
  });
  const metrics = new Metrics('storefront');
  const capacity = createCapacity(config.capacity);
  const breaker = createBreaker(config.breaker);
  let previousPolicy = JSON.stringify(mitigations.snapshot());

  async function dependency(name, baseUrl, path, timeoutMs) {
    const started = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`Dependency returned ${response.status}`);
      const body = await response.json();
      metrics.dependency(name, 'success', (performance.now() - started) / 1000);
      return body;
    } catch (error) {
      const outcome = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'failure';
      metrics.dependency(name, outcome, (performance.now() - started) / 1000);
      const failure = new Error(`${name} ${outcome}`);
      failure.outcome = outcome;
      throw failure;
    }
  }

  async function call(name, sku, policy) {
    const key = `${sku}:${name}`;
    if (!breaker.enter(key, policy.fallback)) {
      throw Object.assign(new Error(`${name} circuit_open`), { outcome: 'circuit_open' });
    }
    const baseUrl = name === 'inventory' ? settings.inventoryUrls[inventoryCategory[sku]]
      : sku === 'LAMP-01' ? settings.shippingUrl : settings.healthyShippingUrl;
    const service = name === 'inventory' ? inventoryCategory[sku] + '-inventory' : name;
    try {
      const result = await dependency(service, baseUrl, `${name === 'inventory' ? '/stock' : '/quote'}?sku=${sku}`, policy.timeoutMs);
      breaker.success(key);
      return result;
    } catch (error) {
      if (policy.fallback) breaker.failure(key);
      throw error;
    }
  }

  async function stock(policy, sku) {
    try {
      const data = await call('inventory', sku, policy);
      return { available: data.quantity > 0, quantity: data.quantity, source: 'live' };
    } catch (error) {
      if (!policy.fallback) throw error;
      metrics.fallback(inventoryCategory[sku] + '-inventory');
      // A fallback must not claim the item is in stock when the source of truth is unavailable.
      return { available: null, quantity: null, source: 'unconfirmed', warning: "Availability cannot be confirmed." };
    }
  }

  async function shipping(policy, sku) {
    try {
      const data = await call('shipping', sku, policy);
      return { ...data, source: 'live' };
    } catch (error) {
      if (!policy.fallback) throw error;
      metrics.fallback('shipping');
      return { method: null, priceEur: null, etaDays: null, source: 'unavailable', warning: "Shipping quote is temporarily unavailable." };
    }
  }

  async function productResult(product, preview, policy) {
    const queuedAt = performance.now();
    let release;
    try {
      release = await capacity.acquire();
      const queueMs = Math.round(performance.now() - queuedAt);
      // Wait for both calls to settle before releasing a real worker. A failed
      // Shipping call must not hide an Inventory request still using capacity.
      const results = await Promise.allSettled([
        stock(policy.inventory, product.sku),
        ...(preview ? [shipping(policy.shipping, product.sku)] : [])
      ]);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      const inventory = results[0].value;
      const delivery = results[1]?.value;
      const { quantity: _quantity, ...description } = product;
      return { product: description, inventory, ...(delivery ? { shipping: delivery } : {}),
        degraded: inventory.source !== 'live' || Boolean(delivery && delivery.source !== 'live'), queueMs };
    } finally {
      release?.();
      metrics.product(product.sku, (performance.now() - queuedAt) / 1000);
    }
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;
    if (req.method !== 'GET') return send(405, { error: "Method not allowed" });
    if (route === '/health') return send(200, { status: 'ok' });
    if (route === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      const state = capacity.snapshot();
      const circuits = new Map(breaker.snapshot().map(circuit => [circuit.key, circuit]));
      const circuitMetrics = products().flatMap(product => ['inventory', 'shipping'].flatMap(dependency => {
        const circuit = circuits.get(`${product.sku}:${dependency}`);
        const service = dependency === 'inventory' ? inventoryCategory[product.sku] + '-inventory' : dependency;
        const labels = `sku="${product.sku}",dependency="${service}"`;
        return [
          `workshop_circuit_state{${labels}} ${circuit ? circuit.probing ? 2 : 1 : 0}`,
          `workshop_circuit_retry_seconds{${labels}} ${(circuit?.retryInMs ?? 0) / 1000}`
        ];
      }));
      return res.end(metrics.render() + [
        '# TYPE workshop_workers_active gauge', `workshop_workers_active ${state.active}`,
        '# TYPE workshop_workers_limit gauge', `workshop_workers_limit ${state.limit}`,
        '# TYPE workshop_workers_queued gauge', `workshop_workers_queued ${state.queued}`,
        '# TYPE workshop_capacity_rejections_total counter', `workshop_capacity_rejections_total ${state.rejected}`,
        '# TYPE workshop_open_circuits gauge', `workshop_open_circuits ${circuits.size}`,
        '# HELP workshop_circuit_state Product dependency circuit: 0 closed, 1 paused, 2 probing.',
        '# TYPE workshop_circuit_state gauge',
        '# HELP workshop_circuit_retry_seconds Seconds until a product dependency recovery probe is eligible.',
        '# TYPE workshop_circuit_retry_seconds gauge', ...circuitMetrics, ''
      ].join('\n'));
    }
    if (route === '/api/system') return send(200, { ...capacity.snapshot(), circuits: breaker.snapshot() });
    if (route === '/storefront') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    if (route === '/' || route === '/workshop' || route === '/workshop/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(workshopPage);
    }
    if (route === '/tools') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(toolsPage);
    }
    if (route === '/site.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      return res.end(siteCss);
    }
    if (serveContentAsset(route, res)) return;
    if (guideFiles.has(route)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(guideFiles.get(route));
    }
    if (!['/api/product', '/api/order-preview', '/api/catalog'].includes(route)) return send(404, { error: "Not found" });

    const started = performance.now();
    // Keep one consistent policy for the entire customer request, even if the
    // operator changes settings while a dependency request is in flight.
    const policy = mitigations.snapshot();
    const currentPolicy = JSON.stringify(policy);
    if (currentPolicy !== previousPolicy) { breaker.reset(); previousPolicy = currentPolicy; }
    try {
      if (route === '/api/catalog') {
        // The catalog is one customer response. Without fallback, one missing
        // product rejects the complete view, demonstrating error propagation.
        const results = await Promise.allSettled(products().map(product => productResult(product, url.searchParams.get('preview') === 'true', policy)));
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
        return sendApi(200, { products: results.map(result => result.value), system: capacity.snapshot(), circuits: breaker.snapshot() });
      }
      const product = products().find(product => product.sku === (url.searchParams.get('sku') ?? 'LAMP-01'));
      if (!product) return sendApi(404, { error: "Not found" });
      const result = await productResult(product, route === '/api/order-preview', policy);
      return sendApi(200, { ...result, note: "Preview only. No order is placed." });
    } catch (error) {
      return sendApi(error.outcome === 'timeout' ? 504 : 503, {
        error: (error.outcome === 'capacity' ? "The shop is busy. Please try again shortly." : route === '/api/catalog' ? "The catalog could not be refreshed. Please try again or check a product individually." : "Product information is temporarily unavailable."),
        failedDependency: error.message.split(' ')[0]
      });
    }

    function sendApi(status, body) {
      metrics.request(route, status, (performance.now() - started) / 1000);
      send(status, body);
    }

    function send(status, body) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mitigations = createMitigations({
    inventory: { timeoutMs: Number(process.env.INVENTORY_TIMEOUT_MS ?? 3000), fallback: process.env.INVENTORY_FALLBACK === 'true' },
    shipping: { timeoutMs: Number(process.env.SHIPPING_TIMEOUT_MS ?? 3000), fallback: process.env.SHIPPING_FALLBACK === 'true' }
  });
  createStorefrontServer({ mitigations }).listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
  createMitigationServer(mitigations).listen(Number(process.env.MITIGATION_PORT ?? 8081), '0.0.0.0');
}
