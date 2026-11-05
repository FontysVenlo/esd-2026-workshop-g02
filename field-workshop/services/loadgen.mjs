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

// Three lamp requests per second can exhaust two workers under a 1.5 s delay.
// The other products use the SAME services through separate healthy proxy paths.
// Keep this traffic fixed across healthy, faulted and mitigated measurements.
setInterval(() => request('/api/product'), 500);
setInterval(() => request('/api/order-preview'), 1000);
setInterval(() => request('/api/product?sku=CHAIR-02'), 1000);
setInterval(() => request('/api/product?sku=DESK-03'), 1000);
setInterval(() => {
  console.log(`Last 10 seconds: ${requests} requests, ${failures} failures`);
  requests = 0;
  failures = 0;
}, 10000);
