import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { Metrics } from './metrics.mjs';

export function createShippingServer() {
  const metrics = new Metrics('shipping');
  return http.createServer((req, res) => {
    const started = performance.now();
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/health') return respond(200, { status: 'ok' });
    if (path === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      return res.end(metrics.render());
    }
    if (path === '/quote') return respond(200, { method: 'standard', priceEur: 4.9, etaDays: 3 });
    return respond(404, { error: 'not found' });

    function respond(status, body) {
      if (path === '/quote') metrics.request(path, status, (performance.now() - started) / 1000);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createShippingServer().listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}
