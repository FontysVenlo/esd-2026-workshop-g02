import http from 'node:http';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { Metrics } from './metrics.mjs';

const page = readFileSync(new URL('../web/index.html', import.meta.url));
const workshopPage = readFileSync(new URL('../web/workshop.html', import.meta.url));
const toolsPage = readFileSync(new URL('../web/tools.html', import.meta.url));
const workshopApp = readFileSync(new URL('../web/workshop-app.mjs', import.meta.url));
const workshopState = readFileSync(new URL('../web/workshop-state.mjs', import.meta.url));
const siteCss = readFileSync(new URL('../web/site.css', import.meta.url));
const guideFiles = new Map([
  ['/docs/assignments.md', readFileSync(new URL('../docs/assignments.md', import.meta.url))],
  ['/docs/tool-reference.md', readFileSync(new URL('../docs/tool-reference.md', import.meta.url))],
  ['/docs/experiment-record.md', readFileSync(new URL('../docs/experiment-record.md', import.meta.url))]
]);
const product = { sku: 'LAMP-01', name: 'Desk Lamp', priceEur: 29.9 };

export function createStorefrontServer(config = {}) {
  const settings = {
    inventoryUrl: config.inventoryUrl ?? process.env.INVENTORY_URL ?? 'http://localhost:8666',
    shippingUrl: config.shippingUrl ?? process.env.SHIPPING_URL ?? 'http://localhost:8667',
    inventoryTimeoutMs: Number(config.inventoryTimeoutMs ?? process.env.INVENTORY_TIMEOUT_MS ?? 3000),
    shippingTimeoutMs: Number(config.shippingTimeoutMs ?? process.env.SHIPPING_TIMEOUT_MS ?? 3000),
    inventoryFallback: config.inventoryFallback ?? process.env.INVENTORY_FALLBACK === 'true',
    shippingFallback: config.shippingFallback ?? process.env.SHIPPING_FALLBACK === 'true'
  };
  for (const timeout of [settings.inventoryTimeoutMs, settings.shippingTimeoutMs]) {
    if (!Number.isFinite(timeout) || timeout < 1) throw new Error('Dependency timeouts must be positive milliseconds');
  }
  const metrics = new Metrics('storefront');

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

  async function stock() {
    try {
      const data = await dependency('inventory', settings.inventoryUrl, '/stock?sku=LAMP-01', settings.inventoryTimeoutMs);
      return { available: data.quantity > 0, quantity: data.quantity, source: 'live' };
    } catch (error) {
      if (!settings.inventoryFallback) throw error;
      metrics.fallback('inventory');
      // A fallback must not claim the item is in stock when the source of truth is unavailable.
      return { available: null, quantity: null, source: 'unconfirmed', warning: 'Availability cannot be confirmed.' };
    }
  }

  async function shipping() {
    try {
      const data = await dependency('shipping', settings.shippingUrl, '/quote?sku=LAMP-01', settings.shippingTimeoutMs);
      return { ...data, source: 'live' };
    } catch (error) {
      if (!settings.shippingFallback) throw error;
      metrics.fallback('shipping');
      return { method: null, priceEur: null, etaDays: null, source: 'unavailable', warning: 'Shipping quote is temporarily unavailable.' };
    }
  }

  return http.createServer(async (req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
    if (route === '/health') return send(200, { status: 'ok' });
    if (route === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      return res.end(metrics.render());
    }
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
    if (route === '/workshop-app.mjs' || route === '/workshop-state.mjs') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      return res.end(route === '/workshop-app.mjs' ? workshopApp : workshopState);
    }
    if (guideFiles.has(route)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(guideFiles.get(route));
    }
    if (route !== '/api/product' && route !== '/api/order-preview') return send(404, { error: 'Not found' });

    const started = performance.now();
    try {
      if (route === '/api/product') {
        const inventory = await stock();
        return sendApi(200, { product, inventory, degraded: inventory.source !== 'live' });
      }
      const [inventory, delivery] = await Promise.all([stock(), shipping()]);
      return sendApi(200, {
        product, inventory, shipping: delivery,
        degraded: inventory.source !== 'live' || delivery.source !== 'live',
        note: 'Preview only. No order is placed.'
      });
    } catch (error) {
      return sendApi(error.outcome === 'timeout' ? 504 : 503, {
        error: 'Order information is temporarily unavailable.',
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
  createStorefrontServer().listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}
