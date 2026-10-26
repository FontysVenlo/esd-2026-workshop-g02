import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, test } from 'node:test';
import { createFaultConsoleServer } from '../services/fault-console.mjs';

const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function fixture() {
  const calls = [];
  const proxies = {
    inventory: { enabled: true, toxics: [] },
    shipping: { enabled: true, toxics: [] }
  };
  const toxiproxy = await listen(http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    let body;
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      body = raw ? JSON.parse(raw) : undefined;
    }
    calls.push({ method: req.method, path, body });
    if (req.method === 'GET' && path === '/proxies') return reply(res, 200, proxies);
    if (req.method === 'POST' && path === '/reset') {
      for (const proxy of Object.values(proxies)) { proxy.enabled = true; proxy.toxics = []; }
      return reply(res, 204);
    }
    const match = path.match(/^\/proxies\/(inventory|shipping)(?:\/toxics(?:\/(workshop-latency))?)?$/);
    if (!match) return reply(res, 404, { error: 'not found' });
    const proxy = proxies[match[1]];
    if (path.endsWith('/toxics') && req.method === 'POST') {
      proxy.toxics.push(body);
      return reply(res, 201, body);
    }
    if (match[2] && req.method === 'POST') {
      proxy.toxics = proxy.toxics.map(toxic => toxic.name === match[2] ? body : toxic);
      return reply(res, 200, body);
    }
    if (match[2] && req.method === 'DELETE') {
      proxy.toxics = proxy.toxics.filter(toxic => toxic.name !== match[2]);
      return reply(res, 204);
    }
    if (req.method === 'POST') {
      proxy.enabled = body.enabled;
      return reply(res, 200, proxy);
    }
    reply(res, 404, { error: 'not found' });
  }));
  const consoleBase = await listen(createFaultConsoleServer({ toxiproxyApi: toxiproxy }));
  async function action(body, headers = {}) {
    return fetch(`${consoleBase}/api/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
    });
  }
  return { calls, proxies, consoleBase, action };
}

test('console serves controls and an Info tab with underlying requests', async () => {
  const { consoleBase } = await fixture();
  const response = await fetch(consoleBase);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Info &amp; commands/);
  assert.match(html, /POST \/proxies\/inventory\/toxics/);
  assert.match(html, /POST \/reset/);
  assert.equal((await fetch(`${consoleBase}/fault-console.mjs`)).status, 200);
  assert.match((await (await fetch(`${consoleBase}/site.css`)).headers.get('content-type')), /text\/css/);
  const state = await (await fetch(`${consoleBase}/api/state`)).json();
  assert.equal(state.inventory.enabled, true);
  assert.deepEqual(state.shipping.toxics, []);
});

test('latency is created, updated, then removed through the real proxy API', async () => {
  const { calls, proxies, action } = await fixture();
  let response = await action({ action: 'set-latency', proxy: 'inventory', latencyMs: 1500 });
  assert.equal(response.status, 200);
  let result = await response.json();
  assert.equal(result.command.path, '/proxies/inventory/toxics');
  assert.equal(result.state.inventory.toxics[0].attributes.latency, 1500);
  assert.equal(proxies.shipping.toxics.length, 0);

  response = await action({ action: 'set-latency', proxy: 'inventory', latencyMs: 800 });
  result = await response.json();
  assert.equal(result.command.path, '/proxies/inventory/toxics/workshop-latency');
  assert.equal(proxies.inventory.toxics.length, 1);
  assert.equal(proxies.inventory.toxics[0].attributes.latency, 800);

  response = await action({ action: 'remove-latency', proxy: 'inventory' });
  result = await response.json();
  assert.equal(result.command.method, 'DELETE');
  assert.equal(proxies.inventory.toxics.length, 0);
  assert.ok(calls.some(call => call.method === 'DELETE' && call.path === '/proxies/inventory/toxics/workshop-latency'));
});

test('disconnect and reset restore actual proxy state without changing submissions', async () => {
  const { proxies, action } = await fixture();
  let response = await action({ action: 'disconnect', proxy: 'shipping' });
  assert.equal(response.status, 200);
  assert.equal(proxies.shipping.enabled, false);
  response = await action({ action: 'set-latency', proxy: 'inventory', latencyMs: 1500 });
  assert.equal(response.status, 200);
  response = await action({ action: 'reset' });
  const result = await response.json();
  assert.equal(result.command.path, '/reset');
  assert.equal(proxies.shipping.enabled, true);
  assert.equal(proxies.inventory.enabled, true);
  assert.deepEqual(proxies.inventory.toxics, []);
  assert.deepEqual(proxies.shipping.toxics, []);
});

test('console rejects out-of-scope actions and cross-origin browser changes', async () => {
  const { calls, consoleBase, action } = await fixture();
  const baseline = calls.length;
  assert.equal((await action({ action: 'set-latency', proxy: 'external', latencyMs: 1500 })).status, 400);
  assert.equal((await action({ action: 'set-latency', proxy: 'inventory', latencyMs: 5001 })).status, 400);
  assert.equal((await action({ action: 'delete-proxy', proxy: 'inventory' })).status, 400);
  assert.equal((await action({ action: 'reset' }, { Origin: 'http://evil.example' })).status, 403);
  assert.equal(calls.length, baseline);
  assert.equal((await fetch(`${consoleBase}/api/action`, { method: 'GET' })).status, 404);
});
