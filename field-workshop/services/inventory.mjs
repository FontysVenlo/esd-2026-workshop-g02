import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { Metrics } from './metrics.mjs';
import { products } from './catalog.mjs';

export function createInventoryServer() {
  const metrics = new Metrics('inventory');
  return http.createServer((req, res) => {
    const started = performance.now();
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (path === '/health') return respond(200, { status: 'ok' });
    if (path === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      return res.end(metrics.render());
    }
    if (path === '/stock') {
      const product = products().find(product => product.sku === (url.searchParams.get('sku') ?? 'LAMP-01'));
      return product ? respond(200, { sku: product.sku, quantity: product.quantity, warehouse: 'west' }) : respond(404, { error: 'not found' });
    }
    return respond(404, { error: 'not found' });

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
