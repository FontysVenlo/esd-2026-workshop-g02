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

// Roughly three real requests per second, to both customer-facing paths.
setInterval(() => request('/api/product'), 500);
setInterval(() => request('/api/order-preview'), 1000);
setInterval(() => {
  console.log(`Last 10 seconds: ${requests} requests, ${failures} failures`);
  requests = 0;
  failures = 0;
}, 10000);
