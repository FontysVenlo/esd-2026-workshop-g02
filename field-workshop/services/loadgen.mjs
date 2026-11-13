const base = process.env.STOREFRONT_URL ?? 'http://localhost:8088';
let requests = 0;
let failures = 0;

async function request(path) {
  try {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) });
    requests += 1;
    if (!response.ok) failures += 1;
  } catch {
    requests += 1;
    failures += 1;
  }
}

// 1.5 lamp requests/second need 2.25 worker-seconds/second with a 1.5 s delay.
// A 400 ms timeout reduces that to 0.6, leaving the single worker time for
// healthy products. Fallback does not change that capacity calculation.
// Stock comes from separate category services. Delivery previews call shared Shipping.
// Keep this traffic fixed across healthy, faulted and mitigated measurements.
setInterval(() => request('/api/product'), 1000);
setInterval(() => request('/api/order-preview'), 2000);
setInterval(() => request('/api/product?sku=CHAIR-02'), 1000);
setInterval(() => request('/api/product?sku=DESK-03'), 1000);
setInterval(() => {
  console.log(`Last 10 seconds: ${requests} requests, ${failures} failures`);
  requests = 0;
  failures = 0;
}, 10000);
