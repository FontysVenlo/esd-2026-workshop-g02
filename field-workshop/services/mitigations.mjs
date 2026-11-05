import { copy as text } from '../src/shared/copy.js';
import http from 'node:http';

export const defaultMitigations = Object.freeze({
  inventory: Object.freeze({ timeoutMs: 3000, fallback: false }),
  shipping: Object.freeze({ timeoutMs: 3000, fallback: false })
});

export function createMitigations(initial = defaultMitigations) {
  let settings = structuredClone(initial);
  return {
    snapshot: () => structuredClone(settings),
    apply(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(text('api', 'choose_mitigation_settings'));
      if (input.action === 'reset' && Object.keys(input).length === 1) {
        settings = structuredClone(defaultMitigations);
      } else {
        if (input.action !== 'configure' || !['inventory', 'shipping'].includes(input.dependency)) throw new Error(text('api', 'choose_inventory_or_shipping'));
        if (Object.keys(input).some(key => !['action', 'dependency', 'timeoutMs', 'fallback'].includes(key))) throw new Error(text('api', 'unknown_mitigation_setting'));
        if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 50 || input.timeoutMs > 5000) throw new Error(text('api', 'timeout_must_be_a_whole_number_from_50_to_5000_ms'));
        if (typeof input.fallback !== 'boolean') throw new Error(text('api', 'fallback_must_be_true_or_false'));
        settings = { ...settings, [input.dependency]: { timeoutMs: input.timeoutMs, fallback: input.fallback } };
      }
      return structuredClone(settings);
    }
  };
}

// This listener is available only inside the Docker network, not on a host port.
// The browser uses the fault console, which enforces same-origin JSON changes.
export function createMitigationServer(mitigations) {
  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (req.url !== '/settings') return send(404, { error: text('api', 'not_found') });
    if (req.method === 'GET') return send(200, mitigations.snapshot());
    if (req.method !== 'POST') return send(405, { error: text('api', 'method_not_allowed') });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: text('api', 'json_is_required') });
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 1024) return send(413, { error: text('api', 'request_is_too_large') });
    }
    try { send(200, mitigations.apply(JSON.parse(raw))); }
    catch (error) { send(400, { error: error.message }); }
  });
}
