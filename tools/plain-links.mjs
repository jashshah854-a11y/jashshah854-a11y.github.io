// Writes the two plain-link lists in index.html (#plain for a failed 3D start, noscript for no JS) from universe/data.js,
// so a world or deck added there cannot go missing here. Run after editing data.js:
//   node tools/plain-links.mjs          rewrite index.html
//   node tools/plain-links.mjs --check  exit 1 if index.html is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { WORLDS, DECKS, LINKEDIN, EMAIL } from '../universe/data.js';

const file = new URL('../index.html', import.meta.url);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const li = (href, text, ext) => `<li><a href="${esc(href)}"${ext ? ' rel="noopener noreferrer"' : ''}>${esc(text)}</a></li>`;

// Perpetua stands in the vitrine, not in WORLDS; worlds without a page of their own (decks wing, video, Singular) are skipped.
const worlds = [li('perpetua/', 'Perpetua'), ...WORLDS.filter(w => w.href).map(w => li(w.href, w.pin))].join('');
const reach = li(LINKEDIN, 'LinkedIn', true) + li('mailto:' + EMAIL, 'Email');
const decks = DECKS.map(d => li(`decks/${d.slug}/index.html`, d.title)).join('');
const lists = nl => `<ul>${worlds}${reach}</ul>${nl}<p>The decks:</p><ul>${decks}</ul>`;

const src = readFileSync(file, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
let hits = 0;
const out = src
  .replace(/(<nav id="plain"[^>]*><p>[^<]*<\/p>\r?\n)[\s\S]*?(<\/nav>)/, (m, a, b) => (hits++, a + lists(nl) + b))
  .replace(/(<noscript><div class="noscript"><p>[^<]*<\/p>\r?\n)[\s\S]*?(<\/div><\/noscript>)/, (m, a, b) => (hits++, a + lists(nl) + b));
if (hits !== 2) { console.error(`plain-links: found ${hits} of 2 lists in index.html`); process.exit(2); }

if (process.argv.includes('--check')) {
  if (out !== src) { console.error('plain-links: index.html is out of date; run node tools/plain-links.mjs'); process.exit(1); }
  console.log('plain-links: up to date');
} else if (out !== src) { writeFileSync(file, out); console.log('plain-links: index.html updated'); }
else console.log('plain-links: no change');
