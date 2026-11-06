import { readFileSync } from 'node:fs';
import { home } from '../src/shared/copy.js';

const webRoot = new URL('../build/', import.meta.url);
const assets = new Map([
  ...['lamp', 'chair', 'desk'].map(name => [`/images/${name}.png`, 'image/png']),
  ...['storefront', 'workshop-app', 'fault-console', 'tools'].map(name => [`/${name}.mjs.LEGAL.txt`, 'text/plain; charset=utf-8']),
  ...['copy.mjs', 'challenges.mjs', 'storefront.mjs', 'workshop-app.mjs', 'workshop-state.mjs', 'fault-console.mjs', 'tools.mjs']
    .map(name => [`/${name}`, 'text/javascript; charset=utf-8']),
].map(([route, type]) => [route, { type, body: readFileSync(new URL(route.slice(1), webRoot)) }]));

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function renderPage(filename) {
  const page = {
    'workshop.html': home,
    'index.html': {"pageTitle":"Northstar Supply — Live catalog","javascriptRequired":"Enable JavaScript to use the interactive product catalog."},
    'fault-console.html': {"pageTitle":"Network Faults & Fallbacks — Northstar Supply","javascriptRequired":"Enable JavaScript to use the interactive product catalog."},
    'tools.html': {"pageTitle":"Commands — Northstar Supply","javascriptRequired":"Enable JavaScript to use the interactive product catalog."}
  }[filename];
  if (!page) throw new Error('Unknown page: ' + filename);
  return readFileSync(new URL(filename, webRoot), 'utf8').replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => {
      if (typeof page[key] !== 'string') throw new Error('Missing page text: ' + filename + '.' + key);
      return escapeHtml(page[key]);
    }
  );
}

export function serveContentAsset(route, res) {
  const asset = assets.get(route);
  if (!asset) return false;
  res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'no-cache' });
  res.end(asset.body);
  return true;
}
