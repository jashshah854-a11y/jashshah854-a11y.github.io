// Deck mechanics: slides, steps, hash, sources, charts, indicator panel.
// The 3D centerpiece lives in viz.js and is loaded on demand so the deck still works if it fails.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const N = 11;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ sources */
const SOURCES = [
  ['S1', 'Russian Offensive Campaign Assessment, October 2, 2026', 'Institute for the Study of War', '2 Oct 2026', 'https://understandingwar.org/research/russia-ukraine/russian-offensive-campaign-assessment-october-2-2026/'],
  ['S2', 'Russian Offensive Campaign Assessment, October 1, 2026', 'Institute for the Study of War', '1 Oct 2026', 'https://understandingwar.org/research/russia-ukraine/russian-offensive-campaign-assessment-october-1-2026/'],
  ['S4', 'Report on ISW territorial figures, January to June 2026', 'Mezha.net, citing ISW', '2 Jul 2026', 'https://mezha.net/eng/bukvy/1d0d8674_isw_finds_russian/'],
  ['S8', 'Russia fired record number of missiles at Ukraine in July: AFP analysis', 'France 24 / AFP', '1 Aug 2026', 'https://www.france24.com/en/live-news/20260801-russia-fired-record-number-of-missiles-at-ukraine-in-july-afp-analysis'],
  ['S9', 'AFP analysis of Russian missile and drone launches in June 2026', 'Arab News / AFP', 'Jul 2026', 'https://www.arabnews.pk/node/2649293'],
  ['S10', 'Russia launched record drone and missile attacks on Ukraine in February 2026', 'United24 Media', 'Mar 2026', 'https://united24media.com/latest-news/russia-launched-record-drone-and-missile-attacks-on-ukraine-in-february-2026-16405'],
  ['S11', 'Russia launches largest aerial attack on Ukraine, strikes with 948 drones in 24 hours', 'News On AIR', '25 Mar 2026', 'https://www.newsonair.gov.in/russia-launches-largest-aerial-attack-on-ukraine-strikes-with-948-drones-in-24-hours'],
  ['S12', 'Russia pounds Kyiv in powerful drone and missile attack', 'Michigan Public / AP', '24 May 2026', 'https://www.michiganpublic.org/2026-05-24/russia-pounds-kyiv-in-powerful-drone-and-missile-attack'],
  ['S15', "Ukraine's air defences failed to intercept any Russian ballistic missiles, Air Force says", 'Euronews', '6 Jul 2026', 'https://www.euronews.com/my-europe/2026/07/06/ukraines-air-defences-failed-to-intercept-any-russian-ballistic-missiles-air-force-says'],
  ['S16', 'Ukraine says missile interceptor deliveries have fallen to third of 2025 level', 'US News / Reuters', '5 Aug 2026', 'https://www.usnews.com/news/world/articles/2026-08-05/ukraine-says-missile-interceptor-deliveries-have-fallen-to-third-of-2025-level'],
  ['S18', "Russian drone and missile barrage kills at least 12 in Ukraine's Kyiv", 'Al Jazeera', '1 Sep 2026', 'https://www.aljazeera.com/news/2026/9/1/russian-drone-and-missile-barrage-kills-at-least-12-in-ukraines-kyiv'],
  ['S19', 'Russia tearing Kyiv apart, mayor says, as strikes paralyse traffic', 'Euronews', '2 Oct 2026', 'https://www.euronews.com/2026/10/02/russia-tearing-kyiv-apart-mayor-says-as-strikes-paralyse-traffic'],
  ['S22', 'June was deadliest month for Ukraine civilians in over four years, UN monitors say', 'Euronews', '15 Jul 2026', 'https://www.euronews.com/2026/07/15/june-was-deadliest-month-for-ukraine-civilians-in-over-four-years-un-monitors-say'],
  ['S23', 'UN civilian casualties in Ukraine, August 2026', 'UNN', '19 Sep 2026', 'https://unn.ua/en/news/how-many-civilians-in-ukraine-were-killed-due-to-russias-aggression-in-august-the-un-announced-the-number-of-casualties'],
  ['S24', 'Ukraine Support Tracker update, May to June 2026', 'Kiel Institute, via idw-online', '13 Aug 2026', 'https://idw-online.de/en/news875861'],
  ['S26', 'EU approves 90 billion loan for Ukraine after Hungary lifts controversial veto', 'Euronews', '24 Apr 2026', 'https://www.euronews.com/2026/04/24/eu-approves-90-billion-loan-for-ukraine-after-hungary-lifts-controversial-veto'],
  ['S27', 'US military aid package for Ukraine, no Patriot missiles (Reuters report)', 'Ukrainska Pravda', '26 Sep 2026', 'https://www.pravda.com.ua/eng/news/2026/09/26/8055114/'],
  ['S29', 'No Patriots, no new money: EU', 'EU Perspectives', 'Sep 2026', 'https://euperspectives.eu/2026/09/no-patriots-no-new-money-eu/'],
  ['S30', 'US envoys Witkoff, Kushner arrive in Ukraine', 'Kyiv Independent', '6 Sep 2026', 'https://kyivindependent.com/us-envoys-witkoff-kushner-arrive-in-ukraine/'],
  ['S32', 'Putin orders a 72-hour pause in strikes on Kyiv as US envoys visit Russia and Ukraine', 'Local10 / AP', '5 Sep 2026', 'https://www.local10.com/news/world/2026/09/05/russian-president-vladimir-putin-orders-a-72-hour-pause-in-strikes-on-kyiv/'],
  ['S34', 'Ukraine peace talks end in Geneva after Zelenskiy says Russia stalling', 'Kathmandu Post', '18 Feb 2026', 'https://kathmandupost.com/world/2026/02/18/ukraine-peace-talks-end-in-geneva-after-zelenskiy-says-russia-stalling'],
  ['S35', 'Russia has a budget problem. Borrowing its way out won\'t be so simple', 'The Moscow Times', '28 Sep 2026', 'https://www.themoscowtimes.com/2026/09/28/russia-has-a-budget-problem-borrowing-its-way-out-wont-be-so-simple-a93804'],
  ['S37', "Russian Blood and Treasure: The Ballooning Costs of Putin's War", 'CSIS', '1 Jul 2026', 'https://www.csis.org/analysis/russian-blood-and-treasure-ballooning-costs-putins-war'],
  ['S38', "Russia's election is over. Could mobilization be next?", 'Kyiv Independent', 'Sep 2026', 'https://kyivindependent.com/russias-election-is-over-could-mobilization-be-next/'],
  ['S45', 'The Geography of Coercion: Russian Missile and Drone Campaigns in Ukraine', 'CSIS', '7 Jul 2026', 'https://www.csis.org/analysis/geography-coercion-russian-missile-and-drone-campaigns-ukraine'],
  ['S51', 'Russian Offensive Campaign Assessment, July 2, 2026 (added in this build)', 'Critical Threats Project / ISW', '2 Jul 2026', 'https://www.criticalthreats.org/analysis/russian-offensive-campaign-assessment-july-2-2026'],
  ['S52', 'Massive Russian missile and drone offensive targets Kyiv and other cities (added in this build)', 'Newsgram', '3 Jun 2026', 'https://www.newsgram.com/russia/2026/06/03/russian-missile-drone-offensive-targets-kyiv'],
  ['S53', 'Bloomberg: Putin plans to intensify attacks on Ukraine over winter to test its resilience (added in this build)', 'Ukrainska Pravda, citing Bloomberg', '8 Sep 2026', 'https://www.pravda.com.ua/eng/news/2026/09/08/8052518/']
];
const NOTES = [
  'Derived: July civilians killed, 454, is 2,222 minus 1,396 minus 372 and assumes no UN revisions. January and May missile and drone totals are derived from the AFP percentage changes. Weapons counted on slide 6 is 690 plus 729 plus 570.',
  'Kyiv strike nights: 24 May (S12), 2 June (S52, Ukrainian Air Force figures, 73 missiles and 656 drones), 2 July (S51, 74 missiles and 496 drones; S8, at least 30 killed), 1 September (S18, 12 killed in the city and region), 1 to 2 October (S19). Reports of the 2 June death toll differ, so none is shown.',
  'Excluded as mislabeled 2025 data: the "259 km2 in September / 19.04% occupied" figures, the "155 missiles / 4,133 Shaheds in August" figures, and the May 2025 Kremlin talks story.',
  'Left out because only a search snippet was seen: Ukrainian refining losses, AWOL and draft-evasion numbers, ground-robot missions, the DeepState July figure, Watling on manpower inflow, IISS, the Voronezh launcher report, and the 8 September resumption of strikes after the pause.',
  'Contested: bridge counts differ between reports (eight in Kyiv per Euronews). Casualty and recruitment estimates for Russia differ by source. Territorial figures use different methods, so they are never stacked on one axis. Zelensky\'s and Putin\'s own territorial claims are shown as claims.',
  'Geography: place coordinates are standard approximate values and sheets are schematic. Launch sites for strikes are not mapped.'
];

