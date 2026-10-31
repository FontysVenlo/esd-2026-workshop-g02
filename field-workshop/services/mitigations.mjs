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
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Choose mitigation settings');
      if (input.action === 'reset' && Object.keys(input).length === 1) {
        settings = structuredClone(defaultMitigations);
      } else {
        if (input.action !== 'configure' || !['inventory', 'shipping'].includes(input.dependency)) throw new Error('Choose Inventory or Shipping');
        if (Object.keys(input).some(key => !['action', 'dependency', 'timeoutMs', 'fallback'].includes(key))) throw new Error('Unknown mitigation setting');
        if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 50 || input.timeoutMs > 5000) throw new Error('Timeout must be a whole number from 50 to 5000 ms');
        if (typeof input.fallback !== 'boolean') throw new Error('Fallback must be true or false');
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
    if (req.url !== '/settings') return send(404, { error: 'Not found' });
    if (req.method === 'GET') return send(200, mitigations.snapshot());
    if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON is required' });
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 1024) return send(413, { error: 'Request is too large' });
    }
    try { send(200, mitigations.apply(JSON.parse(raw))); }
    catch (error) { send(400, { error: error.message }); }
  });
}
