// One circuit per product and dependency. Configured independently of the fallback.
// After an unsuccessful call, fail fast for five seconds, then allow one probe.
export function createBreaker({ cooldownMs = 5000 } = {}) {
  const circuits = new Map();
  return {
    enter(key, enabled) {
      if (!enabled) {
        circuits.delete(key);
        return true;
      }
      const circuit = circuits.get(key);
      if (!circuit) return true;
      if (circuit.retryAt > Date.now() || circuit.probing) return false;
      circuit.probing = true;
      return true;
    },
    success(key) {
      circuits.delete(key);
    },
    failure(key) {
      circuits.set(key, { retryAt: Date.now() + cooldownMs, probing: false });
    },
    reset() {
      circuits.clear();
    },
    snapshot() {
      return [...circuits].map(([key, value]) => ({
        key,
        retryInMs: Math.max(0, value.retryAt - Date.now()),
        probing: value.probing,
      }));
    },
  };
}
