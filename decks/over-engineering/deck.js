import * as M from './model.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phoneMQ = matchMedia('(max-width: 820px), (max-aspect-ratio: 4/5)');

const stage = $('#stage');
const slides = $$('.slide');
const N = slides.length;
const vis = $('#vis');
const park = $('#park');
const countEl = $('#count');
const prevBtn = $('#prev');
const nextBtn = $('#next');
const srcPanel = $('#sources');
const srcBtn = $('#srcbtn');
let cur = -1;
let rig = null;
let scale = 1;

// ------------------------------------------------------------------ parts of Jash's real setup
const PARTS = [
  { name: 'Instruction file', verdict: 'The base. Everything else rests on it.', keep: true },
  { name: 'Four plain rules', verdict: 'Kept: model tiers, verify before claiming, design fidelity, the collision check.', keep: true },
  { name: 'Pre-tool hooks', verdict: 'Pulled back when I restarted from a lean base.' },
  { name: 'Injected ground rules', verdict: 'Removed in the same strip-down.' },
  { name: 'Preloaded context', verdict: 'About 200,000 tokens a turn. Now it loads on demand.' },
  { name: 'Hook governor', verdict: 'Inert. Its ledger last fired on Sept 9, and nothing was wired to it.' },
  { name: 'Routing layer', verdict: 'Changed no decisions. Chucked.' },
  { name: 'Dock', verdict: 'Answered "no doctrine matched". Chucked.' },
  { name: 'Status line', verdict: 'Cosmetic. Chucked.' },
  { name: 'Gate prestage job', verdict: 'Said "nothing to do" on every run since Sept 8. Switched off.' },
  { name: 'Telemetry flush job', verdict: 'Its spool has been empty since Aug 4. Switched off.' },
  { name: 'Weekly skill-loop job', verdict: 'Only refreshed data for pipelines that were already dead. Switched off.' },
];
const partName = (id) => (PARTS[id] ? PARTS[id].name : 'Something new');

// ------------------------------------------------------------------ scaling and layout
function fit() {
  if (phoneMQ.matches) { scale = 1; stage.style.removeProperty('--s'); return; }
  scale = Math.min(innerWidth / 1440, innerHeight / 810);
  stage.style.setProperty('--s', scale.toFixed(4));
  if (rig) syncSize();
}
addEventListener('resize', fit);
phoneMQ.addEventListener('change', () => { fit(); go(cur, { silent: true }); });

function syncSize() {
  const w = vis.clientWidth, h = vis.clientHeight;
  if (w > 0 && h > 0 && rig) rig.resize(w, h, phoneMQ.matches ? 1 : scale);
}
new ResizeObserver(syncSize).observe(vis);

// ------------------------------------------------------------------ readouts
const cache = new Map();
function setText(el, v) {
  if (cache.get(el) === v) return;
  cache.set(el, v);
  el.textContent = v;
}
function fmt1(x) { return x < 0.05 ? '0' : x.toFixed(1); }

function renderReadout(st) {
  const sl = slides[cur];
  if (!sl) return;
  const f = (k) => $(`[data-f="${k}"]`, sl);
  const n = f('n'); if (n) setText(n, String(st.n));
  const p = f('play'); if (p) setText(p, st.play.toFixed(1) + '°');
  const b = f('behind'); if (b) setText(b, fmt1(st.behind));
  const bar = f('bar'); if (bar) { const w = (st.reserve * 100).toFixed(1) + '%'; if (cache.get(bar) !== w) { cache.set(bar, w); bar.style.width = w; } }
  const rs = f('reserve');
  if (rs) setText(rs, st.reserve <= 0 ? 'Run down. Wind it up.' : `Reserve ${Math.round(st.reserveSec)} s`);
  $$('[data-act="wind"]', sl).forEach((btn) => btn.classList.toggle('attn', st.reserve < 0.18));
  const fn = H[cur] && H[cur].render;
  if (fn) fn(st);
}

// ------------------------------------------------------------------ rig helpers
function onCanon(st) { return st.ids.every((id, i) => id === i); }
function toCanonical(n) {
  const st = rig.state();
  if (onCanon(st) && st.n <= 12) rig.setCount(n);
  else rig.reset(n, true);
}
function windSoon() { if (rig) rig.wind(); }

