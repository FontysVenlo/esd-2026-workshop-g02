import { readPageCopy } from './page-copy.mjs';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { Metrics } from './metrics.mjs';

export function createShippingServer(provider = process.env.SHIPPING_PROVIDER ?? 'primary') {
  if (!['primary', 'backup'].includes(provider)) throw new Error('Unknown shipping provider');
  const metrics = new Metrics(provider === 'backup' ? 'shipping-backup' : 'shipping');
  let mode = 'none';
  const calls = new Map();
  return http.createServer(async (req, res) => {
    const started = performance.now();
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (path === '/fault' && provider === 'primary') {
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
        calls.clear();
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
    if (path === '/quote') {
      const sku = url.searchParams.get('sku') ?? 'LAMP-01';
      const sequence = calls.get(sku) ?? 0;
      calls.set(sku, sequence + 1);
      if (mode === 'intermittent-errors' && sequence % 2 === 0)
        return respond(503, { error: readPageCopy('storefront').api.shipping_warning });
      const quote = {
        method: 'standard',
        priceEur: 4.9,
        etaDays: provider === 'backup' ? 5 : 3,
      };
      // A repeatable sequence per product avoids assigning one permanently bad
      // value to the same card when the catalog requests three quotes at once.
      if (mode === 'invalid-data') {
        const variants = [
          { etaDays: -2 },
          { priceEur: null, etaDays: null },
          { priceEur: -4.9 },
          {},
        ];
        Object.assign(quote, variants[sequence % variants.length]);
      }
      return respond(200, quote);
    }
    return respond(404, { error: readPageCopy('storefront').api.not_found });

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
