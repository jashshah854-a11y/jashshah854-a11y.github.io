// Add one dated entry to the log, then rebuild the static list in log/index.html.
// One line:  node tools/add-log.mjs "2026-11-07 | film | Title | One sentence | ../films/#slug | ../films/slug/poster.jpg"  (last part, a still, is optional)
// Kinds: film, build, deck, experiment. href is relative to /log/ or a full URL.
// With no argument it only rebuilds the page from log/log.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = path.join(root, 'log', 'log.json');
const htmlPath = path.join(root, 'log', 'index.html');
const KINDS = ['film', 'build', 'deck', 'experiment'];
const LABEL = { film: 'Film', build: 'Build', deck: 'Deck', experiment: 'Experiment' };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const line = process.argv[2];
if (line) {
  const [date, kind, title, text, href, img] = line.split('|').map(s => s.trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || isNaN(Date.parse(date))) throw new Error('date must be YYYY-MM-DD');
  if (!KINDS.includes(kind)) throw new Error('kind must be one of ' + KINDS.join(', '));
  if (!title || !text || !href) throw new Error('need date | kind | title | text | href');
  if (entries.some(e => e.date === date && e.title === title)) throw new Error('entry already exists');
  entries.push(img ? { date, kind, title, text, href, img } : { date, kind, title, text, href });
}
entries.sort((a, b) => b.date.localeCompare(a.date));   // stable: same-day entries keep file order
// one object per line, easy to diff
fs.writeFileSync(jsonPath, '[\n' + entries.map(e => '  ' + JSON.stringify(e)).join(',\n') + '\n]\n');
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let html = '', cur = '';
for (const e of entries) {
  const [y, m, d] = e.date.split('-').map(Number);
  const key = `${MONTHS[m - 1]} ${y}`;
  if (key !== cur) { if (cur) html += '</ul>'; html += `<h2 class="month">${key}</h2><ul class="entries">`; cur = key; }
  const ext = /^https?:/.test(e.href);
  const thumb = e.img ? `<a class="thumb" href="${esc(e.href)}" tabindex="-1" aria-hidden="true"><img src="${esc(e.img)}" width="320" height="180" alt="" loading="lazy" decoding="async"></a>` : '';
  html += `<li class="entry${e.img ? ' has-img' : ''}" data-kind="${e.kind}"><div class="when dating"><time datetime="${e.date}">${d} ${MONTHS[m - 1].slice(0, 3)}</time><span class="kind">${LABEL[e.kind]}${ext ? ', on X' : ''}</span></div><div><h2><a href="${esc(e.href)}"${ext ? ' rel="noopener noreferrer"' : ''}>${esc(e.title)}</a></h2><p>${esc(e.text)}</p></div>${thumb}</li>`;
}
if (cur) html += '</ul>';
const page = fs.readFileSync(htmlPath, 'utf8');
const out = page.replace(/<!--log:start-->[\s\S]*<!--log:end-->/, `<!--log:start-->${html}<!--log:end-->`);
fs.writeFileSync(htmlPath, out);
console.log(`log: ${entries.length} entries${line ? ', added 1' : ''}`);
