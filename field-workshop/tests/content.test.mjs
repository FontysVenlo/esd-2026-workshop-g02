import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copy, shared } from '../web/copy.mjs';
import { renderPage } from '../services/web-content.mjs';

test('edited shared text appears in HTML safely and placeholders are substituted as text', () => {
  const original = shared.workshopPage.northstar_supply;
  try {
    shared.workshopPage.northstar_supply = 'Shop <one> & "two"';
    const page = renderPage('workshop.html');
    assert.match(page, /Shop &lt;one&gt; &amp; &quot;two&quot;/);
    assert.doesNotMatch(page, /Shop <one>/);
    assert.equal(copy('workshop', 'challenge', { number: '$&{number}' }), 'Challenge $&{number}');
  } finally {
    shared.workshopPage.northstar_supply = original;
  }
});

test('every HTML content reference resolves', () => {
  for (const filename of ['workshop.html', 'index.html', 'fault-console.html', 'tools.html']) {
    assert.doesNotMatch(renderPage(filename), /\{\{\w+\./);
  }
});
