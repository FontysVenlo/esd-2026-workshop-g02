import { readPageCopy } from './page-copy.mjs';
import { format } from '../src/shared/copy.js';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { Metrics } from './metrics.mjs';
import { createMitigations, createMitigationServer } from './mitigations.mjs';
import { pageReader, serveContentAsset } from './web-content.mjs';
import { products, inventoryCategory } from './catalog.mjs';
import { createCapacity } from './capacity.mjs';
import { createBreaker } from './breaker.mjs';

const page = pageReader('index.html');
const workshopPage = pageReader('workshop.html');
const toolsPage = pageReader('tools.html');
const guideFiles = new Map([
  ['/docs/assignments.md', readFileSync(new URL('../docs/assignments.md', import.meta.url))],
  ['/docs/tool-reference.md', readFileSync(new URL('../docs/tool-reference.md', import.meta.url))],
  [
    '/docs/experiment-record.md',
    readFileSync(new URL('../docs/experiment-record.md', import.meta.url)),
  ],
]);

export function createStorefrontServer(config = {}) {
  const settings = {
    inventoryUrls: {
      lighting:
        config.lightingInventoryUrl ??
        process.env.LIGHTING_INVENTORY_URL ??
        config.inventoryUrl ??
        'http://localhost:8666',
      seating:
        config.seatingInventoryUrl ??
        process.env.SEATING_INVENTORY_URL ??
        config.healthyInventoryUrl ??
        config.inventoryUrl ??
        'http://localhost:8668',
      desks:
        config.desksInventoryUrl ??
        process.env.DESKS_INVENTORY_URL ??
        config.healthyInventoryUrl ??
        config.inventoryUrl ??
        'http://localhost:8670',
    },
    backupShippingUrl:
      config.backupShippingUrl ?? process.env.BACKUP_SHIPPING_URL ?? 'http://localhost:8671',
    shippingUrl: config.shippingUrl ?? process.env.SHIPPING_URL ?? 'http://localhost:8667',
    inventoryTimeoutMs: Number(
      config.inventoryTimeoutMs ?? process.env.INVENTORY_TIMEOUT_MS ?? 3000,
    ),
    shippingTimeoutMs: Number(config.shippingTimeoutMs ?? process.env.SHIPPING_TIMEOUT_MS ?? 3000),
    inventoryFallback: config.inventoryFallback ?? process.env.INVENTORY_FALLBACK === 'true',
    shippingFallback: config.shippingFallback ?? process.env.SHIPPING_FALLBACK === 'true',
    toxiproxyApi: config.toxiproxyApi ?? process.env.TOXIPROXY_API ?? 'http://localhost:8474',
    shippingControlUrl: config.shippingControlUrl ?? process.env.SHIPPING_CONTROL_URL,
    inventoryControlUrl: config.inventoryControlUrl ?? process.env.INVENTORY_CONTROL_URL,
  };
  for (const timeout of [settings.inventoryTimeoutMs, settings.shippingTimeoutMs]) {
    if (!Number.isFinite(timeout) || timeout < 1)
      throw new Error('Dependency timeouts must be positive milliseconds');
  }
  const mitigations =
    config.mitigations ??
    createMitigations({
      inventory: { timeoutMs: settings.inventoryTimeoutMs, fallback: settings.inventoryFallback },
      shipping: { timeoutMs: settings.shippingTimeoutMs, fallback: settings.shippingFallback },
    });
  const metrics = new Metrics('storefront');
  const capacity = createCapacity(config.capacity);
  const breaker = createBreaker(config.breaker);
  // Remember only validated values, including before the response checker is
  // enabled. Invalid replies must never replace a product's last good data.
  const latestStock = new Map();
  const latestQuotes = new Map();
  let previousPolicy = JSON.stringify(mitigations.snapshot());

  async function dependency(name, baseUrl, path, timeoutMs) {
    const started = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`Dependency returned ${response.status}`);
      const body = await response.json().catch((error) => {
        if (error instanceof SyntaxError) return null;
        throw error;
      });
      metrics.dependency(name, 'success', (performance.now() - started) / 1000);
      return body;
    } catch (error) {
      const outcome =
        error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'failure';
      metrics.dependency(name, outcome, (performance.now() - started) / 1000);
      const failure = new Error(`${name} ${outcome}`);
      failure.outcome = outcome;
      throw failure;
    }
  }

  async function call(name, sku, policy) {
    const key = name === 'shipping' ? 'shipping' : `${sku}:${name}`;
    if (!breaker.enter(key, policy.breaker)) {
      throw Object.assign(new Error(`${name} circuit_open`), { outcome: 'circuit_open' });
    }
    const baseUrl =
      name === 'inventory' ? settings.inventoryUrls[inventoryCategory[sku]] : settings.shippingUrl;
    const service = name === 'inventory' ? inventoryCategory[sku] + '-inventory' : name;
    try {
      const result = await dependency(
        service,
        baseUrl,
        `${name === 'inventory' ? '/stock' : '/quote'}?sku=${sku}`,
        policy.timeoutMs,
      );
      breaker.success(key);
      return result;
    } catch (error) {
      if (policy.breaker) breaker.failure(key);
      throw error;
    }
  }

  async function stock(policy, sku) {
    try {
      const data = await call('inventory', sku, policy);
      const valid = Number.isInteger(data?.quantity) && data.quantity >= 0;
      metrics.inventoryResponse(
        inventoryCategory[sku] + '-inventory',
        valid,
        !valid && policy.validate,
      );
      if (!valid && policy.validate) {
        const previous = latestStock.get(sku);
        return {
          ...previous,
          available: null,
          quantity: previous?.quantity ?? null,
          source: previous ? 'cached' : 'rejected',
          warning: readPageCopy('storefront').api.invalid_stock_warning,
        };
      }
      const result = {
        available: data?.quantity > 0,
        quantity: data?.quantity ?? null,
        source: 'live',
        ...(valid ? { checkedAt: new Date().toISOString() } : {}),
      };
      if (valid) latestStock.set(sku, result);
      return result;
    } catch (error) {
      if (!policy.fallback) throw error;
      metrics.fallback(inventoryCategory[sku] + '-inventory');
      // A fallback must not claim the item is in stock when the source of truth is unavailable.
      return {
        available: null,
        quantity: null,
        source: 'unconfirmed',
        warning: readPageCopy('storefront').api.inventory_warning,
      };
    }
  }

  function quoteResult(data, source, validate, sku) {
    const valid =
      data !== null &&
      typeof data === 'object' &&
      Number.isFinite(data.priceEur) &&
      data.priceEur >= 0 &&
      Number.isInteger(data.etaDays) &&
      data.etaDays > 0;
    metrics.quote(source === 'backup' ? 'backup' : 'primary', valid, !valid && validate);
    const key = `${sku}:${source}`;
    if (!valid && validate) {
      const previous = latestQuotes.get(key);
      return {
        ...previous,
        priceEur: previous?.priceEur ?? null,
        etaDays: previous?.etaDays ?? null,
        source: previous ? 'cached' : 'rejected',
        warning: readPageCopy('storefront').api.invalid_quote_warning,
      };
    }
    const result = { ...data, source, ...(valid ? { checkedAt: new Date().toISOString() } : {}) };
    if (valid) latestQuotes.set(key, result);
    return result;
  }

  async function shipping(policy, sku) {
    try {
      const data = await call('shipping', sku, policy);
      return quoteResult(data, 'live', policy.validate, sku);
    } catch (error) {
      if (!policy.fallback) throw error;
      metrics.fallback('shipping');
      try {
        const quote = await dependency(
          'shipping-backup',
          settings.backupShippingUrl,
          '/quote?sku=' + sku,
          policy.timeoutMs,
        );
        return quoteResult(quote, 'backup', policy.validate, sku);
      } catch {
        // Both providers are unavailable. Preserve stock and mark the quote missing.
      }
      return {
        method: null,
        priceEur: null,
        etaDays: null,
        source: 'unavailable',
        warning: readPageCopy('storefront').api.shipping_warning,
      };
    }
  }

  async function productResult(product, preview, policy) {
    const queuedAt = performance.now();
    let release;
    let outcome = 'failure';
    try {
      release = await capacity.acquire();
      const queueMs = Math.round(performance.now() - queuedAt);
      // Wait for both calls to settle before releasing a real worker. A failed
      // Shipping call must not hide an Inventory request still using capacity.
      const results = await Promise.allSettled([
        stock(policy.inventory, product.sku),
        ...(preview ? [shipping(policy.shipping, product.sku)] : []),
      ]);
      const failure = results.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
      const inventory = results[0].value;
      const delivery = results[1]?.value;
      const degraded =
        inventory.source !== 'live' || Boolean(delivery && delivery.source !== 'live');
      outcome = degraded ? 'degraded' : 'live';
      const { quantity: _quantity, ...description } = product;
      return {
        product: description,
        inventory,
        ...(delivery ? { shipping: delivery } : {}),
        degraded,
        queueMs,
      };
    } catch (error) {
      outcome = error.outcome ?? 'failure';
      throw error;
    } finally {
      release?.();
      metrics.product(product.sku, (performance.now() - queuedAt) / 1000, outcome);
    }
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;
    if (req.method === 'POST' && route === '/api/workshop/reset') return resetEnvironment();
    if (req.method !== 'GET')
      return send(405, { error: readPageCopy('storefront').api.method_not_allowed });
    if (route === '/health') return send(200, { status: 'ok' });
    if (route === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      const state = capacity.snapshot();
      const circuits = new Map(breaker.snapshot().map((circuit) => [circuit.key, circuit]));
      const paths = products().map(({ sku }) => ({
        sku,
        key: sku + ':inventory',
        service: inventoryCategory[sku] + '-inventory',
      }));
      paths.push({ sku: 'all', key: 'shipping', service: 'shipping' });
      const circuitMetrics = paths.flatMap(({ sku, key, service }) => {
        const circuit = circuits.get(key);
        const labels = `sku="${sku}",dependency="${service}"`;
        return [
          `workshop_circuit_state{${labels}} ${circuit ? (circuit.probing ? 2 : 1) : 0}`,
          `workshop_circuit_retry_seconds{${labels}} ${(circuit?.retryInMs ?? 0) / 1000}`,
        ];
      });
      return res.end(
        metrics.render() +
          [
            '# TYPE workshop_workers_active gauge',
            `workshop_workers_active ${state.active}`,
            '# TYPE workshop_workers_limit gauge',
            `workshop_workers_limit ${state.limit}`,
            '# TYPE workshop_workers_queued gauge',
            `workshop_workers_queued ${state.queued}`,
            '# TYPE workshop_capacity_rejections_total counter',
            `workshop_capacity_rejections_total ${state.rejected}`,
            '# TYPE workshop_open_circuits gauge',
            `workshop_open_circuits ${circuits.size}`,
            '# HELP workshop_circuit_state Product dependency circuit: 0 closed, 1 paused, 2 probing.',
            '# TYPE workshop_circuit_state gauge',
            '# HELP workshop_circuit_retry_seconds Seconds until a product dependency recovery probe is eligible.',
            '# TYPE workshop_circuit_retry_seconds gauge',
            ...circuitMetrics,
            '',
          ].join('\n'),
      );
    }
    if (route === '/api/system')
      return send(200, { ...capacity.snapshot(), circuits: breaker.snapshot() });
    if (route === '/storefront') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page());
    }
    if (route === '/' || route === '/workshop' || route === '/workshop/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(workshopPage());
    }
    if (route === '/tools') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(toolsPage());
    }
    if (serveContentAsset(route, res)) return;
    if (guideFiles.has(route)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(guideFiles.get(route));
    }
    if (!['/api/product', '/api/order-preview', '/api/catalog'].includes(route))
      return send(404, { error: readPageCopy('storefront').api.not_found });

    const started = performance.now();
    // Keep one consistent policy for the entire customer request, even if the
    // operator changes settings while a dependency request is in flight.
    const policy = mitigations.snapshot();
    const currentPolicy = JSON.stringify(policy);
    if (currentPolicy !== previousPolicy) {
      breaker.reset();
      previousPolicy = currentPolicy;
    }
    try {
      if (route === '/api/catalog') {
        // Preserve each operation's actual result. A slow lamp can exhaust the
        // shared worker, but its error must never overwrite healthy products.
        const catalogProducts = products();
        const results = await Promise.allSettled(
          catalogProducts.map((product) =>
            productResult(product, url.searchParams.get('preview') === 'true', policy),
          ),
        );
        return sendApi(200, {
          products: results.map((result, index) => {
            if (result.status === 'fulfilled') return result.value;
            const { quantity: _quantity, ...product } = catalogProducts[index];
            return { product, ...productFailure(result.reason) };
          }),
          system: capacity.snapshot(),
          circuits: breaker.snapshot(),
        });
      }
      const product = products().find(
        (product) => product.sku === (url.searchParams.get('sku') ?? 'LAMP-01'),
      );
      if (!product) return sendApi(404, { error: readPageCopy('storefront').api.not_found });
      const result = await productResult(product, route === '/api/order-preview', policy);
      return sendApi(200, { ...result, note: 'Preview only. No order is placed.' });
    } catch (error) {
      const failure = productFailure(error);
      return sendApi(failure.status, failure);
    }

    function productFailure(error) {
      return {
        status: error.outcome === 'timeout' ? 504 : 503,
        outcome: error.outcome ?? 'failure',
        error:
          error.outcome === 'capacity'
            ? readPageCopy('storefront').catalog.capacity_error
            : readPageCopy('storefront').catalog.product_error,
        failedDependency: error.message.split(' ')[0],
      };
    }

    // Called by the workshop page when a newly unlocked challenge is opened, so
    // each challenge starts with no network faults and default mitigations.
    async function resetEnvironment() {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
        return send(403, {
          error: readPageCopy('storefront').api.cross_origin_changes_are_not_allowed,
        });
      if (!req.headers['content-type']?.startsWith('application/json'))
        return send(415, { error: readPageCopy('storefront').api.json_is_required });
      try {
        const response = await fetch(new URL('/reset', settings.toxiproxyApi), {
          method: 'POST',
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok)
          throw new Error(
            format(readPageCopy('storefront').api.proxy_reset_status, { status: response.status }),
          );
        for (const controlUrl of [settings.shippingControlUrl, settings.inventoryControlUrl].filter(
          Boolean,
        )) {
          const cleared = await fetch(new URL('/fault', controlUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'none' }),
            signal: AbortSignal.timeout(3000),
          });
          if (!cleared.ok) throw new Error(readPageCopy('storefront').api.shipping_reset_failed);
        }
      } catch (error) {
        return send(502, {
          error: format(readPageCopy('storefront').api.reset_failed, { error: error.message }),
        });
      }
      const restored = mitigations.apply({ action: 'reset' });
      breaker.reset();
      latestStock.clear();
      latestQuotes.clear();
      previousPolicy = JSON.stringify(restored);
      console.log(
        'Workshop fresh start: network faults cleared, default timeouts and fallbacks restored',
      );
      return send(200, { faults: 'cleared', mitigations: restored });
    }

    function sendApi(status, body) {
      metrics.request(route, status, (performance.now() - started) / 1000);
      send(status, body);
    }

    function send(status, body) {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(body));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mitigations = createMitigations({
    inventory: {
      timeoutMs: Number(process.env.INVENTORY_TIMEOUT_MS ?? 3000),
      fallback: process.env.INVENTORY_FALLBACK === 'true',
    },
    shipping: {
      timeoutMs: Number(process.env.SHIPPING_TIMEOUT_MS ?? 3000),
      fallback: process.env.SHIPPING_FALLBACK === 'true',
    },
  });
  createStorefrontServer({ mitigations }).listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
  createMitigationServer(mitigations).listen(
    Number(process.env.MITIGATION_PORT ?? 8081),
    '0.0.0.0',
  );
}