/* ------------------------------------------------------------------ deck state */
const slides = $$('.slide');
const STEPS = slides.map(s => +s.dataset.steps || 0);
const VIZ = slides.map(s => s.dataset.viz || null);
const stepOf = slides.map(() => 0);
const STEPTXT = {
  front: [
    'The dotted line is the start line. Each overlay moves the red line by one month of ISW area change.',
    'June 2025. Russia gains 481.25 km².',
    'June 2026. Russia gains 30.42 km². The red line barely leaves the dotted start.',
    'September 2026. ISW records a net Russian loss of 80.81 km², or 175.18 km² counting infiltration. Ukraine\'s Operation Vivaldi runs near Lyman.',
    'Putin claims 1,301 km² for September. ISW says the figures resemble hallucinations.'
  ],
  cityLedger: [
    'The ledger is empty. One mark is one weapon.',
    '24 May. 600 drones and 90 missiles, including an Oreshnik. The mayor reports 2 killed and 77 hurt.',
    '2 June. 656 drones and 73 missiles.',
    '2 July. 496 drones and 74 missiles. AFP counts at least 30 killed.',
    '1 September. 12 killed in Kyiv city and region. The sources give no per-night weapon count.',
    '1 to 2 October. Bridges struck. No weapon count in the sources.'
  ],
  cityBridges: [
    'Eight bridges join the two banks of the Dnipro.',
    'Southern Bridge: struck repeatedly on 1 and 2 October.',
    'Paton Bridge: open in one direction only. The other six: no report in the sources.'
  ],
  chain: [
    'Targets named in the plan: Kyiv, Kharkiv, Lviv and Odesa.',
    'Strikes damage the grid and bridges. A 13 December 2025 strike left over 1 million Ukrainians without power (CSIS). Kyiv\'s Southern Bridge was struck on 1 and 2 October. Interceptors are what cut this link.',
    'Damage becomes winter pressure. ISW, citing NYT and FT reporting, says Russia plans to collapse the energy system this winter, including strikes near the three operating nuclear plants. Repair and heating cut this link.',
    'Pressure becomes terms. Bloomberg reports Russia expects a stronger position by spring and serious talks not before 2027, with all of Donetsk Oblast as its aim. Russian money and manpower cut this link.'
  ]
};
const LINKSTAT = [null, 'Observed', 'Planned', 'Intended, not shown'];
const NIGHT_WEAP = [0, 690, 1419, 1989, 1989, 1989]; // cumulative, from 690 + 729 + 570