// ------------------------------------------------------------------ per-slide behaviour
const H = {};

H[1] = {
  view: 'movement',
  enter() { toCanonical(2); windSoon(); },
  render(st) { const b = $('[data-act="add"]', slides[1]); if (b) b.disabled = st.n + rig.pending() >= 12; },
};
H[2] = {
  view: 'movement',
  enter() {
    toCanonical(12);
    windSoon();
  },
  render(st) {
    const sl = slides[2];
    const tok = $('[data-f="tok"]', sl), bar = $('[data-f="tokbar"]', sl);
    const frac = Math.min(1, st.n / 12);
    const w = (frac * 20).toFixed(1) + '%';
    if (cache.get(bar) !== w) { cache.set(bar, w); bar.style.width = w; }
    if (st.n >= 12 && rig.pending() === 0) setText(tok, 'About 200,000 tokens');
    else setText(tok, ' ');
  },
};
H[3] = {
  view: 'movement',
  enter() {
    toCanonical(12);
    windSoon();
    renderChips(rig.state());
    say(null);
  },
  render(st) { renderChips(st); },
  leave() { rig.highlightStage(null); },
};
H[4] = {
  view: 'ratchet',
  enter() { rig.reset(3, true); windSoon(); say('Every part clicks on. Try to take one off.'); $('[data-act="pawl"]', slides[4]).setAttribute('aria-pressed', 'false'); rig.setPawl(false); },
  render(st) { const b = $('[data-act="add"]', slides[4]); b.disabled = st.n >= 12; },
};
H[5] = {
  view: 'movement',
  enter() {
    toCanonical(2);
    windSoon();
    const inp = $('#grow'); inp.value = '2';
    placeMark();
  },
  render(st) {
    const sl = slides[5];
    const status = $('[data-f="status"]', sl);
    const good = lastGood();
    setText(status, st.keeps ? 'Keeps time.' : `Falls behind. The last version that kept time had ${good} parts.`);
  },
};
let smellsDone = false;
H[6] = {
  view: 'movement',
  enter() {
    smellsDone = false;
    if (rig.isCanonical(8)) { rig.setSmells(true); smellsDone = true; }
    else { const st = rig.state(); if (onCanon(st) && st.n < 12) rig.setCount(8); else rig.reset(8, true); }
    windSoon();
  },
  render(st) {
    if (!smellsDone && st.n === 8 && rig.pending() === 0) { rig.setSmells(true); smellsDone = true; }
  },
  leave() { rig.setSmells(false); rig.highlightSmell(null); $$('.smell').forEach((b) => b.classList.remove('pin')); },
};
H[7] = {
  view: 'movement',
  enter() { toCanonical(12); windSoon(); $('#chuck').value = '0'; },
};
H[8] = {
  view: 'movement',
  enter() {
    const st = rig.state();
    if (onCanon(st) && st.n <= 12 && st.n >= 2) rig.setCount(8); else rig.reset(8, true);
    windSoon();
    fillGive(); $('[data-act="swap"]', slides[8]).disabled = true;
    setText($('[data-f="status"]', slides[8]), '');
  },
  render(st) { fillGive(st); },
};
H[9] = {
  view: 'sundial',
  enter() { rig.setSmells(false); },
};

function say(text) {
  const el = $('[data-f="verdict"]', slides[cur >= 0 ? cur : 0]);
  if (el && text != null) el.textContent = text;
}

// slide 3 chips
function renderChips(st) {
  const box = $('[data-f="chips"]', slides[3]);
  if (!box.children.length) {
    PARTS.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.id = i;
      b.innerHTML = `<span>${p.name}</span><small></small>`;
      b.addEventListener('mouseenter', () => rig && rig.highlightStage(i));
      b.addEventListener('focus', () => rig && rig.highlightStage(i));
      b.addEventListener('mouseleave', () => rig && rig.highlightStage(null));
      b.addEventListener('click', () => ask(i));
      box.appendChild(b);
    });
  }
  $$('.chip', box).forEach((b) => {
    const id = +b.dataset.id;
    const present = st.ids.includes(id);
    b.classList.toggle('gone', !present);
    b.classList.toggle('kept', present && PARTS[id].keep && b.dataset.asked === '1');
    const sm = $('small', b);
    const t = !present ? 'out' : b.dataset.asked === '1' && PARTS[id].keep ? 'kept' : '';
    if (sm.textContent !== t) sm.textContent = t;
  });
}
function ask(id) {
  const p = PARTS[id];
  const chip = $(`.chip[data-id="${id}"]`);
  chip.dataset.asked = '1';
  const el = $('[data-f="verdict"]', slides[3]);
  el.innerHTML = '';
  const s = document.createElement('span'); s.textContent = p.name + '. ';
  el.append(s, document.createTextNode(p.verdict));
  const st = rig.state();
  if (!p.keep && st.ids.includes(id)) rig.chuckId(id);
  else rig.highlightStage(id);
  windIfLow();
}
function windIfLow() { if (rig.state().reserve < 0.25) rig.wind(); }

