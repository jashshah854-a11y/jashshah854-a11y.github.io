import * as M from './model.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phoneMQ = matchMedia('(max-width: 820px), (max-aspect-ratio: 4/5)');

const stage = $('#stage');
const slides = $$('.slide');
const N = slides.length;
const vis = $('#vis');
const cn = $('#cn'), cs = $('#cs'), countEl = $('#count');
const prevBtn = $('#prev'), nextBtn = $('#next'), srcBtn = $('#srcbtn'), sndBtn = $('#snd');
const srcPanel = $('#sources');
let cur = -1;
let rig = null;
let rigFailed = false;
let scale = 1;

// ------------------------------------------------------------------ the one state the controls turn
const BASE = { posts: 0, idRel: true, pub: true, pre: true, days: 0, central: false, frame: false, reward: false, focus: 2 };
const S = { ...BASE };

// what each slide starts with (slide numbers are 1-indexed)
const PRESET = {
  2: { posts: 0 },
  3: { posts: 0 },
  4: { posts: 0 },
  5: { posts: 4 },
  6: { posts: 5 },
  7: { posts: 5 },
  8: { posts: 5 },
  9: { posts: 5 },
  10: { posts: 6 },
  11: { posts: 5 },
  12: { posts: 6 },
  13: { posts: 7 },
};
// the camera shot each slide asks the stage for (see SHOTS in scene.js)
const SHOT = {
  2: 'crowd', 3: 'setlist', 4: 'mic', 5: 'three', 6: 'split', 7: 'left',
  8: 'high', 9: 'desk', 10: 'pull', 11: 'desk', 12: 'wide', 13: 'hero',
};
// which tape labels light up on which slide: the stage of the loop each study lives at
const LIGHT = {
  2: [], 3: [], 4: [],
  5: ['urge'],
  6: ['post'],
  7: ['post', 'audience'],
  8: ['enough'],
  9: ['urge'],
  10: ['echo'],
  11: [],
  12: [],
  13: [],
};

function cond(over = {}) {
  return {
    posts: S.posts, idRelevant: S.idRel, pub: S.pub, pre: S.pre,
    days: S.days, central: S.central, frame: S.frame, reward: S.reward, ...over,
  };
}
const gain = () => M.loopGain(cond());
const gain2 = () => M.loopGain(cond({ idRelevant: false }));

// ------------------------------------------------------------------ scaling and the phone reader
function fit() {
  if (phoneMQ.matches) { scale = 1; stage.style.removeProperty('--s'); return; }
  scale = Math.min(innerWidth / 1440, innerHeight / 810);
  stage.style.setProperty('--s', scale.toFixed(4));
}
function syncSize() {
  if (!rig) return;
  const w = vis.clientWidth, h = vis.clientHeight;
  if (w > 0 && h > 0) rig.resize(w, h, phoneMQ.matches ? 1 : scale);
}
function placeVis() {
  if (phoneMQ.matches) {
    const slot = $('.slot', slides[cur]);
    if (slot && cur > 0) slot.appendChild(vis);
  } else if (vis.parentNode !== stage || stage.firstElementChild !== vis) {
    stage.insertBefore(vis, stage.firstChild);
  }
}
addEventListener('resize', () => { fit(); syncSize(); });
phoneMQ.addEventListener('change', () => {
  fit();
  if (rig) rig.setLayout(phoneMQ.matches ? 'phone' : 'desk');
  placeVis(); syncSize();
});
new ResizeObserver(syncSize).observe(vis);