let cur = 0, step = 0;
let vizApi = null, vizLoading = false;
let reader = false;
let activeVizSlide = -1; // reader mode: slide that owns the canvas

/* ------------------------------------------------------------------ layout */
const mq = matchMedia('(max-width: 800px)');
function applyLayout() {
  reader = mq.matches;
  const root = document.documentElement;
  root.classList.toggle('stage', !reader);
  root.classList.toggle('reader', reader);
  fitStage();
  buildCharts();
  if (reader) {
    slides.forEach(s => s.classList.add('on'));
    observeReader();
  } else {
    slides.forEach((s, i) => s.classList.toggle('on', i === cur));
    drawDesk();
  }
  syncUI();
  syncViz();
}
function fitStage() {
  if (reader) { document.documentElement.style.removeProperty('--s'); return; }
  const s = Math.min(innerWidth / 1440, innerHeight / 810);
  document.documentElement.style.setProperty('--s', s.toFixed(4));
  if (vizApi) vizApi.setStageScale(s);
}

/* topographic desk (flat 2D, behind the 2D sheets) */
function drawDesk() {
  const c = $('#bgCanvas');
  if (!c || c.dataset.done) return;
  c.dataset.done = '1';
  c.width = 720; c.height = 405;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(120, 40, 10, 360, 200, 520);
  grad.addColorStop(0, '#2c2417'); grad.addColorStop(.55, '#1d1a14'); grad.addColorStop(1, '#14110c');
  g.fillStyle = grad; g.fillRect(0, 0, 720, 405);
  // contours from a cheap noise field (marching squares)
  const gw = 180, gh = 102, f = new Float32Array(gw * gh);
  const h = (x, y) => { let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, s = t => t * t * (3 - 2 * t), u = s(fx), v = s(fy); const a = h(ix, iy), b = h(ix + 1, iy), c2 = h(ix, iy + 1), d = h(ix + 1, iy + 1); return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v; };
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) f[j * gw + i] = .55 * vn(i / 22, j / 22) + .3 * vn(i / 9, j / 9) + .15 * vn(i / 4, j / 4);
  g.strokeStyle = 'rgba(241,233,214,.055)'; g.lineWidth = 1;
  const sx = 720 / (gw - 1), sy = 405 / (gh - 1);
  for (let L = .2; L < .85; L += .05) {
    g.beginPath();
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const a = f[j * gw + i], b = f[j * gw + i + 1], cc = f[(j + 1) * gw + i + 1], d = f[(j + 1) * gw + i];
      const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (cc > L ? 2 : 0) | (d > L ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const t = (p, q) => (L - p) / (q - p);
      const T = [i + t(a, b), j], R = [i + 1, j + t(b, cc)], B = [i + t(d, cc), j + 1], Lf = [i, j + t(a, d)];
      const seg = { 1: [Lf, B], 2: [B, R], 3: [Lf, R], 4: [T, R], 5: [T, Lf, B, R], 6: [T, B], 7: [T, Lf], 8: [T, Lf], 9: [T, B], 10: [T, R, Lf, B], 11: [T, R], 12: [Lf, R], 13: [B, R], 14: [Lf, B] }[idx];
      for (let k = 0; k < seg.length; k += 2) { g.moveTo(seg[k][0] * sx, seg[k][1] * sy); g.lineTo(seg[k + 1][0] * sx, seg[k + 1][1] * sy); }
    }
    g.stroke();
  }
}