// slide 5 slider helpers
function lastGood() {
  let g = 2;
  for (let n = 2; n <= 12; n++) {
    const ids = [...Array(n).keys()];
    if (M.lossRate(ids) <= M.TOLERANCE) g = n;
  }
  return g;
}
function placeMark() {
  const m = $('[data-f="mark"]', slides[5]);
  const pct = ((lastGood() - 2) / 10) * 100;
  m.style.left = `calc(${pct}% + ${(0.5 - pct / 100) * 28}px)`;
}

// slide 8 select
function fillGive(st) {
  const sel = $('[data-f="give"]', slides[8]);
  const s = st || (rig && rig.state());
  if (!s) return;
  const key = s.ids.join(',');
  if (sel.dataset.key === key) return;
  sel.dataset.key = key;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Choose a part</option>' + s.ids.filter((id) => id !== 0).map((id) => `<option value="${id}">${partName(id)}</option>`).join('');
  if (prev && s.ids.includes(+prev)) sel.value = prev;
  $('[data-act="swap"]', slides[8]).disabled = !sel.value;
}

// ------------------------------------------------------------------ controls (wired once)
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t || !rig) return;
  const act = t.dataset.act;
  if (act === 'wind') rig.wind();
  else if (act === 'add') { if (rig.state().n + rig.pending() < 12) rig.add(); windIfLow(); if (cur === 4) say('A part clicked on. The pawl dropped behind it.'); }
  else if (act === 'chuck') {
    const r = rig.tryChuck();
    if (r === 'blocked') say('The pawl holds. It only turns one way.');
    else if (r === 'ok') { $('[data-act="pawl"]', slides[4]).setAttribute('aria-pressed', 'false'); say('Pawl lifted, one part came off. You had to mean it.'); }
    else say('Two parts is the least this movement runs on.');
  } else if (act === 'pawl') {
    const on = t.getAttribute('aria-pressed') !== 'true';
    t.setAttribute('aria-pressed', String(on));
    rig.setPawl(on);
    say(on ? 'Pawl lifted. Now chuck one.' : 'Pawl down.');
  } else if (act === 'swap') {
    const sel = $('[data-f="give"]', slides[8]);
    const id = +sel.value;
    if (!sel.value) return;
    const nm = partName(id);
    rig.swap(id);
    sel.value = '';
    t.disabled = true;
    setText($('[data-f="status"]', slides[8]), `Gave up ${nm.toLowerCase()}, added one. Still ${rig.state().n} parts.`);
    windIfLow();
  }
});
$('#grow').addEventListener('input', (e) => { if (rig) { rig.setCount(+e.target.value); windIfLow(); } });
$('#chuck').addEventListener('input', (e) => { if (rig) { rig.setCount(12 - +e.target.value); windIfLow(); } });
$('[data-f="give"]').addEventListener('change', (e) => { $('[data-act="swap"]', slides[8]).disabled = !e.target.value; });
$$('.smell').forEach((b) => {
  const k = b.dataset.k;
  b.addEventListener('mouseenter', () => rig && rig.highlightSmell(k));
  b.addEventListener('focus', () => rig && rig.highlightSmell(k));
  b.addEventListener('mouseleave', () => rig && rig.highlightSmell($('.smell.pin') ? $('.smell.pin').dataset.k : null));
  b.addEventListener('blur', () => rig && rig.highlightSmell($('.smell.pin') ? $('.smell.pin').dataset.k : null));
  b.addEventListener('click', () => {
    const was = b.classList.contains('pin');
    $$('.smell').forEach((x) => x.classList.remove('pin'));
    if (!was) b.classList.add('pin');
    rig && rig.highlightSmell(was ? null : k);
  });
});
$('#wind0').addEventListener('click', () => go(1));

