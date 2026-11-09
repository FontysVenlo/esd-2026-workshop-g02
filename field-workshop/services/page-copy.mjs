import { readFileSync } from 'node:fs';
import path from 'node:path';
import { home } from '../src/shared/copy.js';
import storefront from '../content/storefront.json' with { type: 'json' };
import networkFaults from '../content/network-faults.json' with { type: 'json' };
import tools from '../content/tools.json' with { type: 'json' };

const bundled = { home, storefront, 'network-faults': networkFaults, tools };
let pages = bundled;
let lastRevision;

export function readPageCopy(name) {
  const live = process.env.WORKSHOP_LIVE_DIR;
  if (live) {
    const revision = readFileSync(path.join(live, 'revision'), 'utf8');
    if (revision !== lastRevision) {
      pages = JSON.parse(readFileSync(path.join(live, 'page-copy.json'), 'utf8'));
      lastRevision = revision;
    }
  }
  return pages[name];
}