/* ------------------------------------------------------------------ navigation */
function go(i, s = 0, opts = {}) {
  i = Math.max(0, Math.min(N - 1, i));
  s = Math.max(0, Math.min(STEPS[i], s));
  cur = i; step = s; stepOf[i] = s;
  if (reader) {
    if (!opts.fromScroll) slides[i].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  } else {
    slides.forEach((el, k) => el.classList.toggle('on', k === i));
  }
  if (!opts.noHash) history.replaceState(null, '', '#' + (i + 1));
  syncUI();
  syncViz();
}
function next() {
  if (reader) { return go(cur + 1, 0); }
  if (step < STEPS[cur]) go(cur, step + 1); else if (cur < N - 1) go(cur + 1, 0);
}
function prev() {
  if (reader) { return go(cur - 1, 0); }
  if (step > 0) go(cur, step - 1); else if (cur > 0) go(cur - 1, STEPS[cur - 1]);
}
function nextSlide() { go(cur + 1, 0); }
function prevSlide() { go(cur - 1, 0); }

function syncUI() {
  $('#counter').textContent = reader ? `Sheet ${cur + 1} of ${N}` : `Sheet ${cur + 1} of ${N} · as of 3 Oct 2026`;
  $('#btn-prev').disabled = cur === 0 && step === 0;
  $('#btn-next').disabled = cur === N - 1 && step >= STEPS[cur];
  slides.forEach((el, i) => {
    el.setAttribute('aria-hidden', !reader && i !== cur ? 'true' : 'false');
    if (!reader && i !== cur) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    if (!STEPS[i]) return;
    const st = stepOf[i];
    const word = el.dataset.stepWord || 'Step';
    const lab = $('.lab', el);
    if (lab) lab.textContent = `${word} ${st} of ${STEPS[i]}`;
    const [pb, nb] = $$('button', $('.stepper', el));
    if (pb) { pb.disabled = st === 0; nb.disabled = st === STEPS[i]; }
    const key = VIZ[i];
    const cap = $('.stepcap', el);
    if (cap && STEPTXT[key]) cap.textContent = STEPTXT[key][st];
    if (key === 'front') $$('#ro-ground tr').forEach(tr => tr.classList.toggle('on', st >= +tr.dataset.i));
    if (key === 'cityLedger') {
      $('#t-nights').textContent = st;
      $('#t-weap').textContent = NIGHT_WEAP[st].toLocaleString('en-US');
    }
    if (key === 'chain') {
      const ls = $('#link-status');
      if (LINKSTAT[st]) { ls.hidden = false; ls.innerHTML = `<b>${LINKSTAT[st]}</b>Link ${st} of 3`; } else ls.hidden = true;
    }
  });
}

