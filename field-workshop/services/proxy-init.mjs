import { pathToFileURL } from 'node:url';

const proxies = [
  { name: 'inventory', listen: '0.0.0.0:8666', upstream: 'inventory:8080' },
  { name: 'shipping', listen: '0.0.0.0:8667', upstream: 'shipping:8080' }
];

export async function initializeProxies(api = process.env.TOXIPROXY_API ?? 'http://localhost:8474', wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let existing;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${api}/proxies`, { signal: AbortSignal.timeout(1000) });
      if (!response.ok) throw new Error(`Toxiproxy returned ${response.status}`);
      existing = await response.json();
      break;
    } catch (error) {
      if (attempt === 29) throw new Error(`Toxiproxy did not become ready: ${error.message}`);
      await wait(1000);
    }
  }
  for (const proxy of proxies) {
    if (existing[proxy.name]) {
      // Toxiproxy normalizes 0.0.0.0 to [::] on some hosts; compare the effective port.
      if (existing[proxy.name].upstream !== proxy.upstream || !existing[proxy.name].listen.endsWith(`:${proxy.listen.split(':').at(-1)}`)) {
        throw new Error(`Existing ${proxy.name} proxy points to the wrong service`);
      }
      continue;
    }
    const response = await fetch(`${api}/proxies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proxy, enabled: true })
    });
    if (!response.ok) throw new Error(`Could not create ${proxy.name} proxy: ${response.status} ${await response.text()}`);
    console.log(`Created ${proxy.name} proxy`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  initializeProxies().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
