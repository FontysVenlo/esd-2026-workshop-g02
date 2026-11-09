import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readPageCopy } from './page-copy.mjs';

const webRoot = new URL('../build/', import.meta.url);
const liveDirectory = process.env.WORKSHOP_LIVE_DIR;
function readAsset(filename) {
  return readFileSync(
    liveDirectory ? path.join(liveDirectory, filename) : new URL(filename, webRoot),
  );
}
const assets = new Map(
  [
    ['/site.css', 'text/css; charset=utf-8'],
    ...(liveDirectory
      ? [
          ['/__dev/revision', 'text/plain'],
          ['/__dev/reload.js', 'text/javascript'],
        ]
      : []),
    ...['lamp', 'chair', 'desk'].map((name) => [`/images/${name}.png`, 'image/png']),
    ...['storefront', 'workshop-app', 'fault-console', 'tools'].map((name) => [
      `/${name}.mjs.LEGAL.txt`,
      'text/plain; charset=utf-8',
    ]),
    ...[
      'copy.mjs',
      'challenges.mjs',
      'storefront.mjs',
      'workshop-app.mjs',
      'workshop-state.mjs',
      'fault-console.mjs',
      'tools.mjs',
    ].map((name) => [`/${name}`, 'text/javascript; charset=utf-8']),
  ].map(([route, type]) => {
    const filename = route.replace(/^\/(?:__dev\/)?/, '');
    return [route, { type, filename, body: liveDirectory ? null : readAsset(filename) }];
  }),
);

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

export function renderPage(filename) {
  const name = {
    'workshop.html': 'home',
    'index.html': 'storefront',
    'fault-console.html': 'network-faults',
    'tools.html': 'tools',
  }[filename];
  if (!name) throw new Error('Unknown page: ' + filename);
  const page = readPageCopy(name);
  const html = readAsset(filename)
    .toString('utf8')
    .replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (typeof page[key] !== 'string')
        throw new Error('Missing page text: ' + filename + '.' + key);
      return escapeHtml(page[key]);
    });
  if (!liveDirectory) return html;
  const revision = escapeHtml(readAsset('revision').toString('utf8'));
  return html.replace(
    '</body>',
    `<script defer src="/__dev/reload.js" data-revision="${revision}"></script></body>`,
  );
}

export function pageReader(filename) {
  if (liveDirectory) return () => renderPage(filename);
  const html = renderPage(filename);
  return () => html;
}

export function serveContentAsset(route, res) {
  const asset = assets.get(route);
  if (!asset) return false;
  res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'no-cache' });
  res.end(asset.body ?? readAsset(asset.filename));
  return true;
}