/* build steppers */
slides.forEach((el, i) => {
  if (!STEPS[i]) return;
  const st = $('.stepper', el);
  st.innerHTML = '<button type="button" class="prev" aria-label="Previous step">←</button><span class="lab" aria-live="off"></span><button type="button" class="next" aria-label="Next step">→</button>';
  const [pb, nb] = $$('button', st);
  pb.addEventListener('click', () => stepClick(i, -1));
  nb.addEventListener('click', () => stepClick(i, +1));
});
function stepClick(i, d) {
  const s = Math.max(0, Math.min(STEPS[i], stepOf[i] + d));
  stepOf[i] = s;
  if (!reader) { cur = i; step = s; }
  syncUI();
  syncViz();
}

/* ------------------------------------------------------------------ events */
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  const tag = t && t.tagName;
  if (!$('#sources').hidden) { if (e.key === 'Escape') closeSources(); return; }
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if ((tag === 'BUTTON') && (e.key === ' ' || e.key === 'Enter')) return;
  const k = e.key;
  if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ') { e.preventDefault(); next(); }
  else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); prev(); }
  else if (k === 'PageDown') { e.preventDefault(); nextSlide(); }
  else if (k === 'PageUp') { e.preventDefault(); prevSlide(); }
  else if (k === 'Home') { e.preventDefault(); go(0); }
  else if (k === 'End') { e.preventDefault(); go(N - 1); }
});
$('#btn-next').addEventListener('click', next);
$('#btn-prev').addEventListener('click', prev);
let tx = 0, ty = 0, tt = 0;
$('#stage').addEventListener('touchstart', e => { const p = e.changedTouches[0]; tx = p.clientX; ty = p.clientY; tt = Date.now(); }, { passive: true });
$('#stage').addEventListener('touchend', e => {
  if (reader) return;
  const p = e.changedTouches[0], dx = p.clientX - tx, dy = p.clientY - ty;
  if (Math.abs(dx) > 50 && Math.abs(dy) < 60 && Date.now() - tt < 700 && !e.target.closest('input,.panel')) { dx < 0 ? next() : prev(); }
}, { passive: true });
addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= N && n - 1 !== cur) go(n - 1, 0, { noHash: true }); });
addEventListener('resize', () => { fitStage(); if (vizApi) vizApi.resize(); });
mq.addEventListener('change', applyLayout);
document.addEventListener('visibilitychange', () => { if (vizApi) vizApi.setHidden(document.hidden); });

/* reader mode: scroll drives the counter and the canvas */
let io = null;
function observeReader() {
  if (io) io.disconnect();
  const ratios = new Map();
  io = new IntersectionObserver(entries => {
    entries.forEach(en => ratios.set(slides.indexOf(en.target), en.intersectionRatio));
    let best = -1, br = 0;
    ratios.forEach((r, i) => { if (r > br) { br = r; best = i; } });
    if (best >= 0 && best !== cur) { cur = best; step = stepOf[best]; history.replaceState(null, '', '#' + (best + 1)); syncUI(); syncViz(); }
  }, { threshold: [0, .15, .3, .5, .7, 1] });
  slides.forEach(s => io.observe(s));
}

