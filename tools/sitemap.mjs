// Writes sitemap.xml for the public pages. Pages marked noindex are refused, so the sitemap can never contradict a page.
// No lastmod on purpose: a git date would go stale with every page commit and keep --check red.
//   node tools/sitemap.mjs          rewrite sitemap.xml
//   node tools/sitemap.mjs --check  exit 1 if sitemap.xml is out of date
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://jashshah854-a11y.github.io/';
const PAGES = ['', 'perpetua/', 'cyberpunk/', 'corner-block/', 'corner-block/story/', 'launchboard/', 'mgmtio/index.html',
  'round-and-round/', 'fieldfold/', 'workbench/', 'jev/',
  ...['russia-free-hand', 'houthis-saudi-pipeline', 'pakistan-india', 'right-question', 'agents-internet', 'over-engineering', 'posting-backfires'].map(s => `decks/${s}/index.html`)];

const file = p => (p === '' || p.endsWith('/') ? p + 'index.html' : p);
const entries = PAGES.map(p => {
  const f = file(p);
  if (!existsSync(ROOT + f)) throw new Error('missing page ' + f);
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(readFileSync(ROOT + f, 'utf8'))) throw new Error(f + ' is noindex; take it out of the list');
  return `  <url><loc>${SITE}${p}</loc></url>`;
});
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
const out = ROOT + 'sitemap.xml', old = existsSync(out) ? readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
if (process.argv.includes('--check')) {
  if (old !== xml) { console.error('sitemap: sitemap.xml is out of date; run node tools/sitemap.mjs'); process.exit(1); }
  console.log('sitemap: up to date');
} else if (old !== xml) { writeFileSync(out, xml); console.log(`sitemap: wrote ${entries.length} pages`); }
else console.log('sitemap: no change');
