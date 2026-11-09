import { readPageCopy } from './page-copy.mjs';
import { format } from '../src/shared/copy.js';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { pageReader, serveContentAsset } from './web-content.mjs';

const page = pageReader('fault-console.html');
const proxyNames = ['inventory', 'shipping'];
const toxicName = 'workshop-latency';

export function createFaultConsoleServer(config = {}) {
  const api = config.toxiproxyApi ?? process.env.TOXIPROXY_API ?? 'http://localhost:8474';
  const mitigationApi =
    config.mitigationApi ?? process.env.STOREFRONT_ADMIN_URL ?? 'http://storefront:8081';

  async function callToxiproxy(method, path, body) {
    const response = await fetch(new URL(path, api), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok)
      throw new Error(
        format(readPageCopy('network-faults').api.toxiproxy_returned, {
          status: response.status,
          detail: (await response.text()).slice(0, 200),
        }),
      );
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function state() {
    const proxies = await callToxiproxy('GET', '/proxies');
    const result = {};
    for (const name of proxyNames) {
      if (!proxies[name])
        throw new Error(
          format(readPageCopy('network-faults').api.proxy_missing, { dependency: name }),
        );
      result[name] = {
        enabled: proxies[name].enabled,
        toxics: (proxies[name].toxics ?? []).map((toxic) => ({
          name: toxic.name,
          type: toxic.type,
          stream: toxic.stream,
          attributes: toxic.attributes,
        })),
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
    if (!proxyNames.includes(proxy))
      throw new Error(readPageCopy('network-faults').api.choose_inventory_or_shipping);
    const base = `/proxies/${proxy}`;
    let command;
    if (action === 'set-latency') {
      const latencyMs = input?.latencyMs;
      if (!Number.isInteger(latencyMs) || latencyMs < 50 || latencyMs > 5000) {
        throw new Error(
          readPageCopy('network-faults').api.latency_must_be_a_whole_number_from_50_to_5000_ms,
        );
      }
      const current = await state();
      const existing = current[proxy].toxics.some((toxic) => toxic.name === toxicName);
      command = {
        method: 'POST',
        path: existing ? `${base}/toxics/${toxicName}` : `${base}/toxics`,
        body: {
          name: toxicName,
          type: 'latency',
          stream: 'downstream',
          attributes: { latency: latencyMs, jitter: 0 },
        },
      };
    } else if (action === 'remove-latency') {
      const current = await state();
      if (!current[proxy].toxics.some((toxic) => toxic.name === toxicName))
        throw new Error(
          readPageCopy('network-faults').api.no_console_managed_latency_is_active_on_this_path,
        );
      command = { method: 'DELETE', path: `${base}/toxics/${toxicName}` };
    } else if (action === 'disconnect' || action === 'reconnect') {
      command = { method: 'POST', path: base, body: { enabled: action === 'reconnect' } };
    } else {
      throw new Error(readPageCopy('network-faults').api.unknown_action);
    }
    await callToxiproxy(command.method, command.path, command.body);
    return command;
  }

  return http.createServer(async (req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    const send = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && route === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page());
    }
    if (req.method === 'GET' && serveContentAsset(route, res)) return;
    if (req.method === 'GET' && route === '/health') return send(200, { status: 'ok' });
    if (route === '/api/mitigations' && ['GET', 'POST'].includes(req.method)) {
      if (req.method === 'POST') {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
          return send(403, {
            error: readPageCopy('network-faults').api.cross_origin_changes_are_not_allowed,
          });
        if (!req.headers['content-type']?.startsWith('application/json'))
          return send(415, { error: readPageCopy('network-faults').api.json_is_required });
      }
      try {
        let body;
        if (req.method === 'POST') {
          let raw = '';
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 1024)
              return send(413, { error: readPageCopy('network-faults').api.request_is_too_large });
          }
          try {
            body = JSON.stringify(JSON.parse(raw));
          } catch {
            return send(400, { error: readPageCopy('network-faults').api.invalid_json });
          }
        }
        const response = await fetch(new URL('/settings', mitigationApi), {
          method: req.method,
          headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(3000),
        });
        return send(response.status, await response.json());
      } catch (error) {
        return send(502, {
          error: format(readPageCopy('network-faults').api.cannot_reach_settings, {
            error: error.message,
          }),
        });
      }
    }
    if (req.method === 'GET' && route === '/api/state') {
      try {
        return send(200, await state());
      } catch (error) {
        return send(502, {
          error: format(readPageCopy('network-faults').api.cannot_read_state, {
            error: error.message,
          }),
        });
      }
    }
    if (req.method === 'POST' && route === '/api/action') {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
        return send(403, {
          error: readPageCopy('network-faults').api.cross_origin_changes_are_not_allowed,
        });
      if (!req.headers['content-type']?.startsWith('application/json'))
        return send(415, { error: readPageCopy('network-faults').api.json_is_required });
      try {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 1024)
            return send(413, { error: readPageCopy('network-faults').api.request_is_too_large });
        }
        let input;
        try {
          input = JSON.parse(raw);
        } catch {
          return send(400, { error: readPageCopy('network-faults').api.invalid_json });
        }
        if (input?.action !== 'reset' && !['inventory', 'shipping'].includes(input?.proxy))
          return send(400, {
            error: readPageCopy('network-faults').api.choose_inventory_or_shipping,
          });
        if (
          input?.action === 'set-latency' &&
          (!Number.isInteger(input.latencyMs) || input.latencyMs < 50 || input.latencyMs > 5000)
        ) {
          return send(400, {
            error:
              readPageCopy('network-faults').api.latency_must_be_a_whole_number_from_50_to_5000_ms,
          });
        }
        if (
          !['reset', 'set-latency', 'remove-latency', 'disconnect', 'reconnect'].includes(
            input?.action,
          )
        )
          return send(400, { error: readPageCopy('network-faults').api.unknown_action });
        const command = await act(input);
        return send(200, { command, state: await state() });
      } catch (error) {
        return send(502, {
          error: format(readPageCopy('network-faults').api.change_failed, { error: error.message }),
        });
      }
    }
    send(req.method === 'GET' || req.method === 'POST' ? 404 : 405, {
      error: readPageCopy('network-faults').api.not_found,
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createFaultConsoleServer().listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}