/* ------------------------------------------------------------------ sources panel */
const listEl = $('#sources-list');
listEl.innerHTML = SOURCES.map(([id, t, p, d, u]) => `<li><span class="id">${id}</span><span><span class="t">${t}</span><span class="m">${p}, ${d}</span><a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a></span></li>`).join('');
$('#sources-notes').innerHTML = NOTES.map(n => `<li>${n}</li>`).join('');
let lastFocus = null;
function openSources() { lastFocus = document.activeElement; $('#sources').hidden = false; $('#sources-close').focus(); }
function closeSources() { $('#sources').hidden = true; if (lastFocus) lastFocus.focus(); }
$('#btn-sources').addEventListener('click', openSources);
$('#sources-close').addEventListener('click', closeSources);
$('#sources').addEventListener('click', e => { if (e.target.id === 'sources') closeSources(); });

/* ------------------------------------------------------------------ charts */
function buildCharts() {
  // slide 4
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const miss = [135, 288, null, null, 212, 180, 376, null, null];
  const dron = [4477, 5059, null, null, 8100, 5749, 4956, null, null];
  const dMiss = new Set([4]), dDron = new Set([0, 4]);
  const fmt = n => n.toLocaleString('en-US');
  const panel = (title, sub, vals, max, derived) => `<div class="chart"><h3>${title}</h3><div class="csub">${sub}</div><div class="cols">${vals.map((v, i) => {
    if (v == null) return `<div class="col gap"><span class="v">none found</span><div class="bar-m"></div></div>`;
    const hgt = Math.max(3, v / max * 100);
    const label = (derived.has(i) ? '~' : '') + fmt(v);
    return `<div class="col${derived.has(i) ? ' derived' : ''}"><span class="v">${label}</span><div class="bar-m" style="height:${hgt}%"></div></div>`;
  }).join('')}</div><div class="mlabs">${mo.map(m => `<span>${m}</span>`).join('')}</div></div>`;
  $('#charts-air').innerHTML =
    panel('Missiles launched per month', 'Peak: 376 in July, a monthly record', miss, 400, dMiss) +
    panel('Long-range drones per month', 'Peak: about 8,100 in May, derived', dron, 8800, dDron);

  // slide 5
  const mk = (n, third) => Array.from({ length: n }, (_, i) => `<span class="m${third && i < 42 ? ' third-row' : ''}"></span>`).join('');
  $('#dots-a').innerHTML = mk(29);
  $('#dots-b').innerHTML = mk(126, true);

  // horizontal bars
  $$('.hb').forEach(hb => {
    const max = +(hb.closest('[data-max]').dataset.max);
    const v = +hb.dataset.v, ext = +(hb.dataset.ext || 0);
    const bar = $('i', hb), u = $('u', hb);
    const w = v / max * 100;
    requestAnimationFrame(() => { bar.style.width = w + '%'; });
    if (u) { u.style.left = w + '%'; u.style.width = (ext / max * 100) + '%'; }
  });
}

