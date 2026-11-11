import { readPageCopy } from './page-copy.mjs';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { Metrics } from './metrics.mjs';
import { products, inventoryCategory } from './catalog.mjs';

export function createInventoryServer(category = process.env.INVENTORY_CATEGORY ?? 'lighting') {
  if (!Object.values(inventoryCategory).includes(category))
    throw new Error('Unknown inventory category: ' + category);
  const metrics = new Metrics(category + '-inventory');
  let mode = 'none';
  let sequence = 0;
  return http.createServer(async (req, res) => {
    const started = performance.now();
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (path === '/fault') {
      if (req.method === 'GET') return respond(200, { mode });
      if (req.method !== 'POST') return respond(405, {});
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
        return respond(403, {});
      if (!req.headers['content-type']?.startsWith('application/json')) return respond(415, {});
      try {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 1024) return respond(413, {});
        }
        const input = JSON.parse(raw);
        if (!['none', 'invalid-data', 'intermittent-errors'].includes(input.mode))
          return respond(400, {});
        mode = input.mode;
        sequence = 0;
        return respond(200, { mode });
      } catch {
        return respond(400, {});
      }
    }
    if (path === '/health') return respond(200, { status: 'ok' });
    if (path === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      return res.end(metrics.render());
    }
    if (path === '/stock') {
      const product = products().find(
        (product) => product.sku === (url.searchParams.get('sku') ?? 'LAMP-01'),
      );
      if (!product || inventoryCategory[product.sku] !== category)
        return respond(404, { error: readPageCopy('storefront').api.not_found });
      const step = sequence++;
      if (mode === 'intermittent-errors' && step % 2 === 0)
        return respond(503, { error: readPageCopy('storefront').api.inventory_warning });
      const quantity =
        mode === 'invalid-data' ? [-3, null, 1.5, product.quantity][step % 4] : product.quantity;
      return respond(200, { sku: product.sku, quantity, warehouse: 'west' });
    }
    return respond(404, { error: readPageCopy('storefront').api.not_found });

    function respond(status, body) {
      if (path === '/stock') metrics.request(path, status, (performance.now() - started) / 1000);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createInventoryServer().listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}
