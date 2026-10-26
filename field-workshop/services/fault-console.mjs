import http from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const page = readFileSync(new URL('../web/fault-console.html', import.meta.url));
const app = readFileSync(new URL('../web/fault-console.mjs', import.meta.url));
const siteCss = readFileSync(new URL('../web/site.css', import.meta.url));
const proxyNames = ['inventory', 'shipping'];
const toxicName = 'workshop-latency';

export function createFaultConsoleServer(config = {}) {
  const api = config.toxiproxyApi ?? process.env.TOXIPROXY_API ?? 'http://localhost:8474';

  async function callToxiproxy(method, path, body) {
    const response = await fetch(new URL(path, api), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error(`Toxiproxy returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function state() {
    const proxies = await callToxiproxy('GET', '/proxies');
    const result = {};
    for (const name of proxyNames) {
      if (!proxies[name]) throw new Error(`${name} proxy is missing`);
      result[name] = {
        enabled: proxies[name].enabled,
        toxics: (proxies[name].toxics ?? []).map(toxic => ({
          name: toxic.name,
          type: toxic.type,
          stream: toxic.stream,
          attributes: toxic.attributes
        }))
      };
    }
    return result;
  }

  async function act(input) {
    const action = input?.action;
    if (action === 'reset') {
      const command = { method: 'POST', path: '/reset' };
      await callToxiproxy(command.method, command.path);
      return command;
    }
    const proxy = input?.proxy;
    if (!proxyNames.includes(proxy)) throw new Error('Choose Inventory or Shipping');
    const base = `/proxies/${proxy}`;
    let command;
    if (action === 'set-latency') {
      const latencyMs = input?.latencyMs;
      if (!Number.isInteger(latencyMs) || latencyMs < 50 || latencyMs > 5000) {
        throw new Error('Latency must be a whole number from 50 to 5000 ms');
      }
      const current = await state();
      const existing = current[proxy].toxics.some(toxic => toxic.name === toxicName);
      command = {
        method: 'POST',
        path: existing ? `${base}/toxics/${toxicName}` : `${base}/toxics`,
        body: { name: toxicName, type: 'latency', stream: 'downstream', attributes: { latency: latencyMs, jitter: 0 } }
      };
    } else if (action === 'remove-latency') {
      const current = await state();
      if (!current[proxy].toxics.some(toxic => toxic.name === toxicName)) throw new Error('No console-managed latency is active on this path');
      command = { method: 'DELETE', path: `${base}/toxics/${toxicName}` };
    } else if (action === 'disconnect' || action === 'reconnect') {
      command = { method: 'POST', path: base, body: { enabled: action === 'reconnect' } };
    } else {
      throw new Error('Unknown action');
    }
    await callToxiproxy(command.method, command.path, command.body);
    return command;
  }

  return http.createServer(async (req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && route === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    if (req.method === 'GET' && route === '/fault-console.mjs') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      return res.end(app);
    }
    if (req.method === 'GET' && route === '/site.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      return res.end(siteCss);
    }
    if (req.method === 'GET' && route === '/health') return send(200, { status: 'ok' });
    if (req.method === 'GET' && route === '/api/state') {
      try { return send(200, await state()); }
      catch (error) { return send(502, { error: `Cannot read Toxiproxy state: ${error.message}` }); }
    }
    if (req.method === 'POST' && route === '/api/action') {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: 'Cross-origin changes are not allowed' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON is required' });
      try {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 1024) return send(413, { error: 'Request is too large' });
        }
        let input;
        try { input = JSON.parse(raw); }
        catch { return send(400, { error: 'Invalid JSON' }); }
        if (input?.action !== 'reset' && !['inventory', 'shipping'].includes(input?.proxy)) return send(400, { error: 'Choose Inventory or Shipping' });
        if (input?.action === 'set-latency' && (!Number.isInteger(input.latencyMs) || input.latencyMs < 50 || input.latencyMs > 5000)) {
          return send(400, { error: 'Latency must be a whole number from 50 to 5000 ms' });
        }
        if (!['reset', 'set-latency', 'remove-latency', 'disconnect', 'reconnect'].includes(input?.action)) return send(400, { error: 'Unknown action' });
        const command = await act(input);
        return send(200, { command, state: await state() });
      } catch (error) {
        return send(502, { error: `Toxiproxy change failed: ${error.message}` });
      }
    }
    send(req.method === 'GET' || req.method === 'POST' ? 404 : 405, { error: 'Not found' });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createFaultConsoleServer().listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}
