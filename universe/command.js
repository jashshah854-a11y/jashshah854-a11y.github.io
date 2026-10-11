/* Command bar: press ":" or "/" on a desktop, type a few letters, jump anywhere.
   It only lists places the site already has. Flying a stop, opening a sheet and walking into a deck
   all go through the callbacks it is given, so there is one copy of the navigation logic. */
import { STOP_NAMES } from './data.js';
import { slugOf } from './nav.js';

const MAX = 5;
const desktopInput = () => matchMedia('(hover:hover) and (pointer:fine)').matches;

/* Lower score is a better match: prefix, a word's prefix, anywhere inside, then letters in order. */
function score(keys, q){
  let best = 9;
  for (const k of keys) {
    let s = 9;
    if (k.startsWith(q)) s = 0;
    else if (k.split(/[\s&-]+/).some(w => w.startsWith(q))) s = 1;
    else if (k.includes(q)) s = 2;
    else if (q.length >= 3) { let i = 0; for (const c of k) if (c === q[i]) i++; if (i === q.length) s = 3; }
    best = Math.min(best, s);
  }
  return best;
}

export function createCommandBar({worlds, decks, stops, goStop, walkIn, openWorlds, openContact, blocked}){
  const root = document.getElementById('cmd'), input = document.getElementById('cmdInput'), listEl = document.getElementById('cmdList');
  const byId = Object.fromEntries(worlds.map(w => [w.id, w]));

  const items = [];
  for (const s of stops) {
    if (!(s.world || ['inside', 'vitrine', 'hall', 'end'].includes(s.id))) continue;   // the stops the arrows step through
    const name = s.world ? byId[s.world].pin : STOP_NAMES[s.id];
    items.push({label:name, keys:[name.toLowerCase(), slugOf(s), ...(s.id === 'end' ? ['end'] : [])], act:() => goStop(s.id)});
  }
  for (const d of decks) {
    items.push({label:d.title, tag:'Deck', keys:[d.title.toLowerCase(), d.slug], act:() => walkIn(`decks/${d.slug}/index.html`)});
  }
  items.push({label:'Contact', keys:['contact', 'email', 'resume', 'linkedin'], act:openContact, sheet:true});
  items.push({label:'Worlds', keys:['worlds', 'all worlds', 'list'], act:openWorlds, sheet:true});

  let shown = [], sel = 0, returnTo = null;
  const isOpen = () => !root.hidden;

  function select(i){
    sel = i;
    [...listEl.children].forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
    if (shown.length) input.setAttribute('aria-activedescendant', 'cmdopt' + i); else input.removeAttribute('aria-activedescendant');
  }
  function render(){
    const q = input.value.trim().toLowerCase();
    shown = !q ? [] : items.map((it, n) => ({it, n, s:score(it.keys, q)})).filter(m => m.s < 9)
      .sort((a, b) => a.s - b.s || a.n - b.n).slice(0, MAX).map(m => m.it);
    listEl.replaceChildren(...shown.map((it, i) => {
      const li = document.createElement('li');
      li.id = 'cmdopt' + i; li.setAttribute('role', 'option');
      const name = document.createElement('span'); name.textContent = it.label; li.append(name);
      if (it.tag) { const t = document.createElement('small'); t.textContent = it.tag; li.append(t); }
      return li;
    }));
    listEl.hidden = !shown.length;
    input.setAttribute('aria-expanded', String(shown.length > 0));
    select(0);
  }

  function open(){
    returnTo = document.activeElement;
    root.hidden = false; input.value = ''; render(); input.focus();
  }
  function close(restore){
    input.blur();               // a hidden field can keep focus a moment, and would swallow the next ":"
    root.hidden = true; input.value = '';
    if (restore && returnTo && returnTo.isConnected) returnTo.focus({preventScroll:true});
    returnTo = null;
  }
  function act(it){
    if (!it) return;
    close(!it.sheet);          // a sheet moves focus into itself; everything else gives it back
    it.act();
  }

  document.addEventListener('keydown', e => {
    if (isOpen() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== ':' && e.key !== '/') return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable], dialog')) return;
    if (blocked() || !desktopInput()) return;
    e.preventDefault();         // keep the typed ":" or "/" out of the field, and Firefox's quick find shut
    open();
  });

  input.addEventListener('input', render);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (shown.length) select((sel + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length);
    } else if (e.key === 'Enter') { e.preventDefault(); act(shown[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close(false);
  });
  listEl.addEventListener('mousedown', e => e.preventDefault());   // keep focus in the field
  listEl.addEventListener('click', e => { const li = e.target.closest('li'); if (li) act(shown[[...listEl.children].indexOf(li)]); });
  document.addEventListener('pointerdown', e => { if (isOpen() && !root.contains(e.target)) close(false); });
}