/* ------------------------------------------------------------------ indicator panel (slide 11) */
const IND = [
  { id: 'int', name: 'Interceptor stocks', type: 'range', lo: 'ample', hi: 'exhausted', val: 80, w: 1, last: '6 Jul: 29 ballistic missiles, none intercepted. July: under a third downed.' },
  { id: 'west', name: 'Western supply', type: 'range', lo: 'flowing', hi: 'drying up', val: 75, w: 1, last: 'No new Patriot pledges on 1 Sep. 2026 deliveries are one third of 2025. US package has no Patriot missiles.' },
  { id: 'gnd', name: 'Ground momentum', type: 'range', lo: 'Ukraine pushes', hi: 'Russia advances', val: 20, w: 1, last: 'September: ISW net Russian loss of 80.81 km². January to June gains were 28% of 2025.' },
  { id: 'grid', name: 'Grid damage', type: 'range', lo: 'intact', hi: 'collapsing', val: 35, w: 1, last: 'No winter outage data yet. The 13 Dec 2025 strike cut power to over 1 million. Bridges struck 1 to 2 Oct.' },
  { id: 'mob', name: 'Mobilization decree', type: 'switch', val: 0, w: .5, last: 'None found as of 3 Oct, unverified. The Kremlin denied plans on 25 Aug and 1 Sep.' },
  { id: 'nuc', name: 'Strikes near nuclear plants', type: 'switch', val: 0, w: .5, last: 'ISW: Russia plans strikes near the three operating plants. None reported in the sources reviewed.' }
];
const state = IND.map(d => ({ ...d }));
function buildPanel() {
  const host = $('#panel-rows');
  host.innerHTML = state.map((d, i) => {
    const ctl = d.type === 'range'
      ? `<div class="ctl"><input type="range" min="0" max="100" step="1" value="${d.val}" data-i="${i}" data-k="val" aria-label="${d.name} reading, from ${d.lo} to ${d.hi}"><div class="ends"><span>${d.lo}</span><span>${d.hi}</span></div></div>`
      : `<div class="ctl"><label class="sw"><input type="checkbox" data-i="${i}" data-k="val" ${d.val ? 'checked' : ''}><span>Observed</span></label></div>`;
    return `<div class="irow"><h4>${d.name}</h4>${ctl}<div class="wctl w"><span class="wlab">weight</span><input type="range" min="0" max="3" step=".5" value="${d.w}" data-i="${i}" data-k="w" aria-label="${d.name} weight"><output>${d.w.toFixed(1)}</output></div><div class="last">${d.last}</div></div>`;
  }).join('');
  host.oninput = onInd; host.onchange = onInd;
}
function onInd(e) {
  const t = e.target; if (!t.dataset.k) return;
  const d = state[+t.dataset.i];
  if (t.type === 'checkbox') d.val = t.checked ? 100 : 0;
  else if (t.dataset.k === 'w') { d.w = +t.value; const o = t.nextElementSibling; if (o) o.textContent = d.w.toFixed(1); }
  else d.val = +t.value;
  updateGauge();
}
function pressure() {
  let num = 0, den = 0;
  state.forEach(d => { num += d.w * d.val; den += d.w; });
  return den ? num / den : null;
}
function updateGauge() {
  const p = pressure();
  const out = $('#g-val'), band = $('#g-band'), needle = $('#g-needle');
  if (p == null) { out.textContent = '--'; band.textContent = 'All weights are zero'; return; }
  const r = Math.round(p);
  out.textContent = r;
  const b = r < 34 ? 0 : r < 67 ? 1 : 2;
  band.textContent = ['Stabilization', 'Coercive attrition', 'Systemic shock'][b];
  ['g-b1', 'g-b2', 'g-b3'].forEach((id, k) => $('#' + id).classList.toggle('on', k === b));
  needle.style.transform = `rotate(${-90 + p * 1.8}deg)`;
  if (vizApi) vizApi.setPressure(p);
}
$('#panel-reset').addEventListener('click', () => { state.forEach((d, i) => { d.val = IND[i].val; d.w = IND[i].w; }); buildPanel(); updateGauge(); });
buildPanel();

/* ------------------------------------------------------------------ 3D */
function syncViz() {
  const key = VIZ[cur];
  const layer = $('#viz-layer');
  if (!reader) layer.classList.toggle('on', !!key);
  if (!key) { if (vizApi) vizApi.setActive(false); return; }
  loadViz();
  if (!vizApi) return;
  const mount = reader ? $('.viz-mount', slides[cur]) : layer;
  vizApi.mount(mount, reader);
  vizApi.set(key, stepOf[cur]);
  vizApi.setActive(true);
  if (key === 'pressure') updateGauge();
}
async function loadViz() {
  if (vizApi || vizLoading) return;
  vizLoading = true;
  const msg = $('#viz-msg');
  msg.hidden = false; msg.textContent = 'Drawing the sheets...';
  try {
    const mod = await import('./viz.js');
    vizApi = await mod.createViz({ reduced });
    vizApi.setStageScale(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1);
    msg.hidden = true;
    syncViz();
    window.__viz = vizApi;
  } catch (err) {
    console.warn('viz unavailable', err);
    msg.hidden = false;
    msg.textContent = '3D view unavailable on this device. The numbers and captions on this sheet still hold.';
    vizLoading = false;
  }
}

/* ------------------------------------------------------------------ start */
const start = parseInt(location.hash.slice(1), 10);
if (start >= 1 && start <= N) { cur = start - 1; }
applyLayout();
updateGauge();
if (reader && cur > 0) requestAnimationFrame(() => slides[cur].scrollIntoView());
window.__deck = { go, next, prev, get cur() { return cur; }, get step() { return step; } };
