import { build } from 'esbuild';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'build');
mkdirSync(output, { recursive: true });
cpSync(path.join(root, 'public'), output, { recursive: true });

const pages = [
  { source:'storefront', bundle:'storefront', filename:'index', root:'storefront', body:'storefront-body' },
  { source:'workshop', bundle:'workshop-app', filename:'workshop', root:'workshop', body:'workshop-body' },
  { source:'fault-console', bundle:'fault-console', filename:'fault-console', root:'fault-console', body:'' },
  { source:'tools', bundle:'tools', filename:'tools', root:'tools', body:'' }
];

await Promise.all(pages.map(page => build({
  absWorkingDir: root, entryPoints: [`src/${page.source}.jsx`], outfile: `build/${page.bundle}.mjs`,
  bundle: true, minify: true, format: 'esm', target: 'es2022',
  external: ['/copy.mjs', '/workshop-state.mjs'], define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'linked'
})));

await Promise.all(['copy','challenges','workshop-state'].map(name => build({
  absWorkingDir: root, entryPoints: [`src/shared/${name}.js`], outfile:`build/${name}.mjs`,
  bundle: true, format:'esm', target:'es2022', supported:{'import-attributes':true}, plugins:[{
    name:'shared-browser-imports', setup(builder) {
      builder.onResolve({filter:/^\.\/(copy|challenges)\.js$/}, args => ({path:`/${path.basename(args.path,'.js')}.mjs`,external:true}));
    }
  }]
})));

// Browsers still need an HTML entry document; generate it instead of storing
// four duplicate shells next to the React source.
for (const page of pages) {
  writeFileSync(path.join(output,`${page.filename}.html`), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{pageTitle}}</title>
  <link rel="stylesheet" href="/site.css">
  <link rel="modulepreload" href="/${page.bundle}.mjs">
</head>
<body${page.body ? ` class="${page.body}"` : ''}>
  <div id="${page.root}-root"></div>
  <noscript>{{javascriptRequired}}</noscript>
  <script type="module" src="/${page.bundle}.mjs"></script>
</body>
</html>
`);
}
