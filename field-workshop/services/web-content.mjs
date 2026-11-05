import { readFileSync } from 'node:fs';
import { shared } from '../src/shared/copy.js';

const webRoot = new URL('../build/', import.meta.url);
const contentRoot = new URL('../content/', import.meta.url);
const assets = new Map([
  ...['lamp', 'chair', 'desk'].map(name => [`/images/${name}.png`, 'image/png']),
  ...['storefront', 'workshop-app', 'fault-console', 'tools'].map(name => [`/${name}.mjs.LEGAL.txt`, 'text/plain; charset=utf-8']),
  ...['copy.mjs', 'challenges.mjs', 'storefront.mjs', 'workshop-app.mjs', 'workshop-state.mjs', 'fault-console.mjs', 'tools.mjs']
    .map(name => [`/${name}`, 'text/javascript; charset=utf-8']),
  ...['shared', 'challenge-1', 'challenge-2', 'challenge-3', 'challenge-4']
    .map(name => [`/content/${name}.json`, 'application/json; charset=utf-8'])
].map(([route, type]) => [route, { type, body: readFileSync(route.startsWith('/content/')
  ? new URL(route.slice('/content/'.length), contentRoot)
  : new URL(route.slice(1), webRoot)) }]));

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function renderPage(filename) {
  return readFileSync(new URL(filename, webRoot), 'utf8').replace(
    /\{\{(\w+)\.(\w+)\}\}/g,
    (_, section, key) => {
      const value = shared[section]?.[key];
      if (typeof value !== 'string') throw new Error(`Missing page copy: ${section}.${key}`);
      return escapeHtml(value);
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