// ------------------------------------------------------------------ words that follow the scope
function band(G) {
  if (G < 0.05) return 'The mic is cold. The urge to buy is the only signal.';
  if (G < 0.6) return 'Quiet. The urge is clean on the scope.';
  if (G < 0.9) return 'Louder. Each pass comes back, and the urge is still easy to see.';
  if (G < 1) return 'Close to unity. The loop is ringing.';
  return 'Past unity. The post answers the urge, and the trace clips.';
}
function statusText(n) {
  const G = gain();
  switch (n) {
    case 4: return S.posts === 0 ? 'Post it, and watch the signal go round: the urge, the post, the audience, the echo.' : band(G);
    case 5:
      if (!S.idRel) return 'Functional product: nothing about you to say, so nothing comes back. Clean.';
      return band(G);
    case 6:
      if (S.focus === 0) return 'Searched only: the urge to buy is intact. Nothing comes back.';
      if (S.focus === 1) return 'Searched and posted: the loop closes. The post answers the urge.';
      return 'Left, searched only: clean. Right, searched and posted: the loop closes.';
    case 7: {
      if (!S.pub && !S.idRel) return 'Private and functional: no audience, no identity. Clean.';
      if (!S.pub) return 'Private: nobody heard it, so nothing comes back. Clean.';
      if (!S.idRel) return 'Functional: no identity to answer. Clean.';
      return 'Public and identity: both switches on. The loop closes.';
    }
    case 8: {
      const need = S.central ? 'Central identity: one post feels too light.' : 'Casual identity: one post feels like enough.';
      return need + ' ' + (G >= 1 ? 'Past unity.' : 'Below unity, the urge to buy is still there.');
    }
    case 9: {
      const a = gain(), b = gain2();
      return `Eco backpack: ${a >= 1 ? 'past unity, clipped' : 'below unity, clean'}. Plain bag: ${b >= 1 ? 'past unity' : 'below unity, clean'}.`;
    }
    case 10: {
      const d = S.days;
      const when = d === 0 ? 'Today' : d === 1 ? 'Day 1' : `Day ${d}`;
      return G >= 1
        ? `${when}: still past unity. The post still answers the urge.`
        : `${when}: below unity. The echo has died and the urge to buy is back.`;
    }
    case 11: {
      const miss = [];
      if (!S.idRel) miss.push('identity product');
      if (!S.pub) miss.push('public');
      if (!S.pre) miss.push('before buying');
      if (S.days > 0) miss.push('still on your mind');
      if (S.central) miss.push('moderate identity');
      if (!miss.length) return 'All five hold. ' + band(G);
      return `Missing: ${miss.join(', ')}. ` + (G >= 1 ? 'Still past unity.' : 'The loop stays quiet.');
    }
    case 12: {
      const on = [S.pre ? 0 : 1, S.days > 0 ? 1 : 0, S.frame ? 1 : 0, S.reward ? 1 : 0].reduce((a, b) => a + b, 0);
      if (!on) return 'Nothing applied. The loop is past unity.';
      return G >= 1 ? 'Applied, and still past unity. Add another.' : `Applied: ${on}. Below unity. The urge to buy survives.`;
    }
    case 13: return S.posts === 0 ? 'Mic cut. The urge to buy is back.' : 'Past unity. The post is doing the buying.';
    default: return '';
  }
}

function paintStatus() {
  const sl = slides[cur];
  const el = $('[data-f="status"]', sl);
  if (!el) return;
  const t = statusText(cur + 1);
  if (el.textContent !== t) el.textContent = t;
  el.classList.toggle('hot', gain() >= 1);
}

function paintControls() {
  const sl = slides[cur];
  const post = $('[data-act="post"]', sl);
  if (post) post.disabled = S.posts >= M.MAX_POSTS;
  const cut = $('[data-act="cut"]', sl);
  if (cut) cut.disabled = S.posts === 0;
  const again = $('[data-act="again"]', sl);
  if (again) again.disabled = S.posts >= 7;
}

function paintCounter() {
  const G = cur === 0 ? 0 : gain();
  const over = G >= 1;
  cn.textContent = String(cur + 1);
  cs.textContent = over ? 'above unity' : 'below unity';
  countEl.classList.toggle('over', over);
}

function apply(snap = false) {
  if (cur < 1) return;
  const dual = cur + 1 === 9;
  if (rig) rig.set({
    G: gain(), G2: dual ? gain2() : 0, dual,
    nameA: 'eco backpack', nameB: 'plain bag', hl: LIGHT[cur + 1] || [],
    shot: SHOT[cur + 1] || 'desk', focus: S.focus, days: S.days, posts: S.posts,
  }, snap || reduced);
  paintCounter(); paintStatus(); paintControls();
}

// ------------------------------------------------------------------ controls
function setPressed(btn, v) { btn.setAttribute('aria-pressed', v ? 'true' : 'false'); }

