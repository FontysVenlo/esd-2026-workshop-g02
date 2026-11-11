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

test('only Challenge 3 shows optional hints; Challenge 4 shows partner round controls', async () => {
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
      assert.equal(
        instructions.includes('class="sidebar-instructions"'),
        Boolean(challenge.hints?.length),
      );
      assert.doesNotMatch(instructions, /challenge-ready/);
      assert.doesNotMatch(instructions, /class="challenge-steps"|Your tasks/);
      for (const hint of challenge.hints ?? []) {
        assert.ok(
          instructions.includes(
            renderToStaticMarkup(React.createElement('summary', null, hint.title)),
          ),
        );
        assert.ok(
          instructions.includes(
            renderToStaticMarkup(React.createElement('p', null, hint.explanation)),
          ),
        );
      }
      assert.doesNotMatch(instructions, /<details[^>]*\bopen\b/);
      if (challenge.competition) {
        assert.ok(html.includes(challenge.competition.start));
        assert.ok(html.includes(challenge.competition.stop));
        assert.ok(html.includes(format(challenge.competition.elapsed, { seconds: 0 })));
      }
      assert.doesNotMatch(html, /experiment-guide|\{\{/);
      if (challenge.hints) challenge.hints[0].explanation = 'Unique edit for ' + challenge.id;
      challenge.text.experiment_notes = 'Notes for ' + challenge.id;
      const edited = renderToStaticMarkup(React.createElement(Workshop));
      if (challenge.hints) assert.ok(edited.includes(challenge.hints[0].explanation));
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

test('storefront shows valid shipping quotes and hides stock counts after failed refreshes', async () => {
  const { readFileSync, unlinkSync } = await import('node:fs');
  const { fileURLToPath, pathToFileURL } = await import('node:url');
  const { build } = await import('esbuild');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const page = JSON.parse(
    readFileSync(new URL('../content/storefront.json', import.meta.url), 'utf8'),
  );
  const source = readFileSync(new URL('../src/storefront.jsx', import.meta.url), 'utf8')
    .replace("'/copy.mjs'", "'./shared/copy.js'")
    .replace(
      "createRoot(document.getElementById('storefront-root')).render(<Storefront />);",
      'export {ProductCard};',
    );
  const out = fileURLToPath(new URL('../build/shipping-display-test.mjs', import.meta.url));
  try {
    await build({
      stdin: {
        contents: source,
        loader: 'jsx',
        resolveDir: fileURLToPath(new URL('../src/', import.meta.url)),
      },
      outfile: out,
      bundle: true,
      format: 'esm',
      platform: 'node',
      packages: 'external',
    });
    const { ProductCard } = await import(pathToFileURL(out));
    const product = {
      sku: 'LAMP-01',
      name: page.api.product_name,
      price: 29.9,
      image: '/images/lamp.png',
    };
    const result = {
      inventory: { source: 'live', quantity: 12 },
      shipping: { source: 'backup', priceEur: 4.9, etaDays: 5 },
      degraded: true,
    };
    const html = renderToStaticMarkup(
      React.createElement(ProductCard, { product, result, stale: false, preview: true }),
    );
    assert.ok(html.includes(format(page.storefront.shipping_time, { days: 5 })));
    assert.ok(html.includes(format(page.storefront.shipping_cost, { price: '4.90' })));
    assert.doesNotMatch(html, /Backup carrier|backup provider|circuit breaker/i);
    assert.ok(html.includes(page.catalog.live));
    const stale = renderToStaticMarkup(
      React.createElement(ProductCard, { product, result, stale: true, preview: true }),
    );
    assert.ok(stale.includes(page.storefront.shipping_time_unavailable));
    assert.doesNotMatch(stale, /Backup carrier|backup provider|circuit breaker/i);
    const availability = renderToStaticMarkup(
      React.createElement(ProductCard, { product, result, stale: false, preview: false }),
    );
    assert.ok(availability.includes(format(page.storefront.shipping_time, { days: 5 })));
    assert.ok(availability.includes(format(page.storefront.shipping_cost, { price: '4.90' })));
    assert.ok(availability.includes(page.storefront.last_delivery_check));
    const missingDelivery = renderToStaticMarkup(
      React.createElement(ProductCard, { product, stale: false, preview: true }),
    );
    assert.ok(missingDelivery.includes(page.storefront.shipping_time_not_checked));
    assert.ok(missingDelivery.includes(page.storefront.shipping_cost_not_checked));
    for (const sku of ['LAMP-01', 'CHAIR-02', 'DESK-03']) {
      const failed = renderToStaticMarkup(
        React.createElement(ProductCard, {
          product: { ...product, sku },
          result,
          stale: true,
          failed: true,
        }),
      );
      assert.match(failed, /class="react-product failed"/);
      assert.match(failed, /class="product-state state-failed"/);
      assert.ok(failed.includes(page.storefront.stock_unavailable));
      assert.ok(failed.includes(page.catalog.unavailable));
      assert.ok(!failed.includes(format(page.storefront.in_stock, { quantity: 12 })));
    }
    assert.doesNotMatch(stale, /state-failed|stock-unavailable/);
    assert.ok(html.includes(format(page.storefront.in_stock, { quantity: 12 })));
    assert.doesNotMatch(html, /state-failed|stock-unavailable/);
    const invalid = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product,
        result,
        stale: false,
        preview: true,
        shippingQuote: { source: 'live', etaDays: -2, priceEur: -4.9 },
      }),
    );
    assert.ok(invalid.includes(format(page.storefront.shipping_time, { days: -2 })));
    assert.ok(invalid.includes(format(page.storefront.shipping_cost, { price: '-4.90' })));
    const empty = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product,
        result,
        stale: false,
        preview: true,
        shippingQuote: { source: 'live', etaDays: null, priceEur: null },
      }),
    );
    assert.ok(empty.includes(page.storefront.shipping_time_missing));
    assert.ok(empty.includes(page.storefront.shipping_cost_missing));
    const rejected = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product,
        result,
        stale: false,
        preview: true,
        shippingQuote: { source: 'rejected', etaDays: null, priceEur: null },
      }),
    );
    assert.ok(rejected.includes(page.storefront.shipping_time_unavailable));
    assert.ok(rejected.includes(page.storefront.shipping_cost_unavailable));
    assert.ok(rejected.includes(format(page.storefront.in_stock, { quantity: 12 })));
    assert.ok(rejected.includes(page.catalog.limited));
  } finally {
    unlinkSync(out);
  }
});
