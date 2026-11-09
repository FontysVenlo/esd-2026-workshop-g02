import assert from 'node:assert/strict';
import { test } from 'node:test';
import { format, home } from '../src/shared/copy.js';
import { renderPage } from '../services/web-content.mjs';

test('edited page text appears in HTML safely and placeholders are substituted as text', () => {
  const original = home.pageTitle;
  try {
    home.pageTitle = 'Shop <one> & "two"';
    const page = renderPage('workshop.html');
    assert.match(page, /Shop &lt;one&gt; &amp; &quot;two&quot;/);
    assert.doesNotMatch(page, /Shop <one>/);
    assert.equal(format(home.text.challenge, { number: '$&{number}' }), 'Challenge $&{number}');
  } finally {
    home.pageTitle = original;
  }
});

test('every HTML content reference resolves', () => {
  for (const filename of ['workshop.html', 'index.html', 'fault-console.html', 'tools.html']) {
    assert.doesNotMatch(renderPage(filename), /\{\{/);
  }
});

// Render the real route components so moving tasks off their page cannot regress.
test('each challenge shows its own complete tasks and page-local edits', async () => {
  const { readFileSync, unlinkSync } = await import('node:fs');
  const { fileURLToPath, pathToFileURL } = await import('node:url');
  const { build } = await import('esbuild');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const source = readFileSync(new URL('../src/workshop.jsx', import.meta.url), 'utf8')
    .replace("'/copy.mjs'", "'./shared/copy.js'")
    .replace("'/workshop-state.mjs'", "'./shared/workshop-state.js'")
    .replace(
      "createRoot(document.getElementById('workshop-root')).render(<Workshop />);",
      'export { Workshop, challenges, home };',
    );
  const output = fileURLToPath(new URL('../build/workshop-content-test.mjs', import.meta.url));
  const originalLocation = globalThis.location;
  const originalStorage = globalThis.localStorage;
  try {
    await build({
      stdin: {
        contents: source,
        loader: 'jsx',
        resolveDir: fileURLToPath(new URL('../src/', import.meta.url)),
      },
      outfile: output,
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
    });
    const { Workshop, challenges, home: page } = await import(pathToFileURL(output));
    globalThis.localStorage = {
      getItem: () =>
        JSON.stringify({
          drafts: {},
          submissions: Object.fromEntries(
            challenges.map((c) => [c.id, { submittedAt: '2026-11-06', answers: {} }]),
          ),
        }),
    };
    for (const challenge of challenges) {
      globalThis.location = { hash: '#' + challenge.id };
      const html = renderToStaticMarkup(React.createElement(Workshop));
      const menuEnd = html.indexOf('</nav>', html.indexOf('id="challenge-nav"'));
      const mainStart = html.indexOf('id="challenge-detail"');
      const instructions = html.slice(menuEnd, mainStart);
      assert.ok(menuEnd >= 0 && mainStart > menuEnd);
      assert.ok(instructions.includes('class="sidebar-instructions"'));
      for (const task of challenge.tasks) {
        assert.ok(
          instructions.includes(renderToStaticMarkup(React.createElement('h3', null, task.title))),
        );
        assert.ok(
          instructions.includes(
            renderToStaticMarkup(React.createElement('p', null, task.instruction)),
          ),
        );
      }
      assert.ok(html.includes(challenge.text.your_five_steps));
      assert.doesNotMatch(html, /experiment-guide|\{\{/);
      challenge.tasks[0].instruction = 'Unique edit for ' + challenge.id;
      challenge.text.experiment_notes = 'Notes for ' + challenge.id;
      const edited = renderToStaticMarkup(React.createElement(Workshop));
      assert.ok(edited.includes(challenge.tasks[0].instruction));
      assert.ok(edited.includes(challenge.text.experiment_notes));
    }
    globalThis.location = { hash: '#home' };
    const html = renderToStaticMarkup(React.createElement(Workshop));
    assert.ok(html.includes(page.guide.title));
    assert.match(html, /<details class="experiment-help experiment-guide"><summary>/);
    assert.doesNotMatch(html, /Unique edit for challenge/);
  } finally {
    globalThis.location = originalLocation;
    globalThis.localStorage = originalStorage;
    try {
      unlinkSync(output);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
});