function syncControls() {
  const sl = slides[cur];
  $$('[data-set]', sl).forEach((b) => {
    const [k, v] = b.dataset.set.split('=');
    const val = k === 'focus' ? S.focus === Number(v) : k === 'posts' ? S.posts === Number(v) || (k === 'posts' && Number(v) === 5 && S.posts >= 5) : (k === 'central' ? S.central === (v === '1') : S[k] === (v === '1'));
    setPressed(b, val);
  });
  $$('[data-tog]', sl).forEach((b) => {
    const t = b.dataset.tog;
    const on = {
      idRel: S.idRel, pub: S.pub, pre: S.pre, fresh: S.days === 0, mod: !S.central,
      after: !S.pre, wait: S.days > 0, func: S.frame, reward: S.reward,
    }[t];
    setPressed(b, on);
  });
  const days = $('#days', sl);
  if (days) { days.value = String(S.days); $('[data-f="days"]', sl).textContent = String(S.days); }
}

function onClick(e) {
  const b = e.target.closest('button');
  if (!b || cur < 1 || !slides[cur].contains(b)) return;
  if (b.dataset.act === 'post') {
    if (S.posts < M.MAX_POSTS) S.posts += 1;
    if (rig) rig.post();
    syncControls(); apply();
  } else if (b.dataset.act === 'cut') {
    S.posts = 0; syncControls(); apply();
  } else if (b.dataset.act === 'again') {
    S.posts = 7; syncControls(); apply();
  } else if (b.dataset.set) {
    const [k, v] = b.dataset.set.split('=');
    if (k === 'posts') S.posts = Number(v);
    else if (k === 'focus') S.focus = Number(v);
    else if (k === 'central') S.central = v === '1';
    else S[k] = v === '1';
    syncControls(); apply();
  } else if (b.dataset.tog) {
    const t = b.dataset.tog;
    const wasOn = b.getAttribute('aria-pressed') === 'true';
    const on = !wasOn;
    if (t === 'idRel') S.idRel = on;
    else if (t === 'pub') S.pub = on;
    else if (t === 'pre') S.pre = on;
    else if (t === 'fresh') S.days = on ? 0 : 14;
    else if (t === 'mod') S.central = !on;
    else if (t === 'after') S.pre = !on;
    else if (t === 'wait') S.days = on ? 8 : 0;
    else if (t === 'func') S.frame = on;
    else if (t === 'reward') S.reward = on;
    syncControls(); apply();
  }
}
stage.addEventListener('click', onClick);
$('#days').addEventListener('input', (e) => {
  S.days = Number(e.target.value);
  $('[data-f="days"]', slides[9]).textContent = String(S.days);
  apply();
});

// ------------------------------------------------------------------ navigation
function go(i, opt = {}) {
  i = Math.max(0, Math.min(N - 1, i));
  if (i === cur && !opt.force) return;
  const was = cur;
  cur = i;
  slides.forEach((s, k) => {
    const on = k === i;
    s.classList.toggle('on', on);
    s.toggleAttribute('inert', !on);
    s.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  stage.classList.toggle('has-vis', i > 0);
  prevBtn.hidden = i === 0;
  sndBtn.hidden = i === 0;
  srcBtn.textContent = i === 0 ? 'The study' : 'Sources';
  nextBtn.disabled = i === N - 1;
  if (i > 0) {
    Object.assign(S, BASE, PRESET[i + 1] || {});
    syncControls();
  }
  placeVis();
  if (rig) rig.setActive(i > 0);
  if (i > 0) { ensureRig().then(() => { apply(was < 1 || reduced); syncSize(); }); apply(false); }
  else { paintCounter(); }
  if (!opt.silent) {
    const h = '#' + (i + 1);
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  if (phoneMQ.matches && was !== -1) scrollTo(0, 0);
}
const next = () => go(cur + 1);
const prev = () => go(cur - 1);
nextBtn.addEventListener('click', next);
prevBtn.addEventListener('click', prev);

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (e.key === 'Escape') { closeSources(); return; }
  if (srcPanel.classList.contains('open')) return;
  const onRange = t && t.tagName === 'INPUT';
  const onBtn = t && t.tagName === 'BUTTON';
  if (e.key === 'ArrowRight' && !onRange) { e.preventDefault(); next(); }
  else if (e.key === 'ArrowLeft' && !onRange) { e.preventDefault(); prev(); }
  else if (e.key === 'PageDown') { e.preventDefault(); next(); }
  else if (e.key === 'PageUp') { e.preventDefault(); prev(); }
  else if (e.key === ' ' && !onBtn && !onRange) { e.preventDefault(); e.shiftKey ? prev() : next(); }
  else if (e.key === 'Home' && !onRange) { go(0); }
  else if (e.key === 'End' && !onRange) { go(N - 1); }
});
let tx = 0, ty = 0;
stage.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
stage.addEventListener('touchend', (e) => {
  if (e.target.closest('input,#sources')) return;
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? next : prev)();
}, { passive: true });
addEventListener('hashchange', () => {
  const n = parseInt(location.hash.slice(1), 10);
  if (n >= 1 && n <= N) go(n - 1, { silent: true });
});