// ------------------------------------------------------------------ navigation
function go(i, opts = {}) {
  i = Math.max(0, Math.min(N - 1, i));
  const prev = cur;
  if (prev !== i && H[prev] && H[prev].leave && rig) H[prev].leave();
  cur = i;
  slides.forEach((s, k) => { s.classList.toggle('on', k === i); if (k !== i) s.setAttribute('aria-hidden', 'true'); else s.removeAttribute('aria-hidden'); });
  stage.classList.toggle('is-first', i === 0);
  countEl.textContent = `${i + 1} of ${N}`;
  prevBtn.disabled = i === 0;
  nextBtn.disabled = i === N - 1;
  if (!opts.silent && location.hash !== '#' + (i + 1)) history.replaceState(null, '', '#' + (i + 1));
  if (phoneMQ.matches) scrollTo(0, 0);
  document.title = i === 0 ? 'Everything is possible. That is the problem.' : $('h2', slides[i]).textContent + ' | Over-engineering';

  const slot = $('.slot', slides[i]);
  if (slot) { slot.appendChild(vis); } else { park.appendChild(vis); }
  const h = H[i];
  if (rig) {
    if (h) { rig.setView(h.view); rig.setActive(true); if (prev !== i || opts.force) { cache.clear(); h.enter(); } }
    else { rig.setView(null); rig.setActive(false); }
    syncSize();
    renderReadout(rig.state());
  }
}
function next() { go(cur + 1); }
function prevSlide() { go(cur - 1); }
nextBtn.addEventListener('click', next);
prevBtn.addEventListener('click', prevSlide);

addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = e.target.tagName;
  if (e.key === 'Escape') { closeSources(); return; }
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
    if (e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'PageUp') { e.preventDefault(); prevSlide(); }
    return;
  }
  const interactive = e.target.closest('button,a');
  if ((e.key === ' ' || e.key === 'Enter') && interactive) return;
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': e.preventDefault(); next(); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': e.preventDefault(); prevSlide(); break;
    case 'Home': e.preventDefault(); go(0); break;
    case 'End': e.preventDefault(); go(N - 1); break;
  }
});
let tx = 0, ty = 0, tTarget = null;
addEventListener('touchstart', (e) => { tTarget = e.target; tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', (e) => {
  if (!tTarget || tTarget.closest('input,select,#sources')) return;
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { dx < 0 ? next() : prevSlide(); }
}, { passive: true });
addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= N && n - 1 !== cur) go(n - 1, { silent: true }); });

// sources panel
function openSources() { srcPanel.classList.add('open'); srcBtn.setAttribute('aria-expanded', 'true'); $('#srcx').focus(); }
function closeSources() { if (!srcPanel.classList.contains('open')) return; srcPanel.classList.remove('open'); srcBtn.setAttribute('aria-expanded', 'false'); srcBtn.focus(); }
srcBtn.addEventListener('click', () => (srcPanel.classList.contains('open') ? closeSources() : openSources()));
$('#srcx').addEventListener('click', closeSources);

// ------------------------------------------------------------------ boot
fit();
const startHash = parseInt(location.hash.slice(1), 10);
go(startHash >= 1 && startHash <= N ? startHash - 1 : 0, { silent: true });

(async function loadRig() {
  await new Promise((r) => setTimeout(r, 30));
  try {
    const mod = await import('./scene.js');
    rig = mod.createRig({ canvas: $('#gl'), reduced });
    rig.onState((st) => renderReadout(st));
    $('#gl').addEventListener('webglcontextlost', (e) => { e.preventDefault(); vis.classList.add('failed'); });
    vis.classList.remove('loading-on');
    syncSize();
    go(cur, { silent: true, force: true });
    window.__rig = rig;
  } catch (err) {
    console.warn('movement unavailable', err);
    vis.classList.remove('loading-on');
    vis.classList.add('failed');
  }
})();

document.addEventListener('visibilitychange', () => { if (rig) rig.setActive(document.visibilityState === 'visible' && !!H[cur]); });
window.__deck = { go, get cur() { return cur; } };
