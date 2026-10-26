import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { Metrics } from './metrics.mjs';

export function createInventoryServer() {
  const metrics = new Metrics('inventory');
  return http.createServer((req, res) => {
    const started = performance.now();
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/health') return respond(200, { status: 'ok' });
    if (path === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      return res.end(metrics.render());
    }
    if (path === '/stock') return respond(200, { sku: 'LAMP-01', quantity: 12, warehouse: 'west' });
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