// ------------------------------------------------------------------ sources
let lastFocus = null;
function openSources() {
  lastFocus = document.activeElement;
  srcPanel.classList.add('open');
  srcPanel.setAttribute('aria-hidden', 'false');
  srcBtn.setAttribute('aria-expanded', 'true');
  $('#srcx').focus();
}
function closeSources() {
  if (!srcPanel.classList.contains('open')) return;
  srcPanel.classList.remove('open');
  srcPanel.setAttribute('aria-hidden', 'true');
  srcBtn.setAttribute('aria-expanded', 'false');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
srcBtn.addEventListener('click', () => (srcPanel.classList.contains('open') ? closeSources() : openSources()));
$('#srcx').addEventListener('click', closeSources);

// ------------------------------------------------------------------ sound: off until asked
const snd = { ac: null, on: false };
function soundStart() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  const ac = new AC();
  const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const voice = ac.createOscillator(); voice.type = 'sine'; voice.frequency.value = 196;
  const vg = ac.createGain(); vg.gain.value = 0; voice.connect(vg); vg.connect(master);
  const fb = ac.createOscillator(); fb.type = 'sine'; fb.frequency.value = 1000;
  const fg = ac.createGain(); fg.gain.value = 0;
  const shape = ac.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = (i / 255) * 2 - 1; curve[i] = Math.max(-0.6, Math.min(0.6, x * 3)); }
  shape.curve = curve;
  fb.connect(shape); shape.connect(fg); fg.connect(master);
  voice.start(); fb.start();
  Object.assign(snd, { ac, master, vg, fg, fb });
  return true;
}
function soundTick() {
  if (!snd.ac || !rig) return;
  const r = rig.read();
  const live = snd.on && cur > 0 && !document.hidden;
  const t = snd.ac.currentTime;
  snd.master.gain.setTargetAtTime(live ? 1 : 0, t, 0.06);
  snd.vg.gain.setTargetAtTime(0.045 * (1 - 0.7 * r.squeal), t, 0.05);
  snd.fg.gain.setTargetAtTime(0.05 * r.squeal, t, 0.05);
  snd.fb.frequency.setTargetAtTime(960 + r.squeal * 160, t, 0.1);
}
sndBtn.addEventListener('click', () => {
  if (!snd.on) {
    if (!snd.ac && !soundStart()) return;
    snd.ac.resume();
    snd.on = true;
  } else {
    snd.on = false;
    if (snd.master) snd.master.gain.setTargetAtTime(0, snd.ac.currentTime, 0.05);
  }
  setPressed(sndBtn, snd.on);
  sndBtn.textContent = snd.on ? 'Sound on' : 'Sound off';
  soundTick();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && snd.master) snd.master.gain.setTargetAtTime(0, snd.ac.currentTime, 0.05); });

// ------------------------------------------------------------------ the live stage
let rigPromise = null;
function ensureRig() {
  if (rig || rigFailed) return Promise.resolve(rig);
  if (rigPromise) return rigPromise;
  rigPromise = (async () => {
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
      try { await Promise.race([document.fonts.load('600 28px "Archivo Narrow"'), new Promise((r) => setTimeout(r, 2500))]); } catch (_) { /* fall through to the system face */ }
      const { createRig } = await import('./scene.js');
      rig = createRig(vis);
      rig.setReduced(reduced);
      rig.setLayout(phoneMQ.matches ? 'phone' : 'desk');
      rig.onFrame = soundTick;
      vis.classList.remove('loading-on');
      window.__rig = rig;
      rig.setActive(cur > 0);
      syncSize();
    } catch (err) {
      rigFailed = true;
      vis.classList.remove('loading-on');
      vis.classList.add('failed');
      console.warn('stage unavailable', err && err.message);
    }
    return rig;
  })();
  return rigPromise;
}

// ------------------------------------------------------------------ start
fit();
const start = parseInt(location.hash.slice(1), 10);
go(start >= 1 && start <= N ? start - 1 : 0, { silent: true, force: true });
if (!rigFailed) setTimeout(() => { if (!rig) ensureRig(); }, 400);
window.__deck = { go, S, get rig() { return rig; }, N };
