import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStorefrontServer } from '../services/storefront.mjs';
import {
  buildRecord, challenges, currentChallengeIndex, emptyProgress, isUnlocked, markStarted,
  needsFreshStart, normalizeProgress, saveDraft, submitChallenge, submittedCount
} from '../src/shared/workshop-state.js';

test('workshop overview, browser modules, and local tool guide are served', async () => {
  const server = createStorefrontServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const overview = await fetch(base);
    assert.equal(overview.status, 200);
    assert.match(overview.headers.get('content-type'), /text\/html/);
    const html = await overview.text();
    assert.match(html, /Reliability Workshop/);
    assert.match(html, /workshop-root/);
    assert.match(html, /src="\/workshop-app.mjs"/);
    const app = await fetch(`${base}/workshop-app.mjs`);
    assert.equal(app.status, 200);
    const appText = await app.text();
    assert.match(appText, /just-unlocked/);
    assert.match(appText, /http:\/\/localhost:3008/);
    assert.equal((await fetch(`${base}/workshop-state.mjs`)).status, 200);
    for (const module of ['copy', 'challenges', 'storefront', 'tools']) {
      const response = await fetch(`${base}/${module}.mjs`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /javascript/);
    }
    assert.doesNotMatch(html, /\{\{\w+\./);
    const styles = await fetch(`${base}/site.css`);
    assert.match(styles.headers.get('content-type'), /text\/css/);
    const css = await styles.text();
    assert.match(css, /@keyframes shackle-open/);
    assert.match(css, /@keyframes toast-arrive/);
    assert.match(css, /prefers-reduced-motion/);
    const guide = await fetch(`${base}/docs/tool-reference.md`);
    assert.equal(guide.status, 200);
    assert.match(await guide.text(), /Toxiproxy/);
    const tools = await fetch(`${base}/tools`);
    assert.equal(tools.status, 200);
    assert.match(await tools.text(), /tools-root/);
    assert.match(await (await fetch(`${base}/tools.mjs`)).text(), /Inventory latency/);
    const storefront = await (await fetch(`${base}/storefront`)).text();
    assert.match(storefront, /storefront-root/);
    assert.match(storefront, /src="\/storefront.mjs"/);
    const storefrontApp = await (await fetch(`${base}/storefront.mjs`)).text();
    assert.match(storefrontApp, /\/api\/catalog/);
    assert.doesNotMatch(storefrontApp, /\/api\/system|system-indicators/, 'customer page must not poll or show internal worker monitoring');
    for (const name of ['lamp', 'chair', 'desk']) {
      const image = await fetch(`${base}/images/${name}.png`);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/png');
      assert.deepEqual([...new Uint8Array(await image.arrayBuffer()).slice(0, 4)], [137, 80, 78, 71]);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('each submission reveals its solution and unlocks the next challenge', () => {
  let progress = emptyProgress();
  assert.equal(challenges.length, 4);
  assert.ok(challenges.every(challenge => challenge.solution.length >= 3));
  assert.equal(isUnlocked(progress, 0), true);
  assert.equal(isUnlocked(progress, 1), false);
  const arbitraryNotes = Object.fromEntries(challenges[0].fields.map(field => [field.key, 'my own observation, not a model answer']));
  progress = saveDraft(progress, challenges[0].id, arbitraryNotes);
  assert.equal(isUnlocked(progress, 1), false, 'a draft must not unlock the next task');
  assert.throws(() => submitChallenge(progress, challenges[1].id, arbitraryNotes), /locked/);
  assert.throws(() => submitChallenge(progress, challenges[0].id, { ...arbitraryNotes, conclusion: '  ' }), /Please fill in/);
  progress = submitChallenge(progress, challenges[0].id, arbitraryNotes, '2026-01-01T00:00:00.000Z');
  assert.equal(submittedCount(progress), 1);
  assert.equal(isUnlocked(progress, 1), true);
  assert.equal(isUnlocked(progress, 2), false);
  assert.equal(currentChallengeIndex(progress), 1);
  const restored = normalizeProgress(JSON.parse(JSON.stringify(progress)));
  assert.equal(restored.submissions[challenges[0].id].answers.conclusion, 'my own observation, not a model answer');
  assert.equal(isUnlocked(restored, 1), true);
});

test('submissions can be revised without relocking later challenges', () => {
  const answers = Object.fromEntries(challenges[0].fields.map(field => [field.key, 'initial note']));
  let progress = submitChallenge(emptyProgress(), challenges[0].id, answers, '2026-01-01T00:00:00.000Z');
  progress = submitChallenge(progress, challenges[0].id, { ...answers, conclusion: 'revised note' }, '2026-01-02T00:00:00.000Z');
  assert.equal(progress.submissions[challenges[0].id].answers.conclusion, 'revised note');
  assert.equal(isUnlocked(progress, 1), true);
  assert.equal(submittedCount(progress), 1);
});

test('all four challenges unlock sequentially and drafts do not unlock them', () => {
  let progress = emptyProgress();
  for (let index = 0; index < challenges.length; index++) {
    assert.equal(isUnlocked(progress, index), true);
    const challenge = challenges[index];
    const answers = Object.fromEntries(challenge.fields.map(field => [field.key, 'observed evidence']));
    progress = submitChallenge(progress, challenge.id, answers);
    if (index + 1 < challenges.length) assert.equal(isUnlocked(progress, index + 1), true);
  }
  assert.equal(submittedCount(progress), 4);
  assert.equal(currentChallengeIndex(progress), 3);
});

test('the downloadable record includes submitted evidence and current drafts', () => {
  const first = Object.fromEntries(challenges[0].fields.map(field => [field.key, 'measured evidence']));
  let progress = submitChallenge(emptyProgress(), challenges[0].id, first, '2026-01-01T00:00:00.000Z');
  progress = saveDraft(progress, challenges[1].id, { steadyState: 'working notes' });
  const record = buildRecord(progress, '2026-01-02T00:00:00.000Z');
  assert.equal(record.challenges.length, 4);
  assert.equal(record.challenges[0].submittedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(record.challenges[0].answers.conclusion, 'measured evidence');
  assert.equal('reviewedAt' in record.challenges[0], false);
  assert.equal(record.challenges[1].submittedAt, null);
  assert.equal(record.challenges[1].draftAnswers.steadyState, 'working notes');
});

test('each later challenge gets one fresh start, even when it already has notes', () => {
  const answers = index => Object.fromEntries(challenges[index].fields.map(field => [field.key, 'noted']));
  let progress = emptyProgress();
  assert.equal(needsFreshStart(progress, 0), false, 'Challenge 1 is never reset automatically');
  assert.equal(needsFreshStart(progress, 1), false, 'locked challenges are not reset');
  progress = submitChallenge(progress, challenges[0].id, answers(0));
  assert.equal(needsFreshStart(progress, 1), true);
  progress = markStarted(progress, challenges[1].id);
  assert.equal(needsFreshStart(progress, 1), false, 'returning to a started challenge keeps its faults');
  progress = submitChallenge(progress, challenges[1].id, answers(1));
  assert.equal(needsFreshStart(progress, 2), true);
  assert.equal(needsFreshStart(saveDraft(progress, challenges[2].id, { note: 'earlier run' }), 2), true);
  assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(progress))).started, progress.started);
  assert.deepEqual(normalizeProgress({ drafts: {}, submissions: {} }).started, {});
});
