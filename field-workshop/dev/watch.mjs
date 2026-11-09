import { cpSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const output = process.env.WORKSHOP_LIVE_DIR;
if (!output) throw new Error('Set WORKSHOP_LIVE_DIR to the development output directory.');
mkdirSync(output, { recursive: true });

// Polling also detects atomic editor saves across Docker Desktop bind mounts.
function snapshot(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return snapshot(file);
    const { mtimeMs, size } = statSync(file);
    return [file, mtimeMs, size];
  });
}

let previous;
function refresh() {
  try {
    const current = JSON.stringify(['content', 'src', 'public'].map(snapshot));
    if (current === previous) return;
    previous = current;
    const result = spawnSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
    if (result.status !== 0) return;
    cpSync('build', output, { recursive: true });
    cpSync('dev/reload.js', path.join(output, 'reload.js'));
    cpSync('content/home.json', path.join(output, 'home.json'));
    writeFileSync(path.join(output, 'revision.next'), randomUUID());
    renameSync(path.join(output, 'revision.next'), path.join(output, 'revision'));
    console.log('Pages updated. Workshop: http://localhost:8088');
  } catch (error) {
    console.error(error.message);
    previous = undefined;
  }
}
refresh();
setInterval(refresh, 600);
