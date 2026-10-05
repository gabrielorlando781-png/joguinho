import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// GitHub Pages can serve this single HTML file from main /docs. Embedding the
// build also makes it downloadable without a server or external assets.
const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const docs = resolve(root, 'docs');
let html = await readFile(resolve(dist, 'index.html'), 'utf8');
const script = /<script\b[^>]*src="([^"]+)"[^>]*><\/script>/;
const style = /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/;
const scriptMatch = html.match(script);
const styleMatch = html.match(style);
if (!scriptMatch || !styleMatch) throw new Error('Build did not contain the expected JS and CSS entrypoints.');

function assetPath(url) {
  if (!url.startsWith('/assets/') || url.includes('..')) throw new Error(`Unexpected build asset: ${url}`);
  return resolve(dist, url.slice(1));
}

const js = await readFile(assetPath(scriptMatch[1]), 'utf8');
const css = await readFile(assetPath(styleMatch[1]), 'utf8');
if (/<\/script/i.test(js) || /<\/style/i.test(css)) {
  throw new Error('Embedded build contains an unsafe closing tag.');
}
const favicon = await readFile(resolve(dist, 'favicon.svg'), 'utf8');
html = html.replace(script, () => `<script type="module">${js}</script>`);
html = html.replace(style, () => `<style>${css}</style>`);
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`);
await mkdir(docs, { recursive: true });
await writeFile(resolve(docs, 'index.html'), html);
await writeFile(resolve(docs, '.nojekyll'), '');
console.log('GitHub Pages build exported to docs/index.html');
