import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const workshop = fileURLToPath(new URL('../', import.meta.url));
const pages = [
  'http://localhost:8088',
  'http://localhost:8088/storefront',
  'http://localhost:8089',
  'http://localhost:3008/d/field-workshop/field-workshop',
  'http://localhost:9098'
];

async function ready(url, signal) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(3000)])
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

function openPage(url) {
  const windows = process.platform === 'win32';
  const command = windows ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = windows ? ['url.dll,FileProtocolHandler', url] : [url];
  const opener = spawn(command, args, { stdio: 'ignore', windowsHide: true });
  opener.on('error', () => console.warn('Open this page in your browser: ' + url));
  opener.on('exit', code => {
    if (code) console.warn('Open this page in your browser: ' + url);
  });
  opener.unref();
}

async function openWhenReady(signal) {
  while (!signal.aborted) {
    const results = await Promise.all(pages.map(url => ready(url, signal)));
    if (!signal.aborted && results.every(Boolean)) {
      console.log('Workshop ready. Opening the five workshop pages.');
      pages.forEach(openPage);
      return;
    }
    await delay(1000, undefined, { signal });
  }
}

// Keep Compose attached so logs and normal terminal Ctrl+C shutdown still work.
const controller = new AbortController();
const compose = spawn('docker', [
  'compose', '-f', 'compose.yaml', '-f', 'compose.dev.yaml',
  '--profile', 'load', 'up', '--build'
], { cwd: workshop, stdio: 'inherit' });

compose.on('error', error => {
  console.error('Could not start Docker Compose: ' + error.message);
  controller.abort();
  process.exitCode = 1;
});
compose.on('close', (code, signal) => {
  controller.abort();
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
openWhenReady(controller.signal).catch(error => {
  if (!controller.signal.aborted) console.warn('Could not open workshop pages: ' + error.message);
});
